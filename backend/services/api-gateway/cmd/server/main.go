package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

type routeProxy struct {
	pathPrefix string
	targetURL  *url.URL
}

type rateLimiter struct {
	mu      sync.Mutex
	bucket  map[string][]time.Time
	window  time.Duration
	maxHits int
}

type circuitState struct {
	consecutiveFailures int
	openUntil           time.Time
}

type upstreamResilience struct {
	mu               sync.Mutex
	states           map[string]*circuitState
	failureThreshold int
	openFor          time.Duration
	retryCount       int
	retryBackoff     time.Duration
	perTryTimeout    time.Duration
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	tp, err := initTracerProvider(context.Background(), "api-gateway", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
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
	port := getEnv("SERVICE_PORT", "8080")
	authURL := mustParseURL(getEnv("AUTH_SERVICE_URL", "http://localhost:8081"))
	userURL := mustParseURL(getEnv("USER_SERVICE_URL", "http://localhost:8084"))
	catalogURL := mustParseURL(getEnv("CATALOG_SERVICE_URL", "http://localhost:8082"))
	bookingURL := mustParseURL(getEnv("BOOKING_SERVICE_URL", "http://localhost:8083"))
	orderURL := mustParseURL(getEnv("ORDER_SERVICE_URL", "http://localhost:8086"))
	allowedOrigins := parseAllowedOrigins(
		getEnv(
			"CORS_ALLOW_ORIGINS",
			"http://localhost:5173,https://cinema.bloop.io.vn",
		),
	)
	_ = userURL
	_ = getEnvDuration("REQUEST_TIMEOUT", 8*time.Second)
	shutdownTimeout := getEnvDuration("SHUTDOWN_TIMEOUT", 10*time.Second)
	upstreamRetryCount := getEnvInt("UPSTREAM_RETRY_COUNT", 2)
	upstreamRetryBackoff := getEnvDuration("UPSTREAM_RETRY_BACKOFF", 120*time.Millisecond)
	upstreamPerTryTimeout := getEnvDuration("UPSTREAM_PER_TRY_TIMEOUT", 5*time.Second)
	circuitFailureThreshold := getEnvInt("CIRCUIT_BREAKER_FAILURE_THRESHOLD", 5)
	circuitOpenDuration := getEnvDuration("CIRCUIT_BREAKER_OPEN_DURATION", 20*time.Second)
	resilience := newUpstreamResilience(
		circuitFailureThreshold,
		circuitOpenDuration,
		upstreamRetryCount,
		upstreamRetryBackoff,
		upstreamPerTryTimeout,
	)
	baseTransport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   3 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: upstreamPerTryTimeout,
	}
	proxyTransport := resilience.transport(baseTransport, logger)

	proxies := []routeProxy{
		{pathPrefix: "/api/v1/auth/login", targetURL: userURL},
		{pathPrefix: "/api/v1/auth/register", targetURL: userURL},
		{pathPrefix: "/api/v1/auth", targetURL: authURL},
		{pathPrefix: "/api/v1/users", targetURL: userURL},
		{pathPrefix: "/api/v1/movies", targetURL: catalogURL},
		{pathPrefix: "/api/v1/genres", targetURL: catalogURL},
		{pathPrefix: "/api/v1/showtimes", targetURL: catalogURL},
		{pathPrefix: "/api/v1/theaters", targetURL: catalogURL},
		{pathPrefix: "/api/v1/admin", targetURL: catalogURL},
		{pathPrefix: "/api/v1/bookings", targetURL: bookingURL},
		{pathPrefix: "/api/v1/reservations", targetURL: bookingURL},
		{pathPrefix: "/api/v1/orders", targetURL: orderURL},
		{pathPrefix: "/uploads", targetURL: catalogURL},
		{pathPrefix: "/health/auth", targetURL: authURL},
		{pathPrefix: "/health/users", targetURL: userURL},
		{pathPrefix: "/health/catalog", targetURL: catalogURL},
		{pathPrefix: "/health/booking", targetURL: bookingURL},
		{pathPrefix: "/health/orders", targetURL: orderURL},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"service":"api-gateway","status":"ok"}`))
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"service":"api-gateway","ready":true}`))
	})
	mux.Handle("/metrics", promhttp.Handler())

	for _, p := range proxies {
		mux.Handle(p.pathPrefix, buildProxyHandler(p.targetURL, proxyTransport, logger))
		if !strings.HasSuffix(p.pathPrefix, "/") {
			mux.Handle(p.pathPrefix+"/", buildProxyHandler(p.targetURL, proxyTransport, logger))
		}
	}

	limiter := &rateLimiter{
		bucket:  map[string][]time.Time{},
		window:  time.Minute,
		maxHits: 180,
	}
	metrics := newHTTPMetrics("api_gateway")
	handler := chain(
		mux,
		withCORS(allowedOrigins),
		withPromMetrics(metrics),
		withRequestID,
		withAccessLog(logger),
		withRateLimit(limiter),
	)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(handler, "api-gateway-http"),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      12 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		logger.Info("api-gateway starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			logger.Error("api-gateway failed", "error", err.Error())
			os.Exit(1)
		}
	}()

	waitForShutdown(server, shutdownTimeout, logger)
}

