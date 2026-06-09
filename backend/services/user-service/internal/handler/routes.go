package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/smtp"
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
	mux.HandleFunc("/api/v1/auth/verify-otp", verifyOTP)
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

	// 1. Check if email already exists in users table with a valid password
	var exists bool
	err := userDB.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND password_hash <> '')`, req.Email).Scan(&exists)
	if err != nil {
		http.Error(w, "database query failed", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "email already exists", http.StatusConflict)
		return
	}

	// 2. Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "password hashing failed", http.StatusInternalServerError)
		return
	}

	// 3. Generate OTP
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	otp := fmt.Sprintf("%06d", n.Int64()+100000)
	expiresAt := time.Now().Add(5 * time.Minute)

	// 4. Save to pending_registrations
	_, err = userDB.ExecContext(r.Context(), `
INSERT INTO pending_registrations (email, password_hash, name, otp, expires_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  otp = EXCLUDED.otp,
  expires_at = EXCLUDED.expires_at
`, req.Email, string(hash), req.Name, otp, expiresAt)
	if err != nil {
		http.Error(w, "save pending registration failed", http.StatusInternalServerError)
		return
	}

	// 5. Send OTP Email in a background goroutine to prevent gateway timeouts
	go func(emailVal, otpVal string) {
		ctx := context.Background()
		if err := sendOTPEmail(ctx, emailVal, otpVal); err != nil {
			fmt.Printf("Error sending OTP email to %s: %v\n", emailVal, err)
		} else {
			fmt.Printf("Successfully sent OTP email to %s\n", emailVal)
		}
	}(req.Email, otp)

	writeJSON(w, http.StatusOK, map[string]string{"message": "otp_sent", "email": req.Email})
}

func sendOTPEmail(ctx context.Context, to string, otp string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if host == "" || from == "" {
		fmt.Printf("SMTP NOT CONFIGURED. OTP for %s is %s\n", to, otp)
		return nil
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	addr := net.JoinHostPort(host, port)

	body := fmt.Sprintf(`To: %s
From: %s
Subject: Ma xac thuc OTP - Bloop Cinema
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e3e3e3;">
    <h2 style="color: #4f46e5; text-align: center;">Xac thuc email cua ban</h2>
    <p>Chao mung ban den voi Bloop Cinema. Vui long su dung ma OTP duoi day de hoan tat qua trinh dang ky tai khoan:</p>
    <div style="font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 30px 0; color: #4f46e5;">%s</div>
    <p>Ma OTP nay co hieu luc trong 5 phut. Vui long khong chia se ma nay voi bat ky ai.</p>
    <p style="font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; padding-top: 20px;">Day la email tu dong, vui long khong tra loi.</p>
  </div>
</body>
</html>
`, to, from, otp)

	var auth smtp.Auth
	if user != "" && pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(body)); err != nil {
		return err
	}
	return nil
}

type verifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

func verifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req verifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.OTP = strings.TrimSpace(req.OTP)
	if req.Email == "" || req.OTP == "" {
		http.Error(w, "email and otp are required", http.StatusBadRequest)
		return
	}

	var passwordHash, name, correctOTP string
	var expiresAt time.Time
	err := userDB.QueryRowContext(r.Context(), `
SELECT password_hash, name, otp, expires_at
FROM pending_registrations
WHERE email = $1
`, req.Email).Scan(&passwordHash, &name, &correctOTP, &expiresAt)
	if err == sql.ErrNoRows {
		http.Error(w, "no pending registration found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "database query failed", http.StatusInternalServerError)
		return
	}

	if time.Now().After(expiresAt) {
		http.Error(w, "OTP has expired", http.StatusBadRequest)
		return
	}

	if req.OTP != correctOTP {
		http.Error(w, "incorrect OTP", http.StatusBadRequest)
		return
	}

	// Insert into users or update if it exists as a skeleton row
	_, err = userDB.ExecContext(r.Context(), `
INSERT INTO users (email, password_hash, name, role)
VALUES ($1, $2, $3, 'user')
ON CONFLICT (email) DO UPDATE SET
	password_hash = EXCLUDED.password_hash,
	name = EXCLUDED.name,
	role = 'user'
`, req.Email, passwordHash, name)
	if err != nil {
		http.Error(w, "create user failed", http.StatusInternalServerError)
		return
	}

	// Insert or update bcoins account
	_, _ = userDB.ExecContext(r.Context(), `
INSERT INTO user_bcoins (email, bcoins)
VALUES ($1, 0)
ON CONFLICT (email) DO NOTHING
`, req.Email)

	// Delete from pending_registrations
	_, _ = userDB.ExecContext(r.Context(), `DELETE FROM pending_registrations WHERE email = $1`, req.Email)

	writeJSON(w, http.StatusCreated, map[string]string{"email": req.Email, "name": name})
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS bcoins BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pending_registrations (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);`
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
