package model

import "time"

type Booking struct {
	ID         string    `json:"id"`
	UserEmail  string    `json:"userEmail"`
	MovieID    string    `json:"movieId"`
	ShowtimeID string    `json:"showtimeId"`
	SeatCode   string    `json:"seatCode"`
	SeatCodes  []string  `json:"seatCodes,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

type CreateBookingRequest struct {
	UserEmail  string   `json:"userEmail"`
	MovieID    string   `json:"movieId"`
	ShowtimeID string   `json:"showtimeId"`
	SeatCode   string   `json:"seatCode"`
	SeatCodes  []string `json:"seatCodes,omitempty"`
}
