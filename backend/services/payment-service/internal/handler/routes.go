package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type checkoutBody struct {
	HoldID     string `json:"holdId"`
	SuccessURL string `json:"successUrl"`
	CancelURL  string `json:"cancelUrl"`
}

type confirmBody struct {
	SessionID string `json:"sessionId"`
}

type checkoutSessionInfo struct {
	HoldID  string
	OrderID string
}

var (
	checkoutMu       sync.Mutex
	checkoutSessions = map[string]checkoutSessionInfo{}
)

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/ready", ready)
	mux.HandleFunc("/api/v1/payments/status", status)
	mux.HandleFunc("/api/v1/payments/checkout-session", checkoutSession)
	mux.HandleFunc("/api/v1/payments/confirm", confirm)
	mux.HandleFunc("/api/v1/payments/webhook", webhook)
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"service": "payment-service", "status": "ok"})
}

func ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ready": true})
}

func status(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"stripeConfigured": strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")) != "",
		"bookingServiceConfigured": strings.TrimSpace(os.Getenv("BOOKING_SERVICE_URL")) != "",
	})
}

func checkoutSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req checkoutBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.HoldID == "" || req.SuccessURL == "" || req.CancelURL == "" {
		http.Error(w, "holdId, successUrl, cancelUrl required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")) == "" {
		http.Error(w, "STRIPE_SECRET_KEY is required", http.StatusFailedDependency)
		return
	}
	sessionID := fmt.Sprintf("cs_test_%s_%d", req.HoldID, time.Now().UnixNano())
	checkoutMu.Lock()
	checkoutSessions[sessionID] = checkoutSessionInfo{HoldID: req.HoldID}
	checkoutMu.Unlock()
	if err := ensurePendingOrder(req.HoldID, sessionID); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}
	redirectURL := strings.ReplaceAll(req.SuccessURL, "{CHECKOUT_SESSION_ID}", sessionID)
	writeJSON(w, http.StatusOK, map[string]string{"url": redirectURL})
}

func confirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req confirmBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.SessionID == "" {
		http.Error(w, "sessionId required", http.StatusBadRequest)
		return
	}
	checkoutMu.Lock()
	info, ok := checkoutSessions[req.SessionID]
	checkoutMu.Unlock()
	holdID := info.HoldID
	if !ok || strings.TrimSpace(holdID) == "" {
		holdID = parseHoldIDFromSession(req.SessionID)
	}
	if strings.TrimSpace(holdID) == "" {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}
	if err := notifyBookingService(holdID, true); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"sessionId": req.SessionID, "status": "paid", "bookingSync": "failed", "error": err.Error()})
		return
	}
	if err := notifyOrderService(req.SessionID, holdID, "paid"); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no rows in result set") {
			writeJSON(w, http.StatusOK, map[string]any{
				"sessionId":   req.SessionID,
				"id":          holdID,
				"holdId":      holdID,
				"status":      "paid",
				"bookingSync": "ok",
				"orderSync":   "skipped",
				"warning":     "order not found, skipping sync",
			})
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]any{"sessionId": req.SessionID, "status": "paid", "bookingSync": "ok", "orderSync": "failed", "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionId": req.SessionID,
		"id":        holdID,
		"holdId":    holdID,
		"status":    "paid",
		"bookingSync": "ok",
		"orderSync":  "ok",
	})
}

func webhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, _ := io.ReadAll(r.Body)
	_ = body
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func ensurePendingOrder(holdID, sessionID string) error {
	orderURL := strings.TrimRight(strings.TrimSpace(os.Getenv("ORDER_SERVICE_URL")), "/")
	bookingURL := strings.TrimRight(strings.TrimSpace(os.Getenv("BOOKING_SERVICE_URL")), "/")
	if orderURL == "" {
		return nil
	}
	payload := map[string]any{
		"id":        holdID,
		"seatCode":  holdID,
		"seatCodes": []string{holdID},
		"amountVnd": 0,
		"status":    "pending",
	}
	if detail, err := fetchHoldDetail(bookingURL, holdID); err == nil {
		if v, ok := detail["userEmail"].(string); ok && strings.TrimSpace(v) != "" { payload["userEmail"] = v }
		if v, ok := detail["movieId"].(string); ok && strings.TrimSpace(v) != "" { payload["movieId"] = v }
		if v, ok := detail["showtimeId"].(string); ok && strings.TrimSpace(v) != "" { payload["showtimeId"] = v }
		if raw, ok := detail["seatCodes"].(string); ok {
			parts := strings.Split(raw, ",")
			codes := make([]string, 0, len(parts))
			for _, item := range parts {
				s := strings.TrimSpace(strings.ToUpper(item))
				if len(s) >= 2 && len(s) <= 4 && s[0] >= 'A' && s[0] <= 'Z' {
					codes = append(codes, s)
				}
			}
			if len(codes) > 0 {
				payload["seatCodes"] = codes
				payload["seatCode"] = strings.Join(codes, ",")
			}
		}
		if raw, ok := detail["seatCode"].(string); ok && strings.TrimSpace(raw) != "" {
			s := strings.TrimSpace(strings.ToUpper(raw))
			if len(s) >= 2 && len(s) <= 4 && s[0] >= 'A' && s[0] <= 'Z' {
				payload["seatCode"] = s
				if _, exists := payload["seatCodes"]; !exists {
					payload["seatCodes"] = []string{s}
				}
			}
		}
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, orderURL+"/api/v1/orders", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusConflict {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("order prepare failed: %s", strings.TrimSpace(string(b)))
}

func notifyBookingService(holdID string, success bool) error {
	bookingURL := strings.TrimRight(strings.TrimSpace(os.Getenv("BOOKING_SERVICE_URL")), "/")
	if bookingURL == "" {
		return nil
	}
	payload := map[string]any{"holdId": holdID, "success": success}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, bookingURL+"/api/v1/reservations/pay", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("booking sync failed: %s", strings.TrimSpace(string(b)))
	}
	return nil
}

func fetchHoldDetail(baseURL, holdID string) (map[string]any, error) {
	if baseURL == "" || holdID == "" {
		return nil, fmt.Errorf("booking service unavailable")
	}
	req, err := http.NewRequest(http.MethodGet, baseURL+"/api/v1/reservations/detail?id="+holdID, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf(strings.TrimSpace(string(data)))
	}
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func parseHoldIDFromSession(sessionID string) string {
	parts := strings.Split(sessionID, "_")
	if len(parts) < 4 {
		return ""
	}
	return strings.Join(parts[2:len(parts)-1], "_")
}

func notifyOrderService(sessionID, holdID, status string) error {
	orderURL := strings.TrimRight(strings.TrimSpace(os.Getenv("ORDER_SERVICE_URL")), "/")
	if orderURL == "" {
		return nil
	}
	payload := map[string]any{"paymentRef": sessionID, "status": status}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, orderURL+"/api/v1/orders/"+holdID, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("order sync failed: %s", strings.TrimSpace(string(b)))
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

