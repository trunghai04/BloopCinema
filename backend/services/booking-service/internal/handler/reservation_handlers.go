package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"booking-service/internal/catalog"
	"booking-service/internal/events"
	"booking-service/internal/model"
	"booking-service/internal/repository"
)

type reservationHandler struct {
	res     *repository.ReservationRepository
	publish events.Publisher
	catalog *catalog.Client
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
	occupied := make([]string, 0, len(seatStatus.Holding)+len(seatStatus.Reserved)+len(seatStatus.Sold))
	occupied = append(occupied, seatStatus.Holding...)
	occupied = append(occupied, seatStatus.Reserved...)
	occupied = append(occupied, seatStatus.Sold...)
	writeJSON(w, http.StatusOK, map[string]any{
		"showtimeId": st,
		"occupied":   occupied,
		"holding":    seatStatus.Holding,
		"sold":       seatStatus.Sold,
		"reserved":   seatStatus.Reserved,
		"locking":    activeSeatLocks(st),
		"rows":       []string{"A", "B", "C", "D", "E", "F"},
		"cols":       []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
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
