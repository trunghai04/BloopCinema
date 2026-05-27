package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type profileResponse struct {
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Phone     string    `json:"phone,omitempty"`
	Birthday  string    `json:"birthday,omitempty"`
	IDNumber  string    `json:"idNumber,omitempty"`
	Province  string    `json:"province,omitempty"`
	Ward      string    `json:"ward,omitempty"`
	Address   string    `json:"address,omitempty"`
	Bcoins    int64     `json:"bcoins"`
	CreatedAt time.Time `json:"createdAt"`
}

type updateProfileRequest struct {
	Email           string `json:"email"`
	Name            string `json:"name"`
	Phone           string `json:"phone"`
	Birthday        string `json:"birthday"`
	IDNumber        string `json:"idNumber"`
	Province        string `json:"province"`
	Ward            string `json:"ward"`
	Address         string `json:"address"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type updateProfileResponse struct {
	Message string `json:"message"`
}

type loginResponse struct {
	Token string `json:"token"`
}

var userDB *sql.DB
var jwtSecret []byte

func RegisterRoutes(mux *http.ServeMux, db *sql.DB) {
	userDB = db
	jwtSecret = []byte(strings.TrimSpace(os.Getenv("JWT_SECRET")))
	_ = ensureSchema(context.Background(), userDB)
	_ = ensureBcoinsSchema(context.Background(), userDB)
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/ready", ready)
	mux.HandleFunc("/api/v1/auth/login", login)
	mux.HandleFunc("/api/v1/auth/register", register)
	mux.HandleFunc("/api/v1/users/me", me)
	mux.HandleFunc("/api/v1/users/me/update", updateMe)
}

func health(w http.ResponseWriter, _ *http.Request) {
	status := "ok"
	if userDB != nil {
		if err := userDB.PingContext(context.Background()); err != nil {
			status = "degraded"
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"service": "user-service", "status": status})
}

func ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ready": true})
}

func register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" || req.Name == "" {
		http.Error(w, "email, password and name are required", http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "password hashing failed", http.StatusInternalServerError)
		return
	}
	result, err := userDB.ExecContext(r.Context(), `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'user') ON CONFLICT (email) DO NOTHING`, req.Email, string(hash), req.Name)
	if err != nil {
		http.Error(w, "create user failed", http.StatusInternalServerError)
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		http.Error(w, "email already exists", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"email": req.Email, "name": req.Name})
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
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}
	var passwordHash, role string
	if err := userDB.QueryRowContext(r.Context(), `SELECT password_hash, role FROM users WHERE email = $1`, req.Email).Scan(&passwordHash, &role); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "auth query failed", http.StatusInternalServerError)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
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

func me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	email := strings.TrimSpace(r.URL.Query().Get("email"))
	if email == "" {
		http.Error(w, "email required", http.StatusBadRequest)
		return
	}
	var resp profileResponse
	if err := userDB.QueryRowContext(r.Context(), `SELECT email, name, role, COALESCE(phone, ''), COALESCE(birthday, ''), COALESCE(id_number, ''), COALESCE(province, ''), COALESCE(ward, district, ''), COALESCE(address, ''), created_at FROM users WHERE email = $1`, email).Scan(&resp.Email, &resp.Name, &resp.Role, &resp.Phone, &resp.Birthday, &resp.IDNumber, &resp.Province, &resp.Ward, &resp.Address, &resp.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			fallbackName := strings.Split(email, "@")[0]
			if _, insErr := userDB.ExecContext(r.Context(), `INSERT INTO users (email, password_hash, name, role) VALUES ($1, '', $2, 'user') ON CONFLICT (email) DO NOTHING`, email, fallbackName); insErr != nil {
				http.Error(w, "query failed", http.StatusInternalServerError)
				return
			}
			if err = userDB.QueryRowContext(r.Context(), `SELECT email, name, role, COALESCE(phone, ''), COALESCE(birthday, ''), COALESCE(id_number, ''), COALESCE(province, ''), COALESCE(ward, district, ''), COALESCE(address, ''), created_at FROM users WHERE email = $1`, email).Scan(&resp.Email, &resp.Name, &resp.Role, &resp.Phone, &resp.Birthday, &resp.IDNumber, &resp.Province, &resp.Ward, &resp.Address, &resp.CreatedAt); err != nil {
				http.Error(w, "query failed", http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
	}
	resp.Bcoins = 0
	if err := dbGetBcoins(r.Context(), userDB, email, &resp.Bcoins); err != nil {
		resp.Bcoins = 0
	}
	writeJSON(w, http.StatusOK, resp)
}

func updateMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Birthday = strings.TrimSpace(req.Birthday)
	req.IDNumber = strings.TrimSpace(req.IDNumber)
	req.Province = strings.TrimSpace(req.Province)
	req.Ward = strings.TrimSpace(req.Ward)
	req.Address = strings.TrimSpace(req.Address)
	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = strings.Split(req.Email, "@")[0]
	}
	if req.NewPassword != "" && req.CurrentPassword == "" {
		http.Error(w, "current password is required", http.StatusBadRequest)
		return
	}
	if req.NewPassword != "" {
		var passwordHash string
		if err := userDB.QueryRowContext(r.Context(), `SELECT password_hash FROM users WHERE email = $1`, req.Email).Scan(&passwordHash); err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword)) != nil {
			http.Error(w, "current password is incorrect", http.StatusUnauthorized)
			return
		}
	}
	updates := []string{"name=$2", "phone=$3", "birthday=$4", "id_number=$5", "province=$6", "ward=$7", "address=$8"}
	args := []any{req.Email, req.Name, req.Phone, req.Birthday, req.IDNumber, req.Province, req.Ward, req.Address}
	if req.NewPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "password hashing failed", http.StatusInternalServerError)
			return
		}
		updates = append(updates, "password_hash=$9")
		args = append(args, string(hash))
	}
	query := "UPDATE users SET " + strings.Join(updates, ", ") + " WHERE email = $1"
	result, err := userDB.ExecContext(r.Context(), query, args...)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updateProfileResponse{Message: "updated"})
}

func ensureSchema(ctx context.Context, db *sql.DB) error {
	const schema = `
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
  district TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  bcoins BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ward TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bcoins BIGINT NOT NULL DEFAULT 0;`
	_, err := db.ExecContext(ctx, schema)
	return err
}

func ensureBcoinsSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS user_bcoins (
  email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
  bcoins BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO user_bcoins (email, bcoins)
SELECT email, 0 FROM users
ON CONFLICT (email) DO NOTHING;
`)
	return err
}

func dbGetBcoins(ctx context.Context, db *sql.DB, email string, out *int64) error {
	return db.QueryRowContext(ctx, `SELECT bcoins FROM user_bcoins WHERE email = $1`, email).Scan(out)
}

func issueJWT(email, role string) (string, error) {
	if len(jwtSecret) == 0 {
		return "", errors.New("missing jwt secret")
	}
	now := time.Now().UTC()
	claims := jwt.MapClaims{"sub": email, "role": role, "iat": now.Unix(), "exp": now.Add(2 * time.Hour).Unix()}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
