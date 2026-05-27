package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Movie struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type Showtime struct {
	ID        string `json:"id"`
	MovieID   string `json:"movieId"`
	StartAt   string `json:"startAt"`
	Hall      string `json:"hall"`
	TheaterID string `json:"theaterId"`
}

type Theater struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	City string `json:"city"`
	Code string `json:"code"`
}

type SeatPrices struct {
	Standard int `json:"standard"`
	VIP      int `json:"vip"`
	Couple   int `json:"couple"`
}

type SeatNode struct {
	Code string `json:"code"`
	Type string `json:"type"`
}

type SeatLayout struct {
	ID           string     `json:"id"`
	TheaterID    string     `json:"theaterId"`
	Hall         string     `json:"hall"`
	Rows         []string   `json:"rows"`
	Cols         int        `json:"cols"`
	Capacity     int        `json:"capacity"`
	BlockedSeats []string   `json:"blockedSeats"`
	SeatPrices   SeatPrices `json:"seatPrices"`
	Seats        []SeatNode `json:"seats"`
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

func (c *Client) GetMovie(ctx context.Context, movieID string) (*Movie, error) {
	if c == nil {
		return nil, errors.New("catalog client is nil")
	}
	id := strings.TrimSpace(movieID)
	if id == "" {
		return nil, errors.New("movieId required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/movies", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("catalog movies http %d", res.StatusCode)
	}
	var list []Movie
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		return nil, err
	}
	for i := range list {
		if strings.TrimSpace(list[i].ID) == id {
			return &list[i], nil
		}
	}
	return nil, errors.New("movie not found")
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

func (c *Client) GetTheater(ctx context.Context, theaterID string) (*Theater, error) {
	if c == nil {
		return nil, errors.New("catalog client is nil")
	}
	id := strings.TrimSpace(theaterID)
	if id == "" {
		return nil, errors.New("theaterId required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/theaters", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("catalog theaters http %d", res.StatusCode)
	}
	var list []Theater
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		return nil, err
	}
	for i := range list {
		if strings.EqualFold(strings.TrimSpace(list[i].ID), id) {
			return &list[i], nil
		}
	}
	return nil, errors.New("theater not found")
}

func (c *Client) GetSeatLayoutByHall(ctx context.Context, theaterID, hall string) (*SeatLayout, error) {
	if c == nil {
		return nil, errors.New("catalog client is nil")
	}
	q := url.Values{}
	if theaterID = strings.TrimSpace(theaterID); theaterID != "" {
		q.Set("theaterId", theaterID)
	}
	if hall = strings.TrimSpace(hall); hall != "" {
		q.Set("hall", hall)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/admin/seat-layouts?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("catalog seat layouts http %d", res.StatusCode)
	}
	var list []SeatLayout
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		return nil, err
	}
	for i := range list {
		if strings.EqualFold(strings.TrimSpace(list[i].TheaterID), strings.TrimSpace(theaterID)) && strings.EqualFold(strings.TrimSpace(list[i].Hall), strings.TrimSpace(hall)) {
			return &list[i], nil
		}
	}
	for i := range list {
		if strings.EqualFold(strings.TrimSpace(list[i].Hall), strings.TrimSpace(hall)) {
			return &list[i], nil
		}
	}
	return nil, errors.New("seat layout not found")
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

