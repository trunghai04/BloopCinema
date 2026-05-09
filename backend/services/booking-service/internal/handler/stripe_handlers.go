package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/stripe/stripe-go/v81"
	stripewebhook "github.com/stripe/stripe-go/v81/webhook"

	"booking-service/internal/payment"
)

type stripePaymentHandler struct {
	gw *payment.Gateway
}

func RegisterStripePaymentRoutes(mux *http.ServeMux, gw *payment.Gateway) {
	h := &stripePaymentHandler{gw: gw}
	mux.HandleFunc("/api/v1/reservations/stripe/status", h.status)
	mux.HandleFunc("/api/v1/reservations/stripe/checkout-session", h.checkoutSession)
	mux.HandleFunc("/api/v1/reservations/stripe/confirm", h.confirm)
	mux.HandleFunc("/api/v1/reservations/stripe/webhook", h.webhook)
}

func (h *stripePaymentHandler) status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{
		"stripeConfigured": h.gw != nil,
	})
}

type stripeCheckoutBody struct {
	HoldID     string `json:"holdId"`
	SuccessURL string `json:"successUrl"`
	CancelURL  string `json:"cancelUrl"`
}

func (h *stripePaymentHandler) checkoutSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.gw == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "stripe_not_configured",
			"message": "Thiếu STRIPE_SECRET_KEY trên booking-service",
		})
		return
	}
	var req stripeCheckoutBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.HoldID == "" || req.SuccessURL == "" || req.CancelURL == "" {
		http.Error(w, "holdId, successUrl, cancelUrl required", http.StatusBadRequest)
		return
	}
	url, err := h.gw.CreateCheckoutSession(r.Context(), req.HoldID, req.SuccessURL, req.CancelURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

type stripeConfirmBody struct {
	SessionID string `json:"sessionId"`
}

func (h *stripePaymentHandler) confirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.gw == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "stripe_not_configured",
			"message": "Thiếu STRIPE_SECRET_KEY trên booking-service",
		})
		return
	}
	var req stripeConfirmBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.SessionID == "" {
		http.Error(w, "sessionId required", http.StatusBadRequest)
		return
	}
	out, err := h.gw.ConfirmCheckoutSession(r.Context(), req.SessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *stripePaymentHandler) webhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.gw == nil || h.gw.WebhookSecret == "" {
		http.Error(w, "webhook disabled", http.StatusServiceUnavailable)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}
	sig := r.Header.Get("Stripe-Signature")
	ev, err := stripewebhook.ConstructEvent(body, sig, h.gw.WebhookSecret)
	if err != nil {
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}
	switch ev.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(ev.Data.Raw, &sess); err != nil {
			http.Error(w, "parse event", http.StatusBadRequest)
			return
		}
		if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
			w.WriteHeader(http.StatusOK)
			return
		}
		_, _ = h.gw.ConfirmCheckoutSession(r.Context(), sess.ID)
	default:
		// ignored
	}
	w.WriteHeader(http.StatusOK)
}
