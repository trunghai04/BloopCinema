package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type Client struct {
	baseURL string
	hc      *http.Client
}

type CheckoutResponse struct {
	URL string `json:"url"`
}

type ConfirmResponse struct {
	SessionID string `json:"sessionId"`
	Status    string `json:"status"`
}

func NewClient(baseURL string) *Client {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(os.Getenv("PAYMENT_SERVICE_URL")), "/")
	}
	if baseURL == "" {
		return nil
	}
	return &Client{
		baseURL: baseURL,
		hc: &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *Client) CheckoutSession(ctx context.Context, holdID, successURL, cancelURL string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("payment client unavailable")
	}
	body, _ := json.Marshal(map[string]string{
		"holdId":     holdID,
		"successUrl": successURL,
		"cancelUrl":  cancelURL,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/payments/checkout-session", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("payment checkout failed: %s", strings.TrimSpace(string(data)))
	}
	var out CheckoutResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return "", err
	}
	return out.URL, nil
}

func (c *Client) Confirm(ctx context.Context, sessionID string) (ConfirmResponse, error) {
	if c == nil {
		return ConfirmResponse{}, fmt.Errorf("payment client unavailable")
	}
	body, _ := json.Marshal(map[string]string{"sessionId": sessionID})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/payments/confirm", bytes.NewReader(body))
	if err != nil {
		return ConfirmResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return ConfirmResponse{}, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return ConfirmResponse{}, fmt.Errorf("payment confirm failed: %s", strings.TrimSpace(string(data)))
	}
	var out ConfirmResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return ConfirmResponse{}, err
	}
	return out, nil
}
