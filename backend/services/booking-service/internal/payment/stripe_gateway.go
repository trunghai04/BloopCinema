package payment

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/stripe/stripe-go/v81"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"

	"booking-service/internal/model"
	"booking-service/internal/repository"
)

// Gateway tạo Stripe Checkout Session và xác nhận thanh toán (redirect hoặc webhook).
type Gateway struct {
	Repo            *repository.ReservationRepository
	PricePerSeatVND int64
	WebhookSecret   string
}

func NewGateway(
	secretKey string,
	webhookSecret string,
	pricePerSeatVND int64,
	repo *repository.ReservationRepository,
) *Gateway {
	if strings.TrimSpace(secretKey) == "" {
		return nil
	}
	stripe.Key = strings.TrimSpace(secretKey)
	if pricePerSeatVND <= 0 {
		pricePerSeatVND = 90000
	}
	return &Gateway{
		Repo:            repo,
		PricePerSeatVND: pricePerSeatVND,
		WebhookSecret:   strings.TrimSpace(webhookSecret),
	}
}

func (g *Gateway) validateActiveHold(ctx context.Context, holdID string) (*model.Reservation, error) {
	res, err := g.Repo.GetByID(ctx, holdID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if now.After(res.HoldExpiresAt) {
		return nil, fmt.Errorf("hold expired")
	}
	if res.State == model.StatePaid {
		return nil, fmt.Errorf("already paid")
	}
	if res.State != model.StateHold && res.State != model.StatePaymentFailed {
		return nil, fmt.Errorf("invalid reservation state")
	}
	return res, nil
}

func seatQuantity(seatCodes string) int64 {
	n := int64(0)
	for _, p := range strings.Split(seatCodes, ",") {
		if strings.TrimSpace(p) != "" {
			n++
		}
	}
	if n < 1 {
		return 1
	}
	return n
}

// CreateCheckoutSession trả về URL redirect tới Stripe Checkout.
func (g *Gateway) CreateCheckoutSession(
	ctx context.Context,
	holdID, successURL, cancelURL string,
) (checkoutURL string, err error) {
	res, err := g.validateActiveHold(ctx, holdID)
	if err != nil {
		return "", err
	}
	qty := seatQuantity(res.SeatCodes)
	params := &stripe.CheckoutSessionParams{
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata: map[string]string{
			"hold_id": holdID,
		},
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Quantity: stripe.Int64(qty),
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String("vnd"),
					UnitAmount: stripe.Int64(g.PricePerSeatVND),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String("Vé xem phim · Bloop Cinema"),
						Description: stripe.String("Ghế: " + res.SeatCodes),
					},
				},
			},
		},
	}
	sess, err := checkoutsession.New(params)
	if err != nil {
		return "", err
	}
	if sess.URL == "" {
		return "", fmt.Errorf("stripe returned empty checkout url")
	}
	return sess.URL, nil
}

// ConfirmCheckoutSession đọc phiên Stripe sau redirect; idempotent với Pay đã paid.
func (g *Gateway) ConfirmCheckoutSession(ctx context.Context, sessionID string) (*model.Reservation, error) {
	sess, err := checkoutsession.Get(sessionID, nil)
	if err != nil {
		return nil, err
	}
	holdID := strings.TrimSpace(sess.Metadata["hold_id"])
	if holdID == "" {
		return nil, fmt.Errorf("missing hold_id in session metadata")
	}
	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		return nil, fmt.Errorf("checkout not paid yet")
	}
	return g.Repo.Pay(ctx, holdID, true)
}