func buildProxyHandler(target *url.URL, transport http.RoundTripper, logger *slog.Logger) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = transport
	proxy.Director = func(req *http.Request) {
		reqURL := *target
		req.URL.Scheme = reqURL.Scheme
		req.URL.Host = reqURL.Host
		req.URL.Path = singleJoiningSlash(target.Path, req.URL.Path)
		if target.RawQuery == "" || req.URL.RawQuery == "" {
			req.URL.RawQuery = target.RawQuery + req.URL.RawQuery
		} else {
			req.URL.RawQuery = target.RawQuery + "&" + req.URL.RawQuery
		}
		req.Host = target.Host
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		logger.Info("upstream response", "target", target.String(), "status", resp.StatusCode, "path", resp.Request.URL.Path)
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("upstream proxy error", "target", target.String(), "path", r.URL.Path, "error", err.Error())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"message":"upstream temporarily unavailable"}`))
	}
	return proxy
}

func singleJoiningSlash(a, b string) string {
	aSlash := strings.HasSuffix(a, "/")
	bSlash := strings.HasPrefix(b, "/")
	switch {
	case aSlash && bSlash:
		return a + b[1:]
	case !aSlash && !bSlash:
		return a + "/" + b
	}
	return a + b
}

func withCORS(allowOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if isAllowedOrigin(origin, allowOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization, X-Request-ID",
			)
			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			)
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func parseAllowedOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func isAllowedOrigin(origin string, allowOrigins []string) bool {
	if origin == "" {
		return false
	}
	for _, item := range allowOrigins {
		if item == "*" || item == origin {
			return true
		}
	}
	return false
}

func withTimeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.TimeoutHandler(next, d, "request timeout")
	}
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = time.Now().UTC().Format("20060102150405.000000000")
		}
		w.Header().Set("X-Request-ID", reqID)
		next.ServeHTTP(w, r)
	})
}

func withAccessLog(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			ip := readClientIP(r)
			logger.Info(
				"request",
				"method", r.Method,
				"path", r.URL.Path,
				"client_ip", ip,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
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

func withPromMetrics(m *httpMetrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			path := routeLabel(r.URL.Path)
			m.total.WithLabelValues(r.Method, path, http.StatusText(rec.status)).Inc()
			m.duration.WithLabelValues(r.Method, path).Observe(time.Since(start).Seconds())
		})
	}
}

func routeLabel(path string) string {
	switch {
	case strings.HasPrefix(path, "/api/v1/auth"):
		return "/api/v1/auth/*"
	case strings.HasPrefix(path, "/api/v1/users"):
		return "/api/v1/users/*"
	case strings.HasPrefix(path, "/api/v1/movies"):
		return "/api/v1/movies"
	case strings.HasPrefix(path, "/api/v1/genres"):
		return "/api/v1/genres"
	case strings.HasPrefix(path, "/api/v1/showtimes"):
		return "/api/v1/showtimes"
	case strings.HasPrefix(path, "/api/v1/admin"):
		return "/api/v1/admin/*"
	case strings.HasPrefix(path, "/api/v1/bookings"):
		return "/api/v1/bookings"
	case strings.HasPrefix(path, "/api/v1/orders"):
		return "/api/v1/orders"
	case strings.HasPrefix(path, "/api/v1/reservations"):
		return "/api/v1/reservations/*"
	case strings.HasPrefix(path, "/health"):
		return "/health"
	case strings.HasPrefix(path, "/ready"):
		return "/ready"
	case strings.HasPrefix(path, "/metrics"):
		return "/metrics"
	default:
		return "other"
	}
}

func withRateLimit(l *rateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientIP := readClientIP(r)
			if !l.allow(clientIP) {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (l *rateLimiter) allow(client string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	from := now.Add(-l.window)
	old := l.bucket[client]
	recent := make([]time.Time, 0, len(old)+1)
	for _, ts := range old {
		if ts.After(from) {
			recent = append(recent, ts)
		}
	}
	if len(recent) >= l.maxHits {
		l.bucket[client] = recent
		return false
	}
	l.bucket[client] = append(recent, now)
	return true
}

func readClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
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

func chain(
	base http.Handler,
	middlewares ...func(http.Handler) http.Handler,
) http.Handler {
	h := base
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

func waitForShutdown(
	server *http.Server,
	timeout time.Duration,
	logger *slog.Logger,
) {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info("shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "error", err.Error())
		return
	}
	logger.Info("api-gateway stopped cleanly")
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		log.Printf("invalid duration %s=%s", key, raw)
		return fallback
	}
	return parsed
}

func mustParseURL(raw string) *url.URL {
	parsed, err := url.Parse(raw)
	if err != nil {
		log.Fatalf("invalid URL %s: %v", raw, err)
	}
	return parsed
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 0 {
		log.Printf("invalid int %s=%s", key, raw)
		return fallback
	}
	return parsed
}

func newUpstreamResilience(
	failureThreshold int,
	openFor time.Duration,
	retryCount int,
	retryBackoff time.Duration,
	perTryTimeout time.Duration,
) *upstreamResilience {
	if failureThreshold < 1 {
		failureThreshold = 1
	}
	return &upstreamResilience{
		states:           map[string]*circuitState{},
		failureThreshold: failureThreshold,
		openFor:          openFor,
		retryCount:       retryCount,
		retryBackoff:     retryBackoff,
		perTryTimeout:    perTryTimeout,
	}
}

func (u *upstreamResilience) transport(base http.RoundTripper, logger *slog.Logger) http.RoundTripper {
	return roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		host := req.URL.Host
		if !u.allow(host) {
			return nil, errors.New("circuit breaker is open")
		}

		attempts := 1
		if isIdempotent(req.Method) {
			attempts += u.retryCount
		}

		var lastErr error
		for attempt := 1; attempt <= attempts; attempt++ {
			attemptReq := req.Clone(req.Context())

			resp, err := base.RoundTrip(attemptReq)
			if err == nil && !shouldRetryStatus(resp.StatusCode) {
				u.markSuccess(host)
				return resp, nil
			}

			if err != nil {
				lastErr = err
			}
			if resp != nil && shouldRetryStatus(resp.StatusCode) {
				lastErr = errors.New(http.StatusText(resp.StatusCode))
			}

			if attempt < attempts && (err != nil || shouldRetryStatus(responseStatus(resp))) {
				if resp != nil && resp.Body != nil {
					_ = resp.Body.Close()
				}
				if u.retryBackoff > 0 {
					time.Sleep(u.retryBackoff)
				}
				continue
			}

			if err != nil || isFailureStatus(responseStatus(resp)) {
				u.markFailure(host)
			}
			if err != nil {
				logger.Warn("upstream request failed", "target", host, "attempt", attempt, "error", err.Error())
				return nil, err
			}
			return resp, nil
		}

		u.markFailure(host)
		return nil, lastErr
	})
}

func (u *upstreamResilience) allow(host string) bool {
	if host == "" {
		return true
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	state := u.getState(host)
	if time.Now().Before(state.openUntil) {
		return false
	}
	return true
}

func (u *upstreamResilience) markSuccess(host string) {
	if host == "" {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	state := u.getState(host)
	state.consecutiveFailures = 0
	state.openUntil = time.Time{}
}

func (u *upstreamResilience) markFailure(host string) {
	if host == "" {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	state := u.getState(host)
	state.consecutiveFailures++
	if state.consecutiveFailures >= u.failureThreshold {
		state.openUntil = time.Now().Add(u.openFor)
		state.consecutiveFailures = 0
	}
}

func (u *upstreamResilience) getState(host string) *circuitState {
	state, ok := u.states[host]
	if ok {
		return state
	}
	state = &circuitState{}
	u.states[host] = state
	return state
}

func isIdempotent(method string) bool {
	return method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions
}

func shouldRetryStatus(code int) bool {
	return code == http.StatusTooManyRequests || code >= http.StatusInternalServerError
}

func isFailureStatus(code int) bool {
	return code >= http.StatusInternalServerError
}

func responseStatus(resp *http.Response) int {
	if resp == nil {
		return 0
	}
	return resp.StatusCode
}
