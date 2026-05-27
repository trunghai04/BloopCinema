package order

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

type CreateOrderRequest struct {
	UserID          string   `json:"userId,omitempty"`
	UserEmail       string   `json:"userEmail"`
	MovieID         string   `json:"movieId"`
	MovieTitle      string   `json:"movieTitle,omitempty"`
	TheaterID       string   `json:"theaterId,omitempty"`
	TheaterName     string   `json:"theaterName,omitempty"`
	ShowtimeID      string   `json:"showtimeId"`
	ShowtimeLabel   string   `json:"showtimeLabel,omitempty"`
	ShowtimeStartAt string   `json:"showtimeStartAt,omitempty"`
	SeatCode        string   `json:"seatCode,omitempty"`
	SeatCodes       []string `json:"seatCodes"`
	TotalAmount     int64    `json:"totalAmount"`
	Currency        string   `json:"currency"`
	Status          string   `json:"status"`
}

func NewClient(baseURL string) *Client {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(os.Getenv("ORDER_SERVICE_URL")), "/")
	}
	if baseURL == "" {
		return nil
	}
	return &Client{baseURL: baseURL, hc: &http.Client{Timeout: 8 * time.Second}}
}

func (c *Client) Create(ctx context.Context, req CreateOrderRequest) (map[string]any, error) {
	if c == nil { return nil, fmt.Errorf("order client unavailable") }
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/orders", bytes.NewReader(body))
	if err != nil { return nil, err }
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(httpReq)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 { return nil, fmt.Errorf("order create failed: %s", strings.TrimSpace(string(data))) }
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil { return nil, err }
	return out, nil
}
