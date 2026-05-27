package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

type Order struct {
	ID              string     `json:"id"`
	UserID          string     `json:"userId"`
	UserEmail       string     `json:"userEmail,omitempty"`
	MovieID         string     `json:"movieId"`
	MovieTitle      string     `json:"movieTitle,omitempty"`
	TheaterID       string     `json:"theaterId,omitempty"`
	TheaterName     string     `json:"theaterName,omitempty"`
	ShowtimeID      string     `json:"showtimeId"`
	ShowtimeLabel   string     `json:"showtimeLabel,omitempty"`
	ShowtimeStartAt *time.Time `json:"showtimeStartAt,omitempty"`
	SeatCode        string     `json:"seatCode"`
	SeatCodes       []string   `json:"seatCodes,omitempty"`
	AmountVND       int64      `json:"amountVnd"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

func New(db *sql.DB) *Repository { return &Repository{db: db} }

func EnsureSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS orders (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	user_email TEXT NOT NULL DEFAULT '',
	movie_id TEXT NOT NULL DEFAULT '',
	movie_title TEXT NOT NULL DEFAULT '',
	theater_id TEXT NOT NULL DEFAULT '',
	theater_name TEXT NOT NULL DEFAULT '',
	showtime_id TEXT NOT NULL DEFAULT '',
	showtime_label TEXT NOT NULL DEFAULT '',
	showtime_start_at TIMESTAMPTZ,
	seat_code TEXT NOT NULL DEFAULT '',
	seat_codes TEXT[] NOT NULL DEFAULT '{}',
	amount_vnd BIGINT NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pending',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_showtime_id ON orders(showtime_id);
CREATE INDEX IF NOT EXISTS idx_orders_movie_id ON orders(movie_id);
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_email') THEN
		ALTER TABLE orders ADD COLUMN user_email TEXT NOT NULL DEFAULT '';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'movie_title') THEN
		ALTER TABLE orders ADD COLUMN movie_title TEXT NOT NULL DEFAULT '';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'theater_id') THEN
		ALTER TABLE orders ADD COLUMN theater_id TEXT NOT NULL DEFAULT '';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'theater_name') THEN
		ALTER TABLE orders ADD COLUMN theater_name TEXT NOT NULL DEFAULT '';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'showtime_label') THEN
		ALTER TABLE orders ADD COLUMN showtime_label TEXT NOT NULL DEFAULT '';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'showtime_start_at') THEN
		ALTER TABLE orders ADD COLUMN showtime_start_at TIMESTAMPTZ;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'seat_codes') THEN
		ALTER TABLE orders ADD COLUMN seat_codes TEXT[] NOT NULL DEFAULT '{}';
	END IF;
END $$;
`)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
UPDATE orders
SET amount_vnd = GREATEST(COALESCE(NULLIF(array_length(seat_codes, 1), 0), 1), 1) * 50000,
	updated_at = NOW()
WHERE amount_vnd IS NULL OR amount_vnd <= 0;
`)
	return err
}

func (r *Repository) Create(ctx context.Context, o Order) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO orders (id, user_id, user_email, movie_id, movie_title, theater_id, theater_name, showtime_id, showtime_label, showtime_start_at, seat_code, seat_codes, amount_vnd, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
`, o.ID, o.UserID, o.UserEmail, o.MovieID, o.MovieTitle, o.TheaterID, o.TheaterName, o.ShowtimeID, o.ShowtimeLabel, o.ShowtimeStartAt, o.SeatCode, pq.Array(o.SeatCodes), o.AmountVND, o.Status, o.CreatedAt, o.UpdatedAt)
	return err
}

func (r *Repository) ListByUser(ctx context.Context, userID string) ([]Order, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, user_id, user_email, movie_id, movie_title, theater_id, theater_name, showtime_id, showtime_label, showtime_start_at, seat_code, seat_codes, amount_vnd, status, created_at, updated_at
FROM orders
WHERE user_id = $1 OR user_email = $1
ORDER BY created_at DESC
`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrders(rows)
}

func (r *Repository) ListAll(ctx context.Context) ([]Order, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, user_id, user_email, movie_id, movie_title, theater_id, theater_name, showtime_id, showtime_label, showtime_start_at, seat_code, seat_codes, amount_vnd, status, created_at, updated_at
FROM orders
ORDER BY created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrders(rows)
}

func scanOrders(rows *sql.Rows) ([]Order, error) {
	items := make([]Order, 0)
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.UserEmail, &o.MovieID, &o.MovieTitle, &o.TheaterID, &o.TheaterName, &o.ShowtimeID, &o.ShowtimeLabel, &o.ShowtimeStartAt, &o.SeatCode, pq.Array(&o.SeatCodes), &o.AmountVND, &o.Status, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id string) (Order, error) {
	var o Order
	err := r.db.QueryRowContext(ctx, `
SELECT id, user_id, user_email, movie_id, movie_title, theater_id, theater_name, showtime_id, showtime_label, showtime_start_at, seat_code, seat_codes, amount_vnd, status, created_at, updated_at
FROM orders
WHERE id = $1
`, id).Scan(&o.ID, &o.UserID, &o.UserEmail, &o.MovieID, &o.MovieTitle, &o.TheaterID, &o.TheaterName, &o.ShowtimeID, &o.ShowtimeLabel, &o.ShowtimeStartAt, &o.SeatCode, pq.Array(&o.SeatCodes), &o.AmountVND, &o.Status, &o.CreatedAt, &o.UpdatedAt)
	return o, err
}

func (r *Repository) UpdateStatus(ctx context.Context, id, status string) error {
	res, err := r.db.ExecContext(ctx, `
UPDATE orders
SET status = $2, updated_at = NOW()
WHERE id = $1
`, id, status)
	if err != nil {
		return err
	}
	count, _ := res.RowsAffected()
	if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}
