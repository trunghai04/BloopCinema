/**
 * Nếu không set VITE_API_BASE_URL → gọi same-origin `/api/...` (Docker nginx hoặc Vite proxy).
 * Tránh mặc định localhost:8080 — trên điện thoại localhost là chính máy điện thoại, API sẽ fail.
 */
function apiOrigin() {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (v != null && String(v).trim() !== "") {
    return String(v).trim().replace(/\/$/, "");
  }
  return "";
}

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const o = apiOrigin();
  return o ? `${o}${p}` : p;
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
  const response = await fetch(apiUrl("/api/v1/movies"));
  return parseJson(response);
}

export async function getGenres() {
  const response = await fetch(apiUrl("/api/v1/genres"));
  return parseJson(response);
}

export async function getShowtimes() {
  const response = await fetch(apiUrl("/api/v1/showtimes"));
  return parseJson(response);
}

export async function getAdminMovies() {
  const response = await fetch(apiUrl("/api/v1/admin/movies"));
  return parseJson(response);
}

export async function upsertAdminMovie(payload) {
  const response = await fetch(apiUrl("/api/v1/admin/movies"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminMovie(id) {
  const q = new URLSearchParams({ id });
  const response = await fetch(apiUrl(`/api/v1/admin/movies?${q}`), {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function getAdminShowtimes() {
  const response = await fetch(apiUrl("/api/v1/admin/showtimes"));
  return parseJson(response);
}

export async function upsertAdminShowtime(payload) {
  const response = await fetch(apiUrl("/api/v1/admin/showtimes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminShowtime(id) {
  const q = new URLSearchParams({ id });
  const response = await fetch(apiUrl(`/api/v1/admin/showtimes?${q}`), {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function getAdminSeatLayouts() {
  const response = await fetch(apiUrl("/api/v1/admin/seat-layouts"));
  return parseJson(response);
}

export async function upsertAdminSeatLayout(payload) {
  const response = await fetch(apiUrl("/api/v1/admin/seat-layouts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function deleteAdminSeatLayout(hall) {
  const q = new URLSearchParams({ hall });
  const response = await fetch(apiUrl(`/api/v1/admin/seat-layouts?${q}`), {
    method: "DELETE"
  });
  return parseJson(response);
}

export async function createBooking(payload) {
  const response = await fetch(apiUrl("/api/v1/bookings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson(response);
}

export async function login(email, password) {
  const response = await fetch(apiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseJson(response);
}

export async function getStripePaymentStatus() {
  const response = await fetch(apiUrl("/api/v1/reservations/stripe/status"));
  return parseJson(response);
}

export async function createStripeCheckoutSession({
  holdId,
  successUrl,
  cancelUrl
}) {
  const response = await fetch(
    apiUrl("/api/v1/reservations/stripe/checkout-session"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId, successUrl, cancelUrl })
    }
  );
  return parseJson(response);
}

export async function confirmStripeCheckoutSession(sessionId) {
  const response = await fetch(apiUrl("/api/v1/reservations/stripe/confirm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });
  return parseJson(response);
}

export async function getReservationShowtimeSeats(showtimeId) {
  const q = new URLSearchParams({ showtimeId });
  const response = await fetch(
    apiUrl(`/api/v1/reservations/showtime-seats?${q}`)
  );
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
