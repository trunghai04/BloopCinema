/**
 * Nếu không set VITE_API_BASE_URL → gọi same-origin `/api/...` (Docker nginx hoặc Vite proxy).
 * Tránh mặc định localhost:8080 — trên điện thoại localhost là chính máy điện thoại, API sẽ fail.
 */
export const API_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
  : "";

function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function apiFetch(path, options, retries = 2) {
  let lastErr;
  const url = apiUrl(path);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        ...options,
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) {
        return response;
      }
      lastErr = new Error(`Retryable HTTP ${response.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastErr;
}

export class ApiError extends Error {
  /** @param {string} message */
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseJson(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* body không phải JSON */
  }
  if (!res.ok) {
    const code = typeof data?.error === "string" ? data.error : undefined;
    const msg =
      (data?.message && String(data.message)) ||
      (typeof data?.error === "string" ? data.error : "") ||
      text ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new ApiError(String(msg).trim() || "Request failed", {
      status: res.status,
      code
    });
  }
  return data;
}

export async function getMovies() {
  const response = await apiFetch("/api/v1/movies");
  return parseJson(response);
}

export async function getGenres() {
  const response = await apiFetch("/api/v1/genres");
  return parseJson(response);
}

export async function getShowtimes() {
  const response = await apiFetch("/api/v1/showtimes");
  return parseJson(response);
}

export async function getTheaters() {
  const response = await apiFetch("/api/v1/theaters");
  return parseJson(response);
}

export async function getAdminMovies() {
  const response = await apiFetch("/api/v1/admin/movies");
  return parseJson(response);
}

export async function upsertAdminMovie(payload) {
  const response = await apiFetch("/api/v1/admin/movies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminMovie(id) {
  const q = new URLSearchParams({ id });
  const response = await apiFetch(`/api/v1/admin/movies?${q}`, {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function getAdminShowtimes() {
  const response = await apiFetch("/api/v1/admin/showtimes");
  return parseJson(response);
}

export async function upsertAdminShowtime(payload) {
  const response = await apiFetch("/api/v1/admin/showtimes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminShowtime(id) {
  const q = new URLSearchParams({ id });
  const response = await apiFetch(`/api/v1/admin/showtimes?${q}`, {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function getAdminSeatLayouts() {
  const response = await apiFetch("/api/v1/admin/seat-layouts");
  return parseJson(response);
}

export async function getAdminTheaters() {
  const response = await apiFetch("/api/v1/admin/theaters");
  return parseJson(response);
}

export async function getAdminOrders() {
  const response = await apiFetch("/api/v1/orders");
  return parseJson(response);
}

export async function getAdminBanners() {
  const response = await apiFetch("/api/v1/admin/banners");
  return parseJson(response);
}

export async function upsertAdminBanner(formData) {
  const response = await apiFetch("/api/v1/admin/banners", {
    method: "POST",
    body: formData
  });
  return parseJson(response);
}

export async function deleteAdminBanner(id) {
  const q = new URLSearchParams({ id });
  const response = await apiFetch(`/api/v1/admin/banners?${q}`, {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function upsertAdminTheater(payload) {
  const response = await apiFetch("/api/v1/admin/theaters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminTheater(id) {
  const q = new URLSearchParams({ id });
  const response = await apiFetch(`/api/v1/admin/theaters?${q}`, {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function upsertAdminSeatLayout(payload) {
  const response = await apiFetch("/api/v1/admin/seat-layouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminSeatLayout(idOrHall) {
  const q = new URLSearchParams({ id: idOrHall, hall: idOrHall });
  const response = await apiFetch(`/api/v1/admin/seat-layouts?${q}`, {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function createBooking(payload) {
  const response = await apiFetch("/api/v1/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function login(email, password) {
  const response = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseJson(response);
}

export async function adminLogin(email, password) {
  const response = await apiFetch("/api/v1/auth/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseJson(response);
}

export async function registerUser({ name, email, password }) {
  const response = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  return parseJson(response);
}

export async function verifyOtp(email, otp) {
  const response = await apiFetch("/api/v1/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
  return parseJson(response);
}

export async function getProfile(email) {
  const q = new URLSearchParams({ email });
  const response = await apiFetch(`/api/v1/users/me?${q}`);
  return parseJson(response);
}

export async function updateProfile(payload) {
  const response = await apiFetch("/api/v1/users/me/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function getUserOrders(userId) {
  const q = new URLSearchParams({ userId });
  const response = await apiFetch(`/api/v1/orders?${q}`);
  return parseJson(response);
}

export async function getStripePaymentStatus() {
  const response = await apiFetch("/api/v1/reservations/stripe/status");
  return parseJson(response);
}

export async function createStripeCheckoutSession({
  holdId,
  successUrl,
  cancelUrl
}) {
  const response = await apiFetch(
    "/api/v1/reservations/stripe/checkout-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId, successUrl, cancelUrl })
    }
  );
  return parseJson(response);
}

export async function confirmStripeCheckoutSession(sessionId) {
  const response = await apiFetch("/api/v1/reservations/stripe/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });
  return parseJson(response);
}

export async function getReservationShowtimeSeats(showtimeId) {
  const q = new URLSearchParams({ showtimeId });
  const response = await apiFetch(`/api/v1/reservations/showtime-seats?${q}`);
  return parseJson(response);
}

export async function holdReservation({
  userEmail,
  movieId,
  showtimeId,
  sessionId,
  seats
}) {
  const response = await fetch(apiUrl("/api/v1/reservations/hold"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userEmail,
      movieId,
      showtimeId,
      sessionId,
      seats
    })
  });
  return parseJson(response);
}

export async function syncReservationSeatLock({
  showtimeId,
  sessionId,
  seats
}) {
  const response = await fetch(apiUrl("/api/v1/reservations/seat-lock"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtimeId, sessionId, seats })
  });
  return parseJson(response);
}

export async function payReservation({ holdId, success }) {
  const response = await fetch(apiUrl("/api/v1/reservations/pay"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdId, success })
  });
  return parseJson(response);
}

export async function getReservationDetail(id) {
  const q = new URLSearchParams({ id });
  const response = await fetch(apiUrl(`/api/v1/reservations/detail?${q}`));
  return parseJson(response);
}
