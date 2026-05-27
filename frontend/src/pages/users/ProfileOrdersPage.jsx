import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getMovies, getShowtimes, getUserOrders } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { getTheaterLabel, loadTheaters } from "../../theaters";

export default function ProfileOrdersPage() {
  const { user, isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn || !user?.email) return undefined;
    Promise.all([loadTheaters(), getMovies(), getShowtimes(), getUserOrders(user.email)])
      .then(([, movieList, showtimeList, data]) => {
        if (alive) {
          setMovies(Array.isArray(movieList) ? movieList : []);
          setShowtimes(Array.isArray(showtimeList) ? showtimeList : []);
          setOrders(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (alive) setError(err?.message || "Không tải được lịch sử đơn mua.");
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, user?.email]);

  if (!isLoggedIn || !user?.email) {
    return (
      <section>
        <h2 className="section-title">Lịch sử đơn mua</h2>
        <p className="section-muted">Đăng nhập để xem các đơn vé đã mua.</p>
        <Link to="/login?redirect=/profile/orders" className="cta-link">
          Đăng nhập
        </Link>
      </section>
    );
  }

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [orders]);
  const movieMap = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const showtimeMap = useMemo(() => new Map(showtimes.map((showtime) => [showtime.id, showtime])), [showtimes]);

  const getShowtimeText = (order) => {
    const direct = String(order?.showtimeLabel || "").trim();
    if (direct && !direct.startsWith("0001-01-01")) return direct;
    const startAt = String(order?.showtimeStartAt || "").trim();
    if (startAt && !startAt.startsWith("0001-01-01")) return startAt;
    const st = order?.showtimeId ? showtimeMap.get(order.showtimeId) : null;
    if (st?.startAt) return st.startAt;
    if (order?.showtimeId) return String(order.showtimeId).trim();
    return "-";
  };

  const formatShowtime = (value) => {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("0001-01-01")) return "-";
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed) && /T|\d{4}-\d{2}-\d{2}/.test(raw)) {
      return new Date(parsed).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return raw;
  };

  const formatAmount = (order) => {
    const amount = Number(order?.amountVnd ?? order?.amountVND ?? order?.totalAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return "-";
    return `${amount.toLocaleString("vi-VN")} VND`;
  };

  const getTheaterText = (order) => {
    const direct = String(order?.theaterName || "").trim();
    if (direct && !direct.startsWith("0001-01-01")) return direct;
    if (order?.theaterId) return getTheaterLabel(order.theaterId);
    const st = order?.showtimeId ? showtimeMap.get(order.showtimeId) : null;
    if (st?.theaterId) return getTheaterLabel(st.theaterId);
    return "-";
  };

  return (
    <section>
      <h2 className="section-title">Lịch sử đơn mua</h2>
      <p className="section-muted">Danh sách vé và giao dịch mua của bạn.</p>
      {error ? <p className="book-error">{error}</p> : null}

      <div className="admin-order-table" style={{ overflowX: "auto" }}>
        <div className="admin-order-table__head">
          <span>Mã vé</span>
          <span>Số ghế</span>
          <span>Ghế</span>
          <span>Phim</span>
          <span>Rạp</span>
          <span>Suất</span>
          <span>Trạng thái</span>
          <span>Số tiền</span>
        </div>
        {sortedOrders.length ? sortedOrders.map((o) => (
          <div key={o.id} className="admin-order-table__row">
            <span>{o.id}</span>
            <span>{Array.isArray(o.seatCodes) && o.seatCodes.length ? o.seatCodes.length : String(o.seatCode || "").split(",").filter(Boolean).length || 0}</span>
            <span>{Array.isArray(o.seatCodes) && o.seatCodes.length ? o.seatCodes.join(", ") : o.seatCode || "-"}</span>
            <span>{o.movieTitle || movieMap.get(o.movieId)?.title || o.movieId || "-"}</span>
            <span>{getTheaterText(o)}</span>
            <span>{formatShowtime(getShowtimeText(o))}</span>
            <span>{o.status || "-"}</span>
            <span>{formatAmount(o)}</span>
          </div>
        )) : (
          <div className="admin-order-table__row">
            <span>Chưa có đơn mua nào.</span>
            <span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span>
          </div>
        )}
      </div>
    </section>
  );
}
