package repository

import (
	"context"
	"database/sql"

	"booking-service/internal/model"
)

type BookingRepository struct {
	db *sql.DB
}

func NewBookingRepository(db *sql.DB) *BookingRepository {
	return &BookingRepository{db: db}
}

func (r *BookingRepository) Create(
	ctx context.Context,
	booking model.Booking,
) error {
	const query = `
	INSERT INTO bookings (
	  id,
	  user_email,
	  movie_id,
	  showtime_id,
	  seat_code,
	  created_at
	)
	VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := r.db.ExecContext(
		ctx,
		query,
		booking.ID,
		booking.UserEmail,
		booking.MovieID,
		booking.ShowtimeID,
		booking.SeatCode,
		booking.CreatedAt,
	)
	return err
}

func (r *BookingRepository) List(ctx context.Context) ([]model.Booking, error) {
	const query = `
	SELECT id, user_email, movie_id, showtime_id, seat_code, created_at
	FROM bookings
	ORDER BY created_at DESC
	LIMIT 50`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bookings := make([]model.Booking, 0, 50)
	for rows.Next() {
		var b model.Booking
		if err = rows.Scan(
			&b.ID,
			&b.UserEmail,
			&b.MovieID,
			&b.ShowtimeID,
			&b.SeatCode,
			&b.CreatedAt,
		); err != nil {
			return nil, err
		}
		bookings = append(bookings, b)
	}
	return bookings, rows.Err()
}
