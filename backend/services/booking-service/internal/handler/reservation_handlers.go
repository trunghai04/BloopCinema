package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"booking-service/internal/catalog"
	"booking-service/internal/events"
	"booking-service/internal/model"
	"booking-service/internal/order"
	"booking-service/internal/payment"
	"booking-service/internal/repository"

	"github.com/skip2/go-qrcode"
)

type reservationHandler struct {
	res         *repository.ReservationRepository
	publish     events.Publisher
	catalog     *catalog.Client
	payments    *payment.Client
	orderClient *order.Client
}

type seatLockRequest struct {
	ShowtimeID string   `json:"showtimeId"`
	SessionID  string   `json:"sessionId"`
	Seats      []string `json:"seats"`
}

type seatLock struct {
	ShowtimeID string
	SeatCode   string
	SessionID  string
	ExpiresAt  time.Time
}

var (
	seatLockMu   sync.Mutex
	seatLocks    = make(map[string]seatLock)
	seatSessions = make(map[string]time.Time)
	lockTTL      = 5 * time.Minute
	maxLockSeats = 12
)

func RegisterReservationRoutes(
	mux *http.ServeMux,
	res *repository.ReservationRepository,
	orderClient *order.Client,
	publisher events.Publisher,
) {
	h := &reservationHandler{
		res:         res,
		publish:     publisher,
		catalog:     catalog.NewClient(strings.TrimSpace(os.Getenv("CATALOG_SERVICE_URL"))),
		orderClient: orderClient,
	}
	mux.HandleFunc("/api/v1/reservations/hold", h.createHold)
	mux.HandleFunc("/api/v1/reservations/pay", h.payHold)
	mux.HandleFunc("/api/v1/reservations/detail", h.getDetail)
	mux.HandleFunc("/api/v1/reservations/showtime-seats", h.showtimeSeats)
	mux.HandleFunc("/api/v1/reservations/seat-lock", h.syncSeatLock)
}

func (h *reservationHandler) createHold(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req model.HoldRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.UserEmail == "" || req.MovieID == "" || req.ShowtimeID == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}
	if err := h.validateShowtimeActive(r.Context(), req.MovieID, req.ShowtimeID); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	reservation, err := h.res.CreateHold(
		r.Context(),
		req.UserEmail,
		req.MovieID,
		req.ShowtimeID,
		req.Seats,
		5*time.Minute,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	if h.orderClient != nil {
		var movieTitle string
		var theaterID string
		var theaterName string
		var showtimeLabel string
		var showtimeStartAt string
		var amountVnd int64

		showtime, err := h.catalog.GetShowtime(r.Context(), req.ShowtimeID)
		if err == nil && showtime != nil {
			theaterID = showtime.TheaterID
			showtimeStartAt = showtime.StartAt

			if mv, err := h.catalog.GetMovie(r.Context(), req.MovieID); err == nil && mv != nil {
				movieTitle = mv.Title
			}

			if th, err := h.catalog.GetTheater(r.Context(), showtime.TheaterID); err == nil && th != nil {
				theaterName = th.Name
			}

			parsedStartAt, _ := catalog.ParseShowtimeStartAt(showtime.StartAt)
			showtimeLabel = fmt.Sprintf("%s - %s", showtime.Hall, parsedStartAt.In(time.FixedZone("ICT", 7*3600)).Format("02/01/2006 15:04"))

			// Calculate total price dynamically using the seat layout and seat types
			var totalAmount int64 = 0
			layout, lerr := h.catalog.GetSeatLayoutByHall(r.Context(), showtime.TheaterID, showtime.Hall)
			if lerr == nil && layout != nil {
				// Map selected seats
				selected := make(map[string]string)
				for _, s := range req.Seats {
					seat := strings.TrimSpace(strings.ToUpper(s))
					if seat != "" {
						selected[seat] = "standard" // default type
					}
				}
				// Find actual seat types from layout
				for _, s := range layout.Seats {
					code := strings.TrimSpace(strings.ToUpper(s.Code))
					if code == "" {
						continue
					}
					if _, ok := selected[code]; ok && strings.TrimSpace(s.Type) != "" {
						selected[code] = strings.ToLower(strings.TrimSpace(s.Type))
					}
				}
				// Sum the prices of selected seat types
				for _, seatType := range selected {
					switch seatType {
					case "vip":
						totalAmount += int64(layout.SeatPrices.VIP)
					case "couple":
						totalAmount += int64(layout.SeatPrices.Couple)
					default:
						totalAmount += int64(layout.SeatPrices.Standard)
					}
				}
				amountVnd = totalAmount
			} else {
				// Fallback if layout cannot be retrieved
				pricePerSeat := int64(90000)
				if priceStr := os.Getenv("TICKET_PRICE_PER_SEAT_VND"); priceStr != "" {
					if val, err := strconv.ParseInt(priceStr, 10, 64); err == nil && val > 0 {
						pricePerSeat = val
					}
				}
				amountVnd = pricePerSeat * int64(len(req.Seats))
			}
		}

		_, _ = h.orderClient.Create(r.Context(), order.CreateOrderRequest{
			ID:              reservation.ID,
			UserID:          reservation.UserEmail,
			UserEmail:       reservation.UserEmail,
			MovieID:         reservation.MovieID,
			MovieTitle:      movieTitle,
			TheaterID:       theaterID,
			TheaterName:     theaterName,
			ShowtimeID:      reservation.ShowtimeID,
			ShowtimeLabel:   showtimeLabel,
			ShowtimeStartAt: showtimeStartAt,
			SeatCode:        reservation.SeatCodes,
			SeatCodes:       req.Seats,
			TotalAmount:     amountVnd,
			Currency:        "VND",
			Status:          "pending",
		})
	}

	if h.publish != nil {
		_ = h.publish.PublishReservationEvent(r.Context(), "reservation.hold.created", reservation)
	}
	writeJSON(w, http.StatusCreated, reservation)
}

