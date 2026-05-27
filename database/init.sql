CREATE DATABASE auth_db;
CREATE DATABASE catalog_db;
CREATE DATABASE booking_db;
CREATE DATABASE order_db;

CREATE ROLE auth_user LOGIN PASSWORD 'auth_service_pw_change_me';
CREATE ROLE catalog_user LOGIN PASSWORD 'catalog_service_pw_change_me';
CREATE ROLE booking_user LOGIN PASSWORD 'booking_service_pw_change_me';
CREATE ROLE order_user LOGIN PASSWORD 'order_service_pw_change_me';

REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM auth_user;
REVOKE CONNECT ON DATABASE postgres FROM catalog_user;
REVOKE CONNECT ON DATABASE postgres FROM booking_user;
REVOKE CONNECT ON DATABASE postgres FROM order_user;

GRANT CONNECT, TEMPORARY ON DATABASE auth_db TO auth_user;
GRANT CONNECT, TEMPORARY ON DATABASE catalog_db TO catalog_user;
GRANT CONNECT, TEMPORARY ON DATABASE booking_db TO booking_user;
GRANT CONNECT, TEMPORARY ON DATABASE order_db TO order_user;

\connect auth_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO auth_user;

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  phone TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  id_number TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  ward TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  bcoins BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE users ADD COLUMN birthday TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id_number'
  ) THEN
    ALTER TABLE users ADD COLUMN id_number TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'province'
  ) THEN
    ALTER TABLE users ADD COLUMN province TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'ward'
  ) THEN
    ALTER TABLE users ADD COLUMN ward TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'address'
  ) THEN
    ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'bcoins'
  ) THEN
    ALTER TABLE users ADD COLUMN bcoins BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

\connect catalog_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO catalog_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO catalog_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO catalog_user;

\connect booking_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO booking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO booking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO booking_user;

\connect order_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO order_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO order_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO order_user;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  movie_id TEXT NOT NULL DEFAULT '',
  movie_title TEXT NOT NULL DEFAULT '',
  theater_id TEXT NOT NULL DEFAULT '',
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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'seat_codes'
  ) THEN
    ALTER TABLE orders ADD COLUMN seat_codes TEXT[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_email TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'movie_title'
  ) THEN
    ALTER TABLE orders ADD COLUMN movie_title TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'theater_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN theater_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'showtime_label'
  ) THEN
    ALTER TABLE orders ADD COLUMN showtime_label TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'showtime_start_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN showtime_start_at TIMESTAMPTZ;
  END IF;
END $$;
