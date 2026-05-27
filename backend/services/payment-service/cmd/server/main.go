package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"payment-service/internal/handler"
)

func main() {
	port := os.Getenv("SERVICE_PORT")
	if port == "" {
		port = "8085"
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	shutdownTimeout := 10 * time.Second

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	mux.Handle("/metrics", promhttp.Handler())

	metrics := newHTTPMetrics("payment_service")
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           withHTTPMiddleware(mux, logger, metrics),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		logger.Info("payment-service starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("payment-service failed", "error", err.Error())
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	_ = server.Shutdown(ctx)
	logger.Info("payment-service stopped")
}

type statusRecorder struct { http.ResponseWriter; status int }
func (r *statusRecorder) WriteHeader(code int) { r.status = code; r.ResponseWriter.WriteHeader(code) }

type httpMetrics struct { total *prometheus.CounterVec; duration *prometheus.HistogramVec }
func newHTTPMetrics(service string) *httpMetrics {
	total := prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: "bloop", Subsystem: service, Name: "http_requests_total", Help: "Total HTTP requests by service, method, path, and status."}, []string{"method", "path", "status"})
	duration := prometheus.NewHistogramVec(prometheus.HistogramOpts{Namespace: "bloop", Subsystem: service, Name: "http_request_duration_seconds", Help: "HTTP request duration by service, method, and path.", Buckets: prometheus.DefBuckets}, []string{"method", "path"})
	prometheus.MustRegister(total, duration)
	return &httpMetrics{total: total, duration: duration}
}
func withHTTPMiddleware(next http.Handler, logger *slog.Logger, metrics *httpMetrics) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := strings.TrimSpace(r.Header.Get("X-Request-ID")); if reqID == "" { reqID = time.Now().UTC().Format("20060102150405.000000000") }
		w.Header().Set("X-Request-ID", reqID)
		start := time.Now(); rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		defer func(){ if recErr:=recover(); recErr!=nil { logger.Error("panic recovered", "request_id", reqID, "panic", recErr); http.Error(rec, "internal server error", http.StatusInternalServerError) }
			path := routeLabel(r.URL.Path); metrics.total.WithLabelValues(r.Method, path, http.StatusText(rec.status)).Inc(); metrics.duration.WithLabelValues(r.Method, path).Observe(time.Since(start).Seconds())
			logger.Info("http_request", "request_id", reqID, "method", r.Method, "path", r.URL.Path, "status", rec.status, "client_ip", readClientIP(r), "duration_ms", time.Since(start).Milliseconds()) }()
		next.ServeHTTP(rec, r)
	})
}
func routeLabel(path string) string { switch { case strings.HasPrefix(path, "/api/v1/payments"): return "/api/v1/payments/*"; case strings.HasPrefix(path, "/health"): return "/health"; case strings.HasPrefix(path, "/ready"): return "/ready"; case strings.HasPrefix(path, "/metrics"): return "/metrics"; default: return "other" } }
func readClientIP(r *http.Request) string { xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); if xff != "" { parts := strings.Split(xff, ","); return strings.TrimSpace(parts[0]) }; ip, _, err := net.SplitHostPort(r.RemoteAddr); if err != nil { return r.RemoteAddr }; return ip }
