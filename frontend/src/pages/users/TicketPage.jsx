import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { getReservationDetail, getMovies, getShowtimes } from "../../api/client";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export default function TicketPage() {
  const [params] = useSearchParams();
  const holdId = params.get("holdId") || "";

  const [detail, setDetail] = useState(null);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!holdId) return;
    setLoading(true);
    setError("");
    try {
      const [d, movieList, showtimeList] = await Promise.all([
        getReservationDetail(holdId),
        getMovies(),
        getShowtimes()
      ]);
      setDetail(d);
      setMovies(movieList);
      setShowtimes(showtimeList);
      if (d.state !== "paid") {
        setError("Vé chưa được thanh toán hoặc phiên không hợp lệ.");
      }
    } catch {
      setError("Không tải được thông tin vé.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!holdId) {
    return (
      <section>
        <p className="section-muted">Thiếu mã vé.</p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="section-muted">Đang tải vé…</p>;
  }

  const seats = String(detail?.seatCodes || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const showtime = detail ? showtimes.find((s) => s.id === detail.showtimeId) || null : null;
  const movieTitle = detail
    ? String(detail.movieTitle || "").trim() || movies.find((m) => m.id === detail.movieId)?.title || detail.movieId || "-"
    : "-";
  const showtimeText = detail
    ? detail.showtimeLabel || showtime?.startAt || detail.showtimeStartAt || detail.showtimeId || "-"
    : "-";
  const roomText = detail
    ? String(detail.hall || "").trim() || String(showtime?.hall || "").trim() || String(detail.theaterName || "").trim() || "-"
    : "-";

  if (error || !detail || detail.state !== "paid") {
    return (
      <section>
        <p className="book-error">{error || "Không có vé hợp lệ."}</p>
        <div className="book-actions">
          <Link
            to={`/book/payment?holdId=${encodeURIComponent(holdId)}`}
            className="cta-link"
          >
            Quay lại thanh toán
          </Link>
          <Link to="/movies" className="cta-link">
            Về trang phim
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="ticket-page">
      <h2 className="section-title">Hóa đơn / vé điện tử</h2>
      <div className="ticket-card item-card">
        <p>
          <strong>Mã vé:</strong> {detail.id}
        </p>
        <p>
          <strong>Ghế:</strong> {seats.join(", ")}
        </p>
        <p>
          <strong>Email:</strong> {detail.userEmail}
        </p>
        <p>
          <strong>Phim:</strong> {movieTitle}
        </p>
        <p>
          <strong>Suất:</strong> {showtimeText}
        </p>
        <p>
          <strong>Phòng:</strong> {roomText}
        </p>
        <div className="ticket-qr-wrap">
          <QRCode
            value={detail.qrPayload || detail.id}
            size={200}
            bgColor="#f8fafc"
            fgColor="#0f172a"
            level="M"
          />
        </div>
        <p className="section-muted" style={{ marginBottom: 0 }}>
          Xuất mã QR khi check-in tại rạp. Dữ liệu mã khớp ghế đã thanh toán.
        </p>
      </div>
      <Link to="/movies" className="cta-link">
        ← Về trang phim
      </Link>
    </section>
  );
}

