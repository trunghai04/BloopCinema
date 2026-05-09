package events

import (
	"context"
	"encoding/json"
	"time"

	"booking-service/internal/model"
	"github.com/nats-io/nats.go"
)

type Publisher interface {
	PublishReservationEvent(ctx context.Context, topic string, reservation *model.Reservation) error
}

type NATSPublisher struct {
	conn *nats.Conn
}

func NewNATSPublisher(url string) (*NATSPublisher, error) {
	if url == "" {
		return nil, nil
	}
	conn, err := nats.Connect(url, nats.Name("booking-service"))
	if err != nil {
		return nil, err
	}
	return &NATSPublisher{conn: conn}, nil
}

func (p *NATSPublisher) Close() {
	if p == nil || p.conn == nil {
		return
	}
	p.conn.Close()
}

func (p *NATSPublisher) PublishReservationEvent(ctx context.Context, topic string, reservation *model.Reservation) error {
	if p == nil || p.conn == nil || reservation == nil {
		return nil
	}
	payload := map[string]any{
		"topic":     topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"data":      reservation,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return p.conn.Publish(topic, raw)
}
