-- Chạy một lần nếu DB đã tồn tại trước khi có bảng seat_reservations:
-- psql $DATABASE_URL -f database/migrate_seat_reservations.sql

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
);

CREATE INDEX IF NOT EXISTS idx_seat_res_showtime
ON seat_reservations (showtime_id);

CREATE INDEX IF NOT EXISTS idx_seat_res_state_expires
ON seat_reservations (state, hold_expires_at);
