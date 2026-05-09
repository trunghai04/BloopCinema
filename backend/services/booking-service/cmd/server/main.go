package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"

	"booking-service/internal/events"
	"booking-service/internal/handler"
	"booking-service/internal/payment"
	"booking-service/internal/repository"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
	port := os.Getenv("SERVICE_PORT")
	if port == "" {
		port = "8083"
	}
	shutdownTimeout := 12 * time.Second
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	tp, err := initTracerProvider(context.Background(), "booking-service", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if err != nil {
		logger.Error("init otel failed", "error", err.Error())
		os.Exit(1)
	}
	if tp != nil {
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = tp.Shutdown(ctx)
		}()
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		logger.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		logger.Error("open database failed", "error", err.Error())
		os.Exit(1)
	}
	defer db.Close()

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		logger.Error("database ping failed", "error", err.Error())
		os.Exit(1)
	}

	schemaCtx, schemaCancel := context.WithTimeout(context.Background(), 8*time.Second)
	if err = repository.EnsureSchema(schemaCtx, db); err != nil {
		schemaCancel()
		logger.Error("ensure database schema failed", "error", err.Error())
		os.Exit(1)
	}
	schemaCancel()

	repo := repository.NewBookingRepository(db)
	resRepo := repository.NewReservationRepository(db)
	natsPublisher, err := events.NewNATSPublisher(strings.TrimSpace(os.Getenv("NATS_URL")))
	if err != nil {
		logger.Error("connect nats failed", "error", err.Error())
		os.Exit(1)
	}
	if natsPublisher != nil {
		defer natsPublisher.Close()
	}

	pricePerSeat := int64(90000)
	if v := strings.TrimSpace(os.Getenv("TICKET_PRICE_PER_SEAT_VND")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			pricePerSeat = n
		}
	}
	stripeGW := payment.NewGateway(
		os.Getenv("STRIPE_SECRET_KEY"),
		os.Getenv("STRIPE_WEBHOOK_SECRET"),
		pricePerSeat,
		resRepo,
	)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, repo)
	handler.RegisterReservationRoutes(mux, resRepo, natsPublisher)
	handler.RegisterStripePaymentRoutes(mux, stripeGW)
	mux.Handle("/metrics", promhttp.Handler())
	metrics := newHTTPMetrics("booking_service")

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(withHTTPMiddleware(mux, logger, metrics), "booking-http"),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      12 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		logger.Info("booking-service starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			logger.Error("booking-service failed", "error", err.Error())
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	_ = server.Shutdown(ctx)
	logger.Info("booking-service stopped")
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

type httpMetrics struct {
	total    *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func newHTTPMetrics(service string) *httpMetrics {
	total := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "bloop",
			Subsystem: service,
			Name:      "http_requests_total",
			Help:      "Total HTTP requests by service, method, path, and status.",
		},
		[]string{"method", "path", "status"},
	)
	duration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "bloop",
			Subsystem: service,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration by service, method, and path.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
	prometheus.MustRegister(total, duration)
	return &httpMetrics{total: total, duration: duration}
}

func withHTTPMiddleware(next http.Handler, logger *slog.Logger, metrics *httpMetrics) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if reqID == "" {
			reqID = time.Now().UTC().Format("20060102150405.000000000")
		}
		w.Header().Set("X-Request-ID", reqID)

		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			if recErr := recover(); recErr != nil {
				logger.Error("panic recovered", "request_id", reqID, "panic", recErr)
				http.Error(rec, "internal server error", http.StatusInternalServerError)
			}
			path := routeLabel(r.URL.Path)
			metrics.total.WithLabelValues(r.Method, path, http.StatusText(rec.status)).Inc()
			metrics.duration.WithLabelValues(r.Method, path).Observe(time.Since(start).Seconds())
			logger.Info(
				"http_request",
				"request_id", reqID,
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"client_ip", readClientIP(r),
				"duration_ms", time.Since(start).Milliseconds(),
			)
		}()

		next.ServeHTTP(rec, r)
	})
}

func routeLabel(path string) string {
	if strings.HasPrefix(path, "/api/v1/bookings") {
		return "/api/v1/bookings"
	}
	if strings.HasPrefix(path, "/api/v1/reservations/stripe") {
		return "/api/v1/reservations/stripe/*"
	}
	if strings.HasPrefix(path, "/api/v1/reservations") {
		return "/api/v1/reservations/*"
	}
	if strings.HasPrefix(path, "/health") {
		return "/health"
	}
	if strings.HasPrefix(path, "/ready") {
		return "/ready"
	}
	if strings.HasPrefix(path, "/metrics") {
		return "/metrics"
	}
	return "other"
}

func readClientIP(r *http.Request) string {
	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
