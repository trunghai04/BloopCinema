package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"order-service/internal/repository"
)

type Handler struct {
	repo *repository.Repository
}

func RegisterRoutes(mux *http.ServeMux, repo *repository.Repository) {
	h := &Handler{repo: repo}
	mux.HandleFunc("/health", h.health)
	mux.HandleFunc("/ready", h.ready)
	mux.HandleFunc("/api/v1/orders", h.orders)
	mux.HandleFunc("/api/v1/orders/", h.orderByID)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"service": "order-service", "status": "ok"})
}

func (h *Handler) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ready": true})
}

func (h *Handler) orders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		userID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if userID != "" {
			items, err := h.repo.ListByUser(r.Context(), userID)
			if err != nil {
				http.Error(w, "list orders failed", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, items)
			return
		}
		items, err := h.repo.ListAll(r.Context())
		if err != nil {
			http.Error(w, "list orders failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	case http.MethodPost:
		var req struct {
			ID              string   `json:"id"`
			UserID          string   `json:"userId"`
			UserEmail       string   `json:"userEmail"`
			MovieID         string   `json:"movieId"`
			MovieTitle      string   `json:"movieTitle"`
			TheaterID       string   `json:"theaterId"`
			TheaterName     string   `json:"theaterName"`
			ShowtimeID      string   `json:"showtimeId"`
			ShowtimeLabel   string   `json:"showtimeLabel"`
			ShowtimeStartAt string   `json:"showtimeStartAt"`
			SeatCode        string   `json:"seatCode"`
			SeatCodes       []string `json:"seatCodes"`
			AmountVND       int64    `json:"amountVnd"`
			TotalAmount     int64    `json:"totalAmount"`
			Status          string   `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if req.ID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}
		status := strings.TrimSpace(req.Status)
		if status == "" {
			status = "pending"
		}
		now := time.Now().UTC()
		amount := req.AmountVND
		if amount == 0 {
			amount = req.TotalAmount
		}
		order := repository.Order{
			ID:            req.ID,
			UserID:        req.UserID,
			UserEmail:     req.UserEmail,
			MovieID:       req.MovieID,
			MovieTitle:    req.MovieTitle,
			TheaterID:     req.TheaterID,
			TheaterName:   req.TheaterName,
			ShowtimeID:    req.ShowtimeID,
			ShowtimeLabel: req.ShowtimeLabel,
			SeatCode:      req.SeatCode,
			SeatCodes:     req.SeatCodes,
			AmountVND:     amount,
			Status:        status,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := h.repo.Create(r.Context(), order); err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
				writeJSON(w, http.StatusConflict, map[string]any{"id": req.ID, "status": status})
				return
			}
			http.Error(w, "create order failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, order)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) orderByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/v1/orders/"))
	if id == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method == http.MethodGet {
		item, err := h.repo.Get(r.Context(), id)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	if r.Method == http.MethodPost {
		var req struct{ Status string `json:"status"` }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.Status) == "" {
			http.Error(w, "status required", http.StatusBadRequest)
			return
		}
		if err := h.repo.UpdateStatus(r.Context(), id, req.Status); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
