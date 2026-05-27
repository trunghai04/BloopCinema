package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"

	"order-service/internal/handler"
	"order-service/internal/repository"
)

func main() {
	port := os.Getenv("SERVICE_PORT")
	if port == "" {
		port = "8086"
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	shutdownTimeout := 10 * time.Second

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
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

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		logger.Error("database ping failed", "error", err.Error())
		os.Exit(1)
	}

	if err = repository.EnsureSchema(context.Background(), db); err != nil {
		logger.Error("ensure schema failed", "error", err.Error())
		os.Exit(1)
	}

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, repository.New(db))

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           withHTTPMiddleware(mux, logger),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		logger.Info("order-service starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("order-service failed", "error", err.Error())
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	_ = server.Shutdown(ctx)
	logger.Info("order-service stopped")
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func withHTTPMiddleware(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if reqID == "" {
			reqID = time.Now().UTC().Format("20060102150405.000000000")
		}
		w.Header().Set("X-Request-ID", reqID)

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		defer func() {
			if recErr := recover(); recErr != nil {
				logger.Error("panic recovered", "request_id", reqID, "panic", recErr)
				http.Error(rec, "internal server error", http.StatusInternalServerError)
			}
			logger.Info("http_request", "request_id", reqID, "method", r.Method, "path", r.URL.Path, "status", rec.status, "client_ip", readClientIP(r), "duration_ms", time.Since(start).Milliseconds())
		}()

		next.ServeHTTP(rec, r)
	})
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
