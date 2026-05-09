package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

func ensureCatalogSchema(ctx context.Context, db *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS catalog_movies (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_showtimes (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_seat_layouts (
  hall TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
	_, err := db.ExecContext(ctx, schema)
	return err
}

func seedCatalogIfEmpty(ctx context.Context, db *sql.DB) error {
	var movieCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(1) FROM catalog_movies`).Scan(&movieCount); err != nil {
		return err
	}
	if movieCount > 0 {
		return nil
	}
	for _, m := range movies {
		if err := upsertMovieDB(ctx, db, m); err != nil {
			return err
		}
	}
	for _, s := range showtimes {
		if err := upsertShowtimeDB(ctx, db, s); err != nil {
			return err
		}
	}
	for _, l := range seatLayouts {
		if err := upsertSeatLayoutDB(ctx, db, l); err != nil {
			return err
		}
	}
	return nil
}

func listMoviesDB(ctx context.Context, db *sql.DB) ([]Movie, error) {
	rows, err := db.QueryContext(ctx, `SELECT payload FROM catalog_movies ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Movie, 0, 16)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var m Movie
		if err := json.Unmarshal(raw, &m); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func listShowtimesDB(ctx context.Context, db *sql.DB) ([]Showtime, error) {
	rows, err := db.QueryContext(ctx, `SELECT payload FROM catalog_showtimes ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Showtime, 0, 16)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var s Showtime
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func listSeatLayoutsDB(ctx context.Context, db *sql.DB) ([]SeatLayout, error) {
	rows, err := db.QueryContext(ctx, `SELECT payload FROM catalog_seat_layouts ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]SeatLayout, 0, 8)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var l SeatLayout
		if err := json.Unmarshal(raw, &l); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func upsertMovieDB(ctx context.Context, db *sql.DB, item Movie) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_movies (id, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, item.ID, string(raw))
	return err
}

func upsertShowtimeDB(ctx context.Context, db *sql.DB, item Showtime) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_showtimes (id, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, item.ID, string(raw))
	return err
}

func upsertSeatLayoutDB(ctx context.Context, db *sql.DB, item SeatLayout) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_seat_layouts (hall, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (hall) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, item.Hall, string(raw))
	return err
}

func deleteMovieDB(ctx context.Context, db *sql.DB, id string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `DELETE FROM catalog_movies WHERE id = $1`, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM catalog_showtimes WHERE (payload->>'movieId') = $1`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func deleteShowtimeDB(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM catalog_showtimes WHERE id = $1`, id)
	return err
}

func deleteSeatLayoutDB(ctx context.Context, db *sql.DB, hall string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM catalog_seat_layouts WHERE LOWER(hall) = LOWER($1)`, hall)
	return err
}

func pingDB(ctx context.Context, db *sql.DB) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("catalog db ping: %w", err)
	}
	return nil
}