func (h *reservationHandler) validateShowtimeActive(ctx context.Context, movieID, showtimeID string) error {
	if h == nil || h.catalog == nil {
		return errors.New("catalog dependency unavailable")
	}
	st, err := h.catalog.GetShowtime(ctx, showtimeID)
	if err != nil {
		return errors.New("showtime not found")
	}
	if strings.TrimSpace(st.MovieID) != strings.TrimSpace(movieID) {
		return errors.New("showtime does not match movie")
	}
	startAt, err := catalog.ParseShowtimeStartAt(st.StartAt)
	if err != nil {
		return errors.New("invalid showtime time")
	}
	if !startAt.After(time.Now()) {
		return errors.New("showtime already started")
	}
	return nil
}

func (h *reservationHandler) payHold(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req model.PayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.HoldID == "" {
		http.Error(w, "holdId required", http.StatusBadRequest)
		return
	}
	out, err := h.res.Pay(r.Context(), req.HoldID, req.Success)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if h.orderClient != nil {
		if out.State == model.StatePaid {
			_ = h.orderClient.UpdateStatus(r.Context(), out.ID, "paid")
		} else if out.State == model.StatePaymentFailed {
			_ = h.orderClient.UpdateStatus(r.Context(), out.ID, "failed")
		}
	}

	if h.publish != nil {
		if out.State == model.StatePaid {
			_ = h.publish.PublishReservationEvent(r.Context(), "reservation.paid", out)
			go func(res *model.Reservation) {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if err := h.sendTicketEmail(ctx, res); err != nil {
					fmt.Printf("ticket email send failed: %v\n", err)
				}
			}(out)
		} else if out.State == model.StatePaymentFailed {
			_ = h.publish.PublishReservationEvent(r.Context(), "reservation.payment_failed", out)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *reservationHandler) getDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}
	res, err := h.res.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *reservationHandler) sendTicketEmail(ctx context.Context, res *model.Reservation) error {
	to := strings.TrimSpace(res.UserEmail)
	if to == "" {
		return nil
	}
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if host == "" || from == "" {
		return nil
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	addr := net.JoinHostPort(host, port)

	movieLabel := strings.TrimSpace(res.MovieID)
	seatLabel := strings.TrimSpace(res.SeatCodes)
	roomLabel := "-"
	showtimeTime := "-"
	paidAt := time.Now().UTC()
	totalAmount := 0
	qrValue := strings.TrimSpace(res.QRPayload)
	if qrValue == "" {
		qrValue = res.ID
	}
	if st, err := h.catalog.GetShowtime(ctx, res.ShowtimeID); err == nil {
		roomLabel = strings.TrimSpace(st.Hall)
		showtimeTime = formatVietnameseTime(st.StartAt)
		if mv, merr := h.catalog.GetMovie(ctx, st.MovieID); merr == nil && mv != nil && strings.TrimSpace(mv.Title) != "" {
			movieLabel = mv.Title
		} else if strings.TrimSpace(st.MovieID) != "" {
			movieLabel = st.MovieID
		}
		if layout, lerr := h.catalog.GetSeatLayoutByHall(ctx, st.TheaterID, st.Hall); lerr == nil && layout != nil {
			selected := make(map[string]string)
			for _, s := range strings.Split(seatLabel, ",") {
				seat := strings.TrimSpace(strings.ToUpper(s))
				if seat != "" {
					selected[seat] = "standard"
				}
			}
			for _, s := range layout.Seats {
				code := strings.TrimSpace(strings.ToUpper(s.Code))
				if code == "" {
					continue
				}
				if _, ok := selected[code]; ok && strings.TrimSpace(s.Type) != "" {
					selected[code] = strings.ToLower(strings.TrimSpace(s.Type))
				}
			}
			for _, seatType := range selected {
				switch seatType {
				case "vip":
					totalAmount += layout.SeatPrices.VIP
				case "couple":
					totalAmount += layout.SeatPrices.Couple
				default:
					totalAmount += layout.SeatPrices.Standard
				}
			}
		}
	}
	qrPNG, err := qrcode.Encode(qrValue, qrcode.Medium, 220)
	if err != nil {
		return err
	}
	movieLabelEsc := html.EscapeString(movieLabel)
	seatLabelEsc := html.EscapeString(seatLabel)
	userEsc := html.EscapeString(to)
	idEsc := html.EscapeString(res.ID)
	amountEsc := html.EscapeString(formatVietnameseMoney(totalAmount))
	paidAtEsc := html.EscapeString(paidAt.In(time.FixedZone("ICT", 7*3600)).Format("02/01/2006 15:04"))

	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ve dien tu - Bloop Cinema</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 39, 68, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f2744; padding: 32px 40px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%%">
                <tr>
                  <td align="center" style="font-size: 13px; font-weight: 600; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase;">
                    BLOOP CINEMA
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 24px; font-weight: 800; color: #ffffff; padding-top: 8px; text-transform: uppercase;">
                    Hoa don & Ve dien tu
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 32px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f2744;">
                Cam on ban da dat ve!
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Giao dich cua ban da hoan tat thanh cong. Duoi day la thong tin chi tiet hoa don va ma QR ve dien tu cua ban. Vui long luu tru email nay va su dung ma QR ben duoi de lam thu tuc check-in nhan ve tai quay hoac may soat ve tu dong cua Bloop Cinema.
              </p>
              
              <!-- Ticket Details Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%%" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 14px;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0; width: 30%%;">Ma dat ve</td>
                  <td style="padding: 14px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 15px; font-weight: bold;">%s</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Phim</td>
                  <td style="padding: 14px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-weight: 600;">%s</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Suat chieu</td>
                  <td style="padding: 14px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">%s</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Phong chieu</td>
                  <td style="padding: 14px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">%s</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Ghe da chon</td>
                  <td style="padding: 14px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-weight: 600;">%s</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Tong thanh toan</td>
                  <td style="padding: 14px 16px; color: #e11d48; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 16px;">%s</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744; border-bottom: 1px solid #e2e8f0;">Thoi gian GD</td>
                  <td style="padding: 14px 16px; color: #475569; border-bottom: 1px solid #e2e8f0;">%s</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; font-weight: 600; color: #0f2744;">Email tai khoan</td>
                  <td style="padding: 14px 16px; color: #475569;">%s</td>
                </tr>
              </table>

              <!-- QR Code Block -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%%" style="margin: 35px 0 15px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 16px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <img alt="QR code" src="cid:ticket-qr" width="220" height="220" style="display: block; border-radius: 6px;" />
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 10px; font-style: italic;">
                      Quet ma QR tai loi vao phong chieu hoac quay ve de in ve cung
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #f1f5f9; height: 1px; line-height: 1px; font-size: 1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Footer Contact / Company Info -->
          <tr>
            <td style="padding: 32px 40px 40px 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%%" style="font-size: 12px; line-height: 1.6; color: #64748b;">
                <tr>
                  <td style="font-weight: 600; color: #1e293b; padding-bottom: 8px;">
                    HE THONG RAP CHIEU PHIM BLOOP CINEMA
                  </td>
                </tr>
                <tr>
                  <td>
                    Dia chi: Toa nha Bloop Tower, So 1 Duong Xuan Thuy, Cau Giay, Ha Noi
                  </td>
                </tr>
                <tr>
                  <td>
                    Hotline: 1900 6868 | Email: support@bloopcinema.com
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 20px; font-size: 11px; color: #94a3b8; text-align: center;">
                    Day la email tu dong tu he thong Bloop Cinema. Vui long khong tra loi truc tiep email nay.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, idEsc, movieLabelEsc, showtimeTime, roomLabel, seatLabelEsc, amountEsc, paidAtEsc, userEsc)

	msg := bytes.NewBuffer(nil)
	fmt.Fprintf(msg, "From: %s\r\n", from)
	fmt.Fprintf(msg, "To: %s\r\n", to)
	fmt.Fprint(msg, "Subject: Vé điện tử Bloop Cinema\r\n")
	fmt.Fprint(msg, "MIME-Version: 1.0\r\n")
	fmt.Fprint(msg, "Content-Type: multipart/related; boundary=ticket-boundary\r\n\r\n")
	fmt.Fprint(msg, "--ticket-boundary\r\n")
	fmt.Fprint(msg, "Content-Type: text/html; charset=UTF-8\r\n\r\n")
	msg.WriteString(body)
	fmt.Fprint(msg, "\r\n--ticket-boundary\r\n")
	fmt.Fprint(msg, "Content-Type: image/png\r\n")
	fmt.Fprint(msg, "Content-Transfer-Encoding: base64\r\n")
	fmt.Fprint(msg, "Content-Disposition: inline; filename=qr.png\r\n")
	fmt.Fprint(msg, "Content-ID: <ticket-qr>\r\n\r\n")
	enc := base64.StdEncoding.EncodeToString(qrPNG)
	for i := 0; i < len(enc); i += 76 {
		end := i + 76
		if end > len(enc) {
			end = len(enc)
		}
		fmt.Fprint(msg, enc[i:end]+"\r\n")
	}
	fmt.Fprint(msg, "\r\n--ticket-boundary--\r\n")

	var auth smtp.Auth
	if user != "" && pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	if err := smtp.SendMail(addr, auth, from, []string{to}, msg.Bytes()); err != nil {
		return err
	}
	return nil
}

