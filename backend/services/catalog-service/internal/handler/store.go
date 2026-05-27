package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
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

CREATE TABLE IF NOT EXISTS catalog_theaters (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_seat_layouts (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_banners (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
	_, err := db.ExecContext(ctx, schema)
	return err
}

func seedCatalogIfEmpty(ctx context.Context, db *sql.DB) error {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("CATALOG_DISABLE_SEED")), "true") {
		return cleanupSeedCatalog(ctx, db)
	}
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
	for _, t := range theaters {
		if err := upsertTheaterDB(ctx, db, t); err != nil {
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

func cleanupSeedCatalog(ctx context.Context, db *sql.DB) error {
	for _, stmt := range []string{
		`DELETE FROM catalog_showtimes WHERE id = ANY($1)`,
		`DELETE FROM catalog_movies WHERE id = ANY($1)`,
		`DELETE FROM catalog_theaters WHERE id = ANY($1)`,
		`DELETE FROM catalog_seat_layouts WHERE id = ANY($1)`,
	} {
		_ = stmt
	}
	seedMovieIDs := []string{"mv001", "mv002", "mv003", "mv004", "mv005", "mv006", "mv007", "mv008"}
	seedShowtimeIDs := []string{"st001", "st002", "st003", "st004", "st005", "st006", "st007", "st008", "st009", "st010", "st011", "st012", "st013", "st014", "st015", "st016", "st017"}
	seedTheaterIDs := []string{"hanoi", "hcm", "danang"}
	seedLayoutIDs := []string{"layout-hn-a", "layout-hn-b", "layout-hcm-a", "layout-dn-a"}
	queries := []struct {
		query string
		ids   []string
	}{
		{`DELETE FROM catalog_showtimes WHERE id = ANY($1)`, seedShowtimeIDs},
		{`DELETE FROM catalog_movies WHERE id = ANY($1)`, seedMovieIDs},
		{`DELETE FROM catalog_theaters WHERE id = ANY($1)`, seedTheaterIDs},
		{`DELETE FROM catalog_seat_layouts WHERE id = ANY($1)`, seedLayoutIDs},
	}
	for _, q := range queries {
		if _, err := db.ExecContext(ctx, q.query, pq.Array(q.ids)); err != nil {
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

func listTheatersDB(ctx context.Context, db *sql.DB) ([]Theater, error) {
	rows, err := db.QueryContext(ctx, `SELECT payload FROM catalog_theaters ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Theater, 0, 8)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var t Theater
		if err := json.Unmarshal(raw, &t); err != nil {
			return nil, err
		}
		out = append(out, t)
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
		if l.Capacity == 0 {
			if len(l.Seats) > 0 {
				l.Capacity = len(l.Seats)
			} else if len(l.Rows) > 0 && l.Cols > 0 {
				l.Capacity = len(l.Rows) * l.Cols
			}
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

func upsertTheaterDB(ctx context.Context, db *sql.DB, item Theater) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_theaters (id, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, item.ID, string(raw))
	return err
}

func listBannersDB(ctx context.Context, db *sql.DB) ([]Banner, error) {
	rows, err := db.QueryContext(ctx, `SELECT payload FROM catalog_banners ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Banner, 0, 8)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var b Banner
		if err := json.Unmarshal(raw, &b); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func upsertBannerDB(ctx context.Context, db *sql.DB, item Banner) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_banners (id, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, item.ID, string(raw))
	return err
}

func deleteBannerDB(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM catalog_banners WHERE id = $1`, id)
	return err
}

func upsertSeatLayoutDB(ctx context.Context, db *sql.DB, item SeatLayout) error {
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	key := item.ID
	if key == "" {
		key = strings.TrimSpace(strings.ToLower(item.TheaterID + "-" + item.Hall))
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO catalog_seat_layouts (id, payload, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
`, key, string(raw))
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

func deleteSeatLayoutDB(ctx context.Context, db *sql.DB, idOrHall string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM catalog_seat_layouts WHERE LOWER(id) = LOWER($1) OR LOWER(COALESCE(payload->>'hall', '')) = LOWER($1)`, idOrHall)
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
