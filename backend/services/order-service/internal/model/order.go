package model

import "time"

type Order struct {
	ID              string    `json:"id"`
	UserID          string    `json:"userId"`
	UserEmail       string    `json:"userEmail,omitempty"`
	MovieID         string    `json:"movieId"`
	MovieTitle      string    `json:"movieTitle,omitempty"`
	TheaterID       string    `json:"theaterId,omitempty"`
	TheaterName     string    `json:"theaterName,omitempty"`
	ShowtimeID      string    `json:"showtimeId"`
	ShowtimeLabel   string    `json:"showtimeLabel,omitempty"`
	ShowtimeStartAt time.Time `json:"showtimeStartAt,omitempty"`
	SeatCode        string    `json:"seatCode"`
	SeatCodes       []string  `json:"seatCodes,omitempty"`
	AmountVND       int64     `json:"amountVnd"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type CreateOrderRequest struct {
	ID              string   `json:"id"`
	UserID          string   `json:"userId"`
	UserEmail       string   `json:"userEmail,omitempty"`
	MovieID         string   `json:"movieId"`
	MovieTitle      string   `json:"movieTitle,omitempty"`
	TheaterID       string   `json:"theaterId,omitempty"`
	TheaterName     string   `json:"theaterName,omitempty"`
	ShowtimeID      string   `json:"showtimeId"`
	ShowtimeLabel   string   `json:"showtimeLabel,omitempty"`
	ShowtimeStartAt string   `json:"showtimeStartAt,omitempty"`
	SeatCode        string   `json:"seatCode,omitempty"`
	SeatCodes       []string `json:"seatCodes,omitempty"`
	AmountVND       int64    `json:"amountVnd"`
	TotalAmount     int64    `json:"totalAmount"`
	Status          string   `json:"status"`
}
