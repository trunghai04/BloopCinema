package repository

import (
	"context"
	"database/sql"
)

// EnsureSchema tạo các bảng/index cần thiết để service chạy ổn định
// trên cả môi trường mới lẫn DB cũ chưa được migrate.
func EnsureSchema(ctx context.Context, db *sql.DB) error {
	const createBookings = `
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  user_email VARCHAR(150) NOT NULL,
  movie_id VARCHAR(50) NOT NULL,
  showtime_id VARCHAR(50) NOT NULL,
  seat_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`

	const createBookingsIndex = `
CREATE INDEX IF NOT EXISTS idx_bookings_movie_showtime
ON bookings (movie_id, showtime_id);`

	const createSeatReservations = `
CREATE TABLE IF NOT EXISTS seat_reservations (
  id VARCHAR(36) PRIMARY KEY,
  user_email VARCHAR(150) NOT NULL,
  movie_id VARCHAR(50) NOT NULL,
  showtime_id VARCHAR(50) NOT NULL,
  seat_codes TEXT NOT NULL,
  state VARCHAR(20) NOT NULL,
  hold_expires_at TIMESTAMPTZ NOT NULL,
  qr_payload TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`

	const createSeatReservationsShowtimeIndex = `
CREATE INDEX IF NOT EXISTS idx_seat_res_showtime
ON seat_reservations (showtime_id);`

	const createSeatReservationsStateIndex = `
CREATE INDEX IF NOT EXISTS idx_seat_res_state_expires
ON seat_reservations (state, hold_expires_at);`

	for _, stmt := range []string{
		createBookings,
		createBookingsIndex,
		createSeatReservations,
		createSeatReservationsShowtimeIndex,
		createSeatReservationsStateIndex,
	} {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}

	return nil
}
