package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"booking-service/internal/model"

	"github.com/google/uuid"
)

type ReservationRepository struct {
	db *sql.DB
}

type SeatStatusPublic struct {
	Holding  []string
	Sold     []string
	Reserved []string
}

func NewReservationRepository(db *sql.DB) *ReservationRepository {
	return &ReservationRepository{db: db}
}

func (r *ReservationRepository) SeatStatusPublic(
	ctx context.Context,
	showtimeID string,
) (*SeatStatusPublic, error) {
	const q = `
	SELECT seat_codes, state
	FROM seat_reservations
	WHERE showtime_id = $1
	AND (
	  (state IN ('hold', 'payment_failed') AND hold_expires_at > NOW())
	  OR state = 'paid'
	)`
	rows, err := r.db.QueryContext(ctx, q, showtimeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	holding := make(map[string]struct{})
	sold := make(map[string]struct{})
	reserved := make(map[string]struct{})

	for rows.Next() {
		var codes, state string
		if err = rows.Scan(&codes, &state); err != nil {
			return nil, err
		}
		seats := parseSeatCodes(codes)
		switch state {
		case model.StatePaid:
			for _, s := range seats {
				sold[s] = struct{}{}
			}
		case model.StateHold:
			for _, s := range seats {
				holding[s] = struct{}{}
			}
		case model.StatePaymentFailed:
			for _, s := range seats {
				reserved[s] = struct{}{}
			}
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Ưu tiên trạng thái cuối: sold > reserved > holding
	for s := range sold {
		delete(reserved, s)
		delete(holding, s)
	}
	for s := range reserved {
		delete(holding, s)
	}

	return &SeatStatusPublic{
		Holding:  keysSorted(holding),
		Sold:     keysSorted(sold),
		Reserved: keysSorted(reserved),
	}, nil
}

func (r *ReservationRepository) OccupiedSeatsPublic(
	ctx context.Context,
	showtimeID string,
) ([]string, error) {
	m, err := r.occupiedSeats(ctx, showtimeID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(m))
	for s := range m {
		out = append(out, s)
	}
	sort.Strings(out)
	return out, nil
}

func (r *ReservationRepository) occupiedSeats(
	ctx context.Context,
	showtimeID string,
) (map[string]struct{}, error) {
	const q = `
	SELECT seat_codes
	FROM seat_reservations
	WHERE showtime_id = $1
	AND (
	  (state IN ('hold', 'payment_failed') AND hold_expires_at > NOW())
	  OR state = 'paid'
	)`
	rows, err := r.db.QueryContext(ctx, q, showtimeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]struct{})
	for rows.Next() {
		var codes string
		if err = rows.Scan(&codes); err != nil {
			return nil, err
		}
		for _, p := range strings.Split(codes, ",") {
			s := strings.TrimSpace(strings.ToUpper(p))
			if s != "" {
				out[s] = struct{}{}
			}
		}
	}
	return out, rows.Err()
}

func (r *ReservationRepository) CreateHold(
	ctx context.Context,
	userEmail, movieID, showtimeID string,
	seats []string,
	holdDuration time.Duration,
) (*model.Reservation, error) {
	if len(seats) == 0 {
		return nil, fmt.Errorf("no seats")
	}
	normalized := normalizeSeats(seats)
	if len(normalized) == 0 {
		return nil, fmt.Errorf("invalid seats")
	}

	occupied, err := r.occupiedSeats(ctx, showtimeID)
	if err != nil {
		return nil, err
	}
	for _, s := range normalized {
		if _, taken := occupied[s]; taken {
			return nil, fmt.Errorf("seat %s not available", s)
		}
	}

	id := uuid.NewString()
	expires := time.Now().UTC().Add(holdDuration)
	codes := strings.Join(normalized, ",")

	const ins = `
	INSERT INTO seat_reservations (
	  id, user_email, movie_id, showtime_id, seat_codes, state, hold_expires_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err = r.db.ExecContext(
		ctx,
		ins,
		id,
		userEmail,
		movieID,
		showtimeID,
		codes,
		model.StateHold,
		expires,
	)
	if err != nil {
		return nil, err
	}
	return &model.Reservation{
		ID:            id,
		UserEmail:     userEmail,
		MovieID:       movieID,
		ShowtimeID:    showtimeID,
		SeatCodes:     codes,
		State:         model.StateHold,
		HoldExpiresAt: expires,
	}, nil
}

func (r *ReservationRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Reservation, error) {
	const q = `
	SELECT id, user_email, movie_id, showtime_id, seat_codes, state,
	       hold_expires_at, COALESCE(qr_payload, '')
	FROM seat_reservations WHERE id = $1`
	row := r.db.QueryRowContext(ctx, q, id)
	var res model.Reservation
	if err := row.Scan(
		&res.ID,
		&res.UserEmail,
		&res.MovieID,
		&res.ShowtimeID,
		&res.SeatCodes,
		&res.State,
		&res.HoldExpiresAt,
		&res.QRPayload,
	); err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *ReservationRepository) Pay(
	ctx context.Context,
	holdID string,
	success bool,
) (*model.Reservation, error) {
	res, err := r.GetByID(ctx, holdID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if res.State == model.StatePaid {
		return res, nil
	}
	if now.After(res.HoldExpiresAt) {
		return nil, fmt.Errorf("hold expired")
	}
	if res.State != model.StateHold && res.State != model.StatePaymentFailed {
		return nil, fmt.Errorf("invalid state for payment")
	}

	if !success {
		const fail = `
		UPDATE seat_reservations SET state = $1
		WHERE id = $2 AND state IN ('hold', 'payment_failed')`
		_, err = r.db.ExecContext(
			ctx,
			fail,
			model.StatePaymentFailed,
			holdID,
		)
		if err != nil {
			return nil, err
		}
		return r.GetByID(ctx, holdID)
	}

	payload := map[string]string{
		"holdId":     holdID,
		"seats":      res.SeatCodes,
		"email":      res.UserEmail,
		"movieId":    res.MovieID,
		"showtimeId": res.ShowtimeID,
		"checkIn":    "BLOOP-CINEMA",
	}
	raw, _ := json.Marshal(payload)
	const ok = `
	UPDATE seat_reservations SET state = $1, qr_payload = $2 WHERE id = $3`
	_, err = r.db.ExecContext(ctx, ok, model.StatePaid, string(raw), holdID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, holdID)
}

func normalizeSeats(seats []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, s := range seats {
		t := strings.TrimSpace(strings.ToUpper(s))
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

func parseSeatCodes(codes string) []string {
	out := make([]string, 0, 8)
	for _, p := range strings.Split(codes, ",") {
		s := strings.TrimSpace(strings.ToUpper(p))
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func keysSorted(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for s := range m {
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}
