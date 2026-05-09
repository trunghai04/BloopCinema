package model

import "time"

const (
	StateHold          = "hold"
	StatePaymentFailed = "payment_failed"
	StatePaid          = "paid"
)

type HoldRequest struct {
	UserEmail  string   `json:"userEmail"`
	MovieID    string   `json:"movieId"`
	ShowtimeID string   `json:"showtimeId"`
	SessionID  string   `json:"sessionId"`
	Seats      []string `json:"seats"`
}

type PayRequest struct {
	HoldID  string `json:"holdId"`
	Success bool   `json:"success"`
}

type Reservation struct {
	ID            string    `json:"id"`
	UserEmail     string    `json:"userEmail"`
	MovieID       string    `json:"movieId"`
	ShowtimeID    string    `json:"showtimeId"`
	SeatCodes     string    `json:"seatCodes"`
	State         string    `json:"state"`
	HoldExpiresAt time.Time `json:"holdExpiresAt"`
	QRPayload     string    `json:"qrPayload,omitempty"`
}
