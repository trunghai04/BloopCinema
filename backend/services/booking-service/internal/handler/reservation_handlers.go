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
	"booking-service/internal/payment"
	"booking-service/internal/repository"

	"github.com/skip2/go-qrcode"
)

type reservationHandler struct {
	res      *repository.ReservationRepository
	publish  events.Publisher
	catalog  *catalog.Client
	payments *payment.Client
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
	publisher events.Publisher,
) {
	h := &reservationHandler{
		res:     res,
		publish: publisher,
		catalog: catalog.NewClient(strings.TrimSpace(os.Getenv("CATALOG_SERVICE_URL"))),
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

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,.08);">
      <tr>
        <td style="padding:22px 24px 10px;text-align:center;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">Bloop Cinema</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;">Hóa đơn / vé điện tử</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fbff;border:1px solid #e3ebf6;border-radius:16px;overflow:hidden;">
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Mã vé:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Ghế:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Email:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Phim:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Suất:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Phòng:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid #e3ebf6;"><strong>Tổng tiền:</strong> %s</td></tr>
            <tr><td style="padding:16px 18px;"><strong>Thời gian thanh toán:</strong> %s</td></tr>
          </table>

          <div style="text-align:center;margin:26px 0 14px;">
            <div style="display:inline-block;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
              <img alt="QR vé điện tử" src="cid:ticket-qr" width="220" height="220" style="display:block;border-radius:10px;background:#fff;" />
            </div>
          </div>

          <p style="margin:18px 0 0;font-size:13px;color:#475569;text-align:center;line-height:1.6;">Xuất mã QR này khi check-in tại rạp. Dữ liệu mã khớp ghế đã thanh toán.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`, idEsc, seatLabelEsc, userEsc, movieLabelEsc, showtimeTime, roomLabel, amountEsc, paidAtEsc)

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
