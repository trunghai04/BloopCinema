package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string `json:"token"`
}

var authDB *sql.DB
var jwtSecret []byte

func RegisterRoutes(mux *http.ServeMux, db *sql.DB, tokenSecret string) {
	authDB = db
	jwtSecret = []byte(strings.TrimSpace(tokenSecret))
	_ = ensureAuthSchema(context.Background(), authDB)
	_ = seedAuthUsers(context.Background(), authDB)
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/ready", ready)
	mux.HandleFunc("/api/v1/auth/login", login)
	mux.HandleFunc("/api/v1/auth/admin-login", login)
}

func health(w http.ResponseWriter, _ *http.Request) {
	status := "ok"
	if authDB != nil {
		if err := authDB.PingContext(context.Background()); err != nil {
			status = "degraded"
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"service": "auth-service",
		"status":  status,
	})
}

func ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"ready": true,
	})
}

func login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	ok, role, err := verifyUser(r.Context(), authDB, req.Email, req.Password)
	if err != nil {
		http.Error(w, "auth query failed", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := issueJWT(req.Email, role)
	if err != nil {
		http.Error(w, "token generation failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{Token: token})
}

func ensureAuthSchema(ctx context.Context, db *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS auth_users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
	_, err := db.ExecContext(ctx, schema)
	return err
}

func seedAuthUsers(ctx context.Context, db *sql.DB) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	const seed = `
INSERT INTO auth_users (email, password_hash, role)
VALUES ('admin@bloop.local', $1, 'admin')
ON CONFLICT (email) DO NOTHING;`
	if _, err := db.ExecContext(ctx, seed, string(passwordHash)); err != nil {
		return err
	}
	
	secondPasswordHash, err := bcrypt.GenerateFromPassword([]byte("Dangtrunghai2402@"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	const seedSecondAdmin = `
INSERT INTO auth_users (email, password_hash, role)
VALUES ('thiptit2004@gmail.com', $1, 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;`
	if _, err := db.ExecContext(ctx, seedSecondAdmin, string(secondPasswordHash)); err != nil {
		return err
	}

	// Backward-compatible migration: upgrade legacy plaintext seeded password.
	_, err = db.ExecContext(
		ctx,
		`UPDATE auth_users SET password_hash = $1 WHERE email = 'admin@bloop.local' AND password_hash NOT LIKE '$2%'`,
		string(passwordHash),
	)
	return err
}

func verifyUser(ctx context.Context, db *sql.DB, email, password string) (bool, string, error) {
	var passwordHash string
	var role string
	err := db.QueryRowContext(ctx, `SELECT password_hash, role FROM auth_users WHERE email = $1`, email).Scan(&passwordHash, &role)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return false, "", nil
	}
	return true, role, nil
}

func issueJWT(email, role string) (string, error) {
	if len(jwtSecret) == 0 {
		return "", errors.New("missing jwt secret")
	}
	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"sub":  email,
		"role": role,
		"iat":  now.Unix(),
		"exp":  now.Add(2 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
