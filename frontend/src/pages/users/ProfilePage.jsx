import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getAdminOrders, getMovies, getProfile, getShowtimes, getUserOrders, updateProfile } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { getTheaterLabel, loadTheaters } from "../../theaters";


const emptyForm = {
  fullName: "",
  phone: "",
  dob: "",
  email: "",
  cmnd: "",
  province: "",
  ward: "",
  address: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfilePage() {
  const { user, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn || !user?.email) return undefined;
    Promise.all([getProfile(user.email), getMovies(), getShowtimes(), loadTheaters()])
      .then(([profileData, movieList, showtimeList]) => {
        if (alive) {
          setProfile(profileData);
          setMovies(Array.isArray(movieList) ? movieList : []);
          setShowtimes(Array.isArray(showtimeList) ? showtimeList : []);
        }
      })
      .catch((err) => {
        if (alive) setError(err?.message || "Không tải được thông tin tài khoản.");
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, user?.email]);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn || !user?.email) return undefined;
    const loadOrders = async () => {
      try {
        const data = await getUserOrders(user.email);
        if (alive && Array.isArray(data) && data.length) {
          setOrders(data);
          return;
        }
        const fallback = await getAdminOrders();
        const filtered = Array.isArray(fallback)
          ? fallback.filter((order) => order.userEmail === user.email || order.userId === user.email)
          : [];
        if (alive) setOrders(filtered.length ? filtered : (Array.isArray(fallback) ? fallback : []));
      } catch {
        if (alive) setOrders([]);
      }
    };
    loadOrders();
    return () => {
      alive = false;
    };
  }, [isLoggedIn, user?.email]);

  useEffect(() => {
    if (!isLoggedIn || !user?.email) return;
    const info = profile || user;
    setForm((prev) => ({
      ...prev,
      fullName: info.name || "",
      email: info.email || user.email || "",
      phone: info.phone || "",
      dob: info.birthday || info.dob || info.dateOfBirth || "",
      cmnd: info.idNumber || info.cmnd || "",
      province: info.province || info.city || "",
      ward: info.ward || info.district || info.commune || "",
      address: info.address || "",
    }));
  }, [isLoggedIn, user, profile]);

  const summaryOrders = useMemo(() => orders.slice(0, 3), [orders]);
  const movieMap = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const showtimeMap = useMemo(() => new Map(showtimes.map((st) => [st.id, st])), [showtimes]);

  const getShowtimeLabel = (order) => {
    const direct = String(order?.showtimeLabel || "").trim();
    if (direct && !/^0001-01-01/.test(direct)) return direct;
    const startAt = String(order?.showtimeStartAt || order?.showtimeAt || order?.startAt || "").trim();
    if (startAt && !/^0001-01-01/.test(startAt)) return startAt;
    if (order?.showtimeId && showtimeMap.has(order.showtimeId)) {
      const st = showtimeMap.get(order.showtimeId);
      const fromCatalog = `${st?.hall || ""} - ${st?.startAt || ""}`.trim();
      if (fromCatalog !== "-") return fromCatalog;
    }
    return "-";
  };

  const formatShowtime = (value) => {
    if (!value) return "-";
    const raw = String(value).trim();
    if (!raw || raw === "0001-01-01T00:00:00Z" || raw.startsWith("0001-01-01")) {
      return "-";
    }
    const iso = Date.parse(raw);
    if (Number.isFinite(iso) && /T|\d{4}-\d{2}-\d{2}/.test(raw)) {
      const date = new Date(iso);
      if (date.getFullYear() > 1900) {
        return date.toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "-";
    }
    const vnTime = raw.match(/(\d{1,2})\s*[Hh:]\s*(\d{2}).*?(?:ngày\s*)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (vnTime) {
      const [, hh, mm, dd, mo, yy] = vnTime;
      return `${dd.padStart(2, "0")}/${mo.padStart(2, "0")}/${yy} ${hh.padStart(2, "0")}:${mm}`;
    }
    const slashDate = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}).*?(\d{1,2})[:h](\d{2})/i);
    if (slashDate) {
      const [, dd, mo, yy, hh, mm] = slashDate;
      return `${dd.padStart(2, "0")}/${mo.padStart(2, "0")}/${yy} ${hh.padStart(2, "0")}:${mm}`;
    }
    return raw;
  };

  const getTheaterName = (order) => {
    const direct = String(order?.theaterName || "").trim();
    if (direct && direct !== "0001-01-01T00:00:00Z") return direct;
    if (order?.theaterId) return getTheaterLabel(order.theaterId);
    if (order?.showtimeId && showtimeMap.has(order.showtimeId)) {
      const st = showtimeMap.get(order.showtimeId);
      if (st?.theaterId) return getTheaterLabel(st.theaterId);
    }
    return "-";
  };

  const normalizeSeatLabels = (order) => {
    const values = Array.isArray(order?.seatCodes)
      ? order.seatCodes
      : String(order?.seatCode || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const seats = values
      .map((item) => String(item).trim().toUpperCase())
      .filter((item) => /^[A-Z]\d{1,2}$/.test(item));
    return seats.length ? seats.join(", ") : "-";
  };

  const parseDisplayShowtime = (order) => {
    const value = getShowtimeLabel(order);
    if (value === "-") return value;
    return formatShowtime(value);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.newPassword && !form.currentPassword) {
      setError("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.");
      return;
    }
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }
    try {
      const payload = {
        email: form.email || info.email || user.email,
        name: form.fullName || info.name || user.name || user.email.split("@")[0],
        phone: form.phone,
        birthday: form.dob,
        idNumber: form.cmnd,
        province: form.province,
        ward: form.ward,
        address: form.address,
      };
      if (form.currentPassword || form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }
      const hasPasswordChange = Boolean(form.currentPassword || form.newPassword);
      await updateProfile(payload);
      setMessage("Đã cập nhật thông tin tài khoản.");
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
      if (hasPasswordChange) {
        const refreshed = await getProfile(payload.email);
        setProfile(refreshed);
      }
      setError("");
    } catch (err) {
      setError(err?.message || "Không cập nhật được thông tin tài khoản.");
    }
  };

  if (!isLoggedIn || !user?.email) {
    return (
      <section className="profile-page">
        <div className="profile-hero">
          <h2 className="section-title">Hồ sơ cá nhân</h2>
          <p className="section-muted">
            Đăng nhập để xem thông tin tài khoản, điểm tích lũy và lịch sử đơn mua.
          </p>
          <Link to="/login?redirect=/profile" className="cta-link">
            Đăng nhập
          </Link>
        </div>
      </section>
    );
  }

  const info = profile || user;
  const seed = encodeURIComponent(info.email || user.email);
  const bcoins = info.bcoins ?? user.bcoins ?? 0;

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div className="profile-card profile-card--hero">
          <img
            className="profile-avatar"
            src={`https://api.dicebear.com/9.x/glass/svg?seed=${seed}`}
            alt=""
          />
          <div className="profile-hero__content">
            <span className="profile-badge">Tài khoản thành viên</span>
            <h2 className="section-title">{form.fullName || info.email.split("@")[0]}</h2>
            <p className="section-muted" style={{ marginBottom: 0 }}>
              {form.email}
            </p>
          </div>
        </div>

        {error ? <p className="book-error">{error}</p> : null}
        {message ? <p className="section-muted">{message}</p> : null}

        <form className="profile-form" onSubmit={onSubmit}>
          <div className="profile-form__grid">
            <label className="profile-field">
              <span>Họ và tên</span>
              <input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>Số điện thoại</span>
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>Ngày sinh</span>
              <input type="date" value={form.dob} onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>Email</span>
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>CMND</span>
              <input value={form.cmnd} onChange={(e) => setForm((prev) => ({ ...prev, cmnd: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>Tỉnh / Thành phố</span>
              <input value={form.province} onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))} />
            </label>
            <label className="profile-field">
              <span>Phường / Xã</span>
              <input value={form.ward} onChange={(e) => setForm((prev) => ({ ...prev, ward: e.target.value }))} />
            </label>
            <label className="profile-field profile-field--full">
              <span>Địa chỉ</span>
              <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <label className="profile-field profile-field--wide">
              <span>Đổi mật khẩu</span>
              <input type="password" value={form.currentPassword} onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))} placeholder="Mật khẩu hiện tại" />
            </label>
            <label className="profile-field">
              <span>Mật khẩu mới</span>
              <input type="password" value={form.newPassword} onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))} placeholder="Nhập mật khẩu mới" />
            </label>
            <label className="profile-field">
              <span>Xác nhận mật khẩu</span>
              <input type="password" value={form.confirmPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Nhập lại mật khẩu mới" />
            </label>
          </div>
          <div className="profile-form__actions">
            <button type="submit" className="cta-button">Cập nhật</button>
          </div>
        </form>

        <div className="profile-stats">
          <article className="item-card">
            <h3 className="item-title">Bcoins</h3>
            <p>{bcoins} Bcoins</p>
          </article>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section__head">
          <h3 className="item-title">Lịch sử đơn mua gần đây</h3>
          <Link to="/profile/orders" className="cta-link">
            Xem tất cả
          </Link>
        </div>
        <div className="admin-order-table profile-orders-preview">
          <div className="admin-order-table__head">
            <span>Mã vé</span>
            <span>Ghế</span>
            <span>Phim</span>
            <span>Rạp</span>
            <span>Suất</span>
            <span>Trạng thái</span>
          </div>
          {summaryOrders.length ? summaryOrders.map((o) => {
            const movie = movieMap.get(o.movieId);
            const theaterName = getTheaterName(o);
            const seatLabel = normalizeSeatLabels(o);
            const showtimeLabel = parseDisplayShowtime(o);
            return (
              <div key={o.id} className="admin-order-table__row">
                <span>{o.id}</span>
                <span>{seatLabel}</span>
                <span>{movie?.title || o.movieTitle || o.movieId || "-"}</span>
                <span>{theaterName}</span>
                <span>{showtimeLabel}</span>
                <span>{o.status || "-"}</span>
              </div>
            );
          }) : (
            <div className="admin-order-table__row">
              <span>Chưa có đơn mua nào.</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

