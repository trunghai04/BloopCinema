package handler

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"strings"
)

func RegisterStripePaymentRoutes(mux *http.ServeMux, _ any) {
	mux.HandleFunc("/api/v1/reservations/stripe/status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		paymentURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PAYMENT_SERVICE_URL")), "/")
		if paymentURL == "" {
			writeJSON(w, http.StatusOK, map[string]any{"stripeConfigured": false, "paymentServiceConfigured": false})
			return
		}
		resp, err := http.Get(paymentURL + "/api/v1/payments/status")
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"stripeConfigured": false, "paymentServiceConfigured": false})
			return
		}
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(data)
	})

	mux.HandleFunc("/api/v1/reservations/stripe/checkout-session", func(w http.ResponseWriter, r *http.Request) {
		proxyToPayment(w, r, "/api/v1/payments/checkout-session")
	})
	mux.HandleFunc("/api/v1/reservations/stripe/confirm", func(w http.ResponseWriter, r *http.Request) {
		proxyToPayment(w, r, "/api/v1/payments/confirm")
	})
	mux.HandleFunc("/api/v1/reservations/stripe/webhook", func(w http.ResponseWriter, r *http.Request) {
		proxyToPayment(w, r, "/api/v1/payments/webhook")
	})
}

func proxyToPayment(w http.ResponseWriter, r *http.Request, targetPath string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	paymentURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PAYMENT_SERVICE_URL")), "/")
	if paymentURL == "" {
		http.Error(w, "PAYMENT_SERVICE_URL is required", http.StatusFailedDependency)
		return
	}
	body, _ := io.ReadAll(r.Body)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, paymentURL+targetPath, bytes.NewReader(body))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	for k, values := range resp.Header {
		for _, v := range values {
			w.Header().Add(k, v)
		}
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(data)
}