func formatVietnameseTime(raw string) string {
	if t, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(raw)); err == nil {
		return t.In(time.FixedZone("ICT", 7*3600)).Format("02/01/2006 15:04")
	}
	if t, err := time.Parse(time.RFC3339, strings.TrimSpace(raw)); err == nil {
		return t.In(time.FixedZone("ICT", 7*3600)).Format("02/01/2006 15:04")
	}
	return strings.TrimSpace(raw)
}

func formatVietnameseMoney(amount int) string {
	if amount <= 0 {
		return "-"
	}
	return strconv.Itoa(amount) + " VND"
}

func (h *reservationHandler) showtimeSeats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	st := r.URL.Query().Get("showtimeId")
	if st == "" {
		http.Error(w, "showtimeId required", http.StatusBadRequest)
		return
	}
	seatStatus, err := h.res.SeatStatusPublic(r.Context(), st)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	showtime, err := h.catalog.GetShowtime(r.Context(), st)
	if err != nil {
		http.Error(w, "showtime not found", http.StatusNotFound)
		return
	}
	layout, _ := h.catalog.GetSeatLayoutByHall(r.Context(), showtime.TheaterID, showtime.Hall)
	occupied := make([]string, 0, len(seatStatus.Holding)+len(seatStatus.Reserved)+len(seatStatus.Sold))
	occupied = append(occupied, seatStatus.Holding...)
	occupied = append(occupied, seatStatus.Reserved...)
	occupied = append(occupied, seatStatus.Sold...)
	capacity := 0
	var rows []string
	var cols []int
	if layout != nil {
		rows = layout.Rows
		if layout.Cols > 0 {
			cols = make([]int, 0, layout.Cols)
			for i := 1; i <= layout.Cols; i++ {
				cols = append(cols, i)
			}
		}
		capacity = layout.Capacity
	}
	if capacity == 0 {
		if len(rows) > 0 && len(cols) > 0 {
			capacity = len(rows) * len(cols)
		} else {
			capacity = len(occupied)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"showtimeId": st,
		"occupied":   occupied,
		"holding":    seatStatus.Holding,
		"sold":       seatStatus.Sold,
		"reserved":   seatStatus.Reserved,
		"locking":    activeSeatLocks(st),
		"capacity":   capacity,
		"rows":       rows,
		"cols":       cols,
		"hall":       showtime.Hall,
		"theaterId":  showtime.TheaterID,
	})
}

