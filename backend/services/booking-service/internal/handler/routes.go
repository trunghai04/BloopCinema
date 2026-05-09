package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"booking-service/internal/catalog"
	"booking-service/internal/model"
	"booking-service/internal/repository"
)

type bookingHandler struct {
	repo    *repository.BookingRepository
	catalog *catalog.Client
}

func RegisterRoutes(
	mux *http.ServeMux,
	repo *repository.BookingRepository,
) {
	h := &bookingHandler{
		repo:    repo,
		catalog: catalog.NewClient(strings.TrimSpace(os.Getenv("CATALOG_SERVICE_URL"))),
	}
	mux.HandleFunc("/health", h.health)
	mux.HandleFunc("/ready", h.ready)
	mux.HandleFunc("/api/v1/bookings", h.bookings)
}

func (h *bookingHandler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"service": "booking-service",
		"status":  "ok",
	})
}

func (h *bookingHandler) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"ready": true,
	})
}

func (h *bookingHandler) bookings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listBookings(w, r)
	case http.MethodPost:
		h.createBooking(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *bookingHandler) createBooking(w http.ResponseWriter, r *http.Request) {
	var req model.CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	if req.UserEmail == "" || req.MovieID == "" || req.ShowtimeID == "" {
		http.Error(w, "missing required booking fields", http.StatusBadRequest)
		return
	}
	if err := h.validateShowtimeActive(r.Context(), req.MovieID, req.ShowtimeID); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	booking := model.Booking{
		ID:         "bk-" + time.Now().Format("20060102150405"),
		UserEmail:  req.UserEmail,
		MovieID:    req.MovieID,
		ShowtimeID: req.ShowtimeID,
		SeatCode:   req.SeatCode,
		CreatedAt:  time.Now().UTC(),
	}

	if err := h.repo.Create(r.Context(), booking); err != nil {
		http.Error(w, "create booking failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, booking)
}

func (h *bookingHandler) validateShowtimeActive(ctx context.Context, movieID, showtimeID string) error {
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

func (h *bookingHandler) listBookings(w http.ResponseWriter, r *http.Request) {
	bookings, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "list bookings failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, bookings)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
