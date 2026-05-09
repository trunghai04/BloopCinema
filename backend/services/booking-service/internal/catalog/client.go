package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Showtime struct {
	ID      string `json:"id"`
	MovieID string `json:"movieId"`
	StartAt string `json:"startAt"`
	Hall    string `json:"hall"`
}

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	u := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if u == "" {
		return nil
	}
	return &Client{
		baseURL: u,
		http: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (c *Client) GetShowtime(ctx context.Context, showtimeID string) (*Showtime, error) {
	if c == nil {
		return nil, errors.New("catalog client is nil")
	}
	id := strings.TrimSpace(showtimeID)
	if id == "" {
		return nil, errors.New("showtimeId required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/showtimes", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("catalog showtimes http %d", res.StatusCode)
	}
	var list []Showtime
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		return nil, err
	}
	for i := range list {
		if strings.TrimSpace(list[i].ID) == id {
			return &list[i], nil
		}
	}
	return nil, errors.New("showtime not found")
}

func ParseShowtimeStartAt(raw string) (time.Time, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return time.Time{}, errors.New("startAt required")
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	// fallback for legacy admin input (datetime-local without timezone)
	if t, err := time.ParseInLocation("2006-01-02T15:04", s, time.Local); err == nil {
		return t, nil
	}
	return time.Time{}, errors.New("invalid startAt format")
}