func (h *reservationHandler) syncSeatLock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req seatLockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.ShowtimeID = strings.TrimSpace(req.ShowtimeID)
	req.SessionID = strings.TrimSpace(req.SessionID)
	if req.ShowtimeID == "" || req.SessionID == "" {
		http.Error(w, "showtimeId and sessionId required", http.StatusBadRequest)
		return
	}
	if len(req.Seats) > maxLockSeats {
		http.Error(w, "too many seats", http.StatusBadRequest)
		return
	}
	target := normalizeSeatCodes(req.Seats)
	seatStatus, err := h.res.SeatStatusPublic(r.Context(), req.ShowtimeID)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	unavailable := make(map[string]struct{})
	for _, s := range seatStatus.Sold {
		unavailable[s] = struct{}{}
	}
	for _, s := range seatStatus.Reserved {
		unavailable[s] = struct{}{}
	}
	for _, s := range seatStatus.Holding {
		unavailable[s] = struct{}{}
	}

	seatLockMu.Lock()
	defer seatLockMu.Unlock()
	pruneExpiredLocksLocked()
	sessionKey := seatSessionKey(req.ShowtimeID, req.SessionID)
	exp, ok := seatSessions[sessionKey]
	if !ok {
		exp = time.Now().UTC().Add(lockTTL)
		seatSessions[sessionKey] = exp
	}
	conflicts := make([]string, 0, 4)
	for _, s := range target {
		if _, used := unavailable[s]; used {
			conflicts = append(conflicts, s)
			continue
		}
		if lk, ok := seatLocks[seatLockKey(req.ShowtimeID, s)]; ok && lk.SessionID != req.SessionID {
			conflicts = append(conflicts, s)
		}
	}
	if len(conflicts) > 0 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"message":   "seat lock conflict",
			"conflicts": conflicts,
		})
		return
	}
	targetSet := make(map[string]struct{}, len(target))
	for _, s := range target {
		targetSet[s] = struct{}{}
	}
	for key, lk := range seatLocks {
		if lk.ShowtimeID != req.ShowtimeID || lk.SessionID != req.SessionID {
			continue
		}
		if _, keep := targetSet[lk.SeatCode]; !keep {
			delete(seatLocks, key)
		}
	}
	for _, s := range target {
		seatLocks[seatLockKey(req.ShowtimeID, s)] = seatLock{
			ShowtimeID: req.ShowtimeID,
			SeatCode:   s,
			SessionID:  req.SessionID,
			ExpiresAt:  exp,
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"showtimeId": req.ShowtimeID,
		"sessionId":  req.SessionID,
		"locking":    activeSeatLocksLocked(req.ShowtimeID),
		"expiresAt":  exp,
	})
}

func activeSeatLocks(showtimeID string) []string {
	seatLockMu.Lock()
	defer seatLockMu.Unlock()
	pruneExpiredLocksLocked()
	return activeSeatLocksLocked(showtimeID)
}

func activeSeatLocksLocked(showtimeID string) []string {
	out := make([]string, 0, 16)
	for _, lk := range seatLocks {
		if lk.ShowtimeID == showtimeID {
			out = append(out, lk.SeatCode)
		}
	}
	sort.Strings(out)
	return out
}

func pruneExpiredLocksLocked() {
	now := time.Now().UTC()
	for key, lk := range seatLocks {
		if now.After(lk.ExpiresAt) {
			delete(seatLocks, key)
		}
	}
	for key, exp := range seatSessions {
		if now.After(exp) {
			delete(seatSessions, key)
		}
	}
}

func seatLockKey(showtimeID, seatCode string) string {
	return showtimeID + "::" + seatCode
}

func seatSessionKey(showtimeID, sessionID string) string {
	return showtimeID + "::session::" + sessionID
}

func normalizeSeatCodes(seats []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(seats))
	for _, s := range seats {
		t := strings.TrimSpace(strings.ToUpper(s))
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}
