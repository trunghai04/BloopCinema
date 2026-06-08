import { useEffect, useMemo, useState } from "react";
import { getAdminBanners, upsertAdminBanner, deleteAdminBanner } from "../../api/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  deleteAdminMovie,
  deleteAdminSeatLayout,
  deleteAdminShowtime,
  getAdminMovies,
  getAdminSeatLayouts,
  getAdminShowtimes,
  getAdminTheaters,
  getAdminOrders,
  upsertAdminSeatLayout,
} from "../../api/client";
import AdminTheatersPage from "./AdminTheatersPage";
import { setDocumentTitle } from "../../utils/documentTitle";
import gheThuongImg from "../../assets/ghethuong.webp";
import gheVipImg from "../../assets/ghevip.webp";
import gheDoiImg from "../../assets/ghedoi.webp";

function makeColNumbers(n) {
  const max = Number(n) > 0 ? Number(n) : 10;
  return Array.from({ length: max }, (_, i) => i + 1);
}

function makeSeatNodesFromGrid(rowsCsv, cols) {
  const rows = String(rowsCsv)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const maxCols = Number(cols) > 0 ? Number(cols) : 10;
  const seats = [];
  rows.forEach((row, rowIndex) => {
    for (let col = 1; col <= maxCols; col += 1) {
      seats.push({
        code: `${row}${col}`,
        x: (col - 1) * 52,
        y: rowIndex * 56,
        type: "standard",
        enabled: true
      });
    }
  });
  return seats;
}

const DEFAULT_SEAT_PRICES = { standard: 50000, vip: 75000, couple: 100000 };
const HERO_STORAGE_KEY = "bloop_homepage_banners";
const DEFAULT_BANNERS = [
  {
    id: "hb1",
    title: "Trải nghiệm điện ảnh đỉnh cao",
    description: "Đặt vé nhanh, xem lịch chiếu rõ ràng và nhận vé điện tử ngay sau thanh toán.",
    image: "/news-carousel-1.jpg",
    active: true
  },
  {
    id: "hb2",
    title: "Ưu đãi thành viên mỗi tuần",
    description: "Theo dõi khuyến mãi, combo bắp nước và các suất chiếu hot ngay tại Bloop Cinema.",
    image: "/news-carousel-2.jpg",
    active: true
  },
  {
    id: "hb3",
    title: "Rạp phim sạch, đẹp, dễ đặt vé",
    description: "Giao diện tối giản, thao tác nhanh, phù hợp cả trên mobile lẫn desktop.",
    image: "/news-carousel-3.jpg",
    active: true
  }
];

function loadStoredBanners() {
  if (typeof window === "undefined") return DEFAULT_BANNERS;
  try {
    const raw = window.localStorage.getItem(HERO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_BANNERS;
}

function nextSeatNode(seats, cols) {
  const current = Array.isArray(seats) ? seats : [];
  const maxCols = Number(cols) > 0 ? Number(cols) : 10;
  const idx = current.length;
  const col = idx % maxCols;
  const row = Math.floor(idx / maxCols);
  return {
    code: `S${idx + 1}`,
    x: col * 52,
    y: row * 56,
    type: "standard",
    enabled: true
  };
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [banners, setBanners] = useState(() => loadStoredBanners());
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moviesError, setMoviesError] = useState("");
  const [showtimesError, setShowtimesError] = useState("");
  const [layoutsError, setLayoutsError] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("movies");

  const [layoutDraft, setLayoutDraft] = useState({
    theaterId: "hanoi",
    hall: "Hall A",
    rows: "A,B,C,D,E,F",
    cols: 10,
    blockedSeats: "",
    seatPrices: { ...DEFAULT_SEAT_PRICES },
    seats: makeSeatNodesFromGrid("A,B,C,D,E,F", 10)
  });
  const [quickAddSeatType, setQuickAddSeatType] = useState("standard");
  const [bannerDraft, setBannerDraft] = useState({
    id: "",
    image: "",
    active: true
  });
  const [bannerFileName, setBannerFileName] = useState("");

  useEffect(() => {
    setDocumentTitle("Admin Console");
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [moviesRes, showtimesRes, layoutsRes, theatersRes, ordersRes, bannersRes] = await Promise.allSettled([
        getAdminMovies(),
        getAdminShowtimes(),
        getAdminSeatLayouts(),
        getAdminTheaters(),
        getAdminOrders(),
        getAdminBanners()
      ]);
      if (moviesRes.status === "fulfilled") {
        setMovies(moviesRes.value || []);
        setMoviesError("");
      } else {
        setMovies([]);
        setMoviesError(moviesRes.reason?.message || "Không tải được danh sách phim.");
      }
      if (showtimesRes.status === "fulfilled") {
        setShowtimes(showtimesRes.value || []);
        setShowtimesError("");
      } else {
        setShowtimes([]);
        setShowtimesError(showtimesRes.reason?.message || "Không tải được danh sách suất chiếu.");
      }
      if (layoutsRes.status === "fulfilled") {
        setLayouts(layoutsRes.value || []);
        setLayoutsError("");
      } else {
        setLayouts([]);
        setLayoutsError(layoutsRes.reason?.message || "Không tải được danh sách bố trí ghế.");
      }
      if (theatersRes.status === "fulfilled") {
        setTheaters(theatersRes.value || []);
      } else {
        setTheaters([]);
      }
      if (ordersRes.status === "fulfilled") {
        setOrders(ordersRes.value || []);
      } else {
        setOrders([]);
      }
      if (bannersRes.status === "fulfilled") {
        const remote = Array.isArray(bannersRes.value) ? bannersRes.value : [];
        setBanners(remote.length ? remote : loadStoredBanners());
      } else {
        setBanners(loadStoredBanners());
      }
    } catch (e) {
      setError(e?.message || "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const movieMap = useMemo(() => {
    const m = new Map();
    movies.forEach((item) => m.set(item.id, item.title));
    return m;
  }, [movies]);

  const theaterMap = useMemo(() => {
    const m = new Map();
    theaters.forEach((item) => m.set(item.id, item.name || item.id));
    return m;
  }, [theaters]);

  const showtimeMap = useMemo(() => {
    const m = new Map();
    showtimes.forEach((item) => m.set(item.id, item));
    return m;
  }, [showtimes]);

  const getSeatCodes = (order) => {
    if (Array.isArray(order?.seatCodes) && order.seatCodes.length) {
      return order.seatCodes.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(order?.seatCode || "")
      .split(/\s*,\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getOrderMovieTitle = (order) => {
    const direct = String(order?.movieTitle || "").trim();
    if (direct && !direct.startsWith("0001-01-01")) return direct;
    return movieMap.get(order?.movieId) || order?.movieId || "-";
  };

  const getOrderTheaterName = (order) => {
    const direct = String(order?.theaterName || "").trim();
    if (direct && !direct.startsWith("0001-01-01")) return direct;
    if (order?.theaterId) return theaterMap.get(order.theaterId) || order.theaterId;
    const st = order?.showtimeId ? showtimeMap.get(order.showtimeId) : null;
    if (st?.theaterId) return theaterMap.get(st.theaterId) || st.theaterId;
    return "-";
  };

  const getOrderUserName = (order) => {
    return String(order?.userEmail || order?.userId || "-").trim() || "-";
  };

  const getOrderShowtime = (order) => {
    const label = String(order?.showtimeLabel || "").trim();
    if (label && !label.startsWith("0001-01-01")) return label;
    const startAt = String(order?.showtimeStartAt || "").trim();
    if (startAt && !startAt.startsWith("0001-01-01")) return startAt;
    const st = order?.showtimeId ? showtimeMap.get(order.showtimeId) : null;
    if (st?.startAt) return st.startAt;
    return order?.showtimeId || "-";
  };

  const formatAmount = (order) => {
    const amount = Number(order?.amountVnd ?? order?.amountVND ?? order?.totalAmount ?? 0);
    return amount > 0 ? `${amount.toLocaleString("vi-VN")} VND` : "-";
  };

  function persistBanners(next) {
    setBanners(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function handleBannerUpload(file) {
    if (!file) return;
    setBannerDraft((prev) => ({ ...prev, image: file }));
  }

  async function saveBanner(event) {
    event.preventDefault();
    setError("");
    const id = String(bannerDraft.id || Date.now()).trim();
    const formData = new FormData();
    formData.append("id", id);
    formData.append("title", "Banner");
    formData.append("description", "");
    formData.append("link", "");
    formData.append("sortOrder", "0");
    formData.append("active", bannerDraft.active ? "true" : "false");
    if (bannerDraft.image) {
      formData.append("image", bannerDraft.image);
    }
    try {
      const saved = await upsertAdminBanner(formData);
      persistBanners([saved, ...banners.filter((b) => b.id !== saved.id)]);
      setBannerDraft({ id: "", image: "", active: true });
      setBannerFileName("");
      setActiveTab("banners");
    } catch (e) {
      setError(e?.message || "Lưu banner thất bại.");
    }
  }

  function editBanner(item) {
    setBannerDraft({
      id: item.id,
      image: item.imageUrl || item.image || "",
      active: item.active !== false
    });
    setActiveTab("banners");
  }

  async function removeBanner(id) {
    try {
      await deleteAdminBanner(id);
      persistBanners(banners.filter((item) => item.id !== id));
    } catch (e) {
      setError(e?.message || "Xóa banner thất bại.");
    }
  }

  async function saveLayout(event) {
    event.preventDefault();
    const theaterId = String(layoutDraft.theaterId || "").trim();
    const hall = String(layoutDraft.hall || "").trim();
    if (!theaterId || !hall) {
      setError(theaterId ? "hall required" : "theaterId required");
      return;
    }
    const rows = layoutDraft.rows
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const blockedSeats = layoutDraft.blockedSeats
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const item = {
      id: `${theaterId}-${hall}`.toLowerCase().replace(/\s+/g, "-"),
      theaterId,
      theater: theaterId,
      cinema: theaterId,
      hall,
      rows,
      cols: Number(layoutDraft.cols) || 10,
      blockedSeats,
      seatPrices: {
        standard: Number(layoutDraft.seatPrices?.standard) || DEFAULT_SEAT_PRICES.standard,
        vip: Number(layoutDraft.seatPrices?.vip) || DEFAULT_SEAT_PRICES.vip,
        couple: Number(layoutDraft.seatPrices?.couple) || DEFAULT_SEAT_PRICES.couple
      },
      seats: (layoutDraft.seats || [])
        .map((s) => ({
          code: String(s.code || "").trim().toUpperCase(),
          x: Number(s.x) || 0,
          y: Number(s.y) || 0,
          type: String(s.type || "standard").trim().toLowerCase(),
          enabled: Boolean(s.enabled)
        }))
        .filter((s) => s.code)
    };
    try {
      if (!layoutDraft.theaterId || !layoutDraft.hall) {
        throw new Error(layoutDraft.theaterId ? "hall required" : "theaterId required");
      }
      await upsertAdminSeatLayout(item);
      setLayouts((prev) => [
        item,
        ...prev.filter((l) => !(String(l.theaterId || l.theater || l.cinema || "") === item.theaterId && l.hall.toLowerCase() === item.hall.toLowerCase()))
      ]);
      setActiveTab("layouts");
    } catch (e) {
      setError(e?.message || "Lưu bố trí ghế thất bại.");
    }
  }

  async function removeMovie(id) {
    try {
      await deleteAdminMovie(id);
      setMovies((prev) => prev.filter((m) => m.id !== id));
      setShowtimes((prev) => prev.filter((s) => s.movieId !== id));
    } catch (e) {
      setError(e?.message || "Xóa phim thất bại.");
    }
  }

  async function removeShowtime(id) {
    try {
      await deleteAdminShowtime(id);
      setShowtimes((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e?.message || "Xóa suất thất bại.");
    }
  }

  async function removeLayout(hall) {
    try {
      await deleteAdminSeatLayout(hall);
      setLayouts((prev) => prev.filter((l) => l.hall.toLowerCase() !== hall.toLowerCase()));
    } catch (e) {
      setError(e?.message || "Xóa layout thất bại.");
    }
  }

  function regenerateSeatsFromGrid() {
    setLayoutDraft((prev) => ({
      ...prev,
      seats: makeSeatNodesFromGrid(prev.rows, prev.cols)
    }));
  }

  function addSeatNode() {
    setLayoutDraft((prev) => ({
      ...prev,
      seats: [
        ...(prev.seats || []),
        { ...nextSeatNode(prev.seats, prev.cols), type: quickAddSeatType }
      ]
    }));
  }

  function seatTypeImage(type) {
    const seatType = String(type || "standard").toLowerCase();
    if (seatType === "vip") return gheVipImg;
    if (seatType === "couple") return gheDoiImg;
    return gheThuongImg;
  }

  function updateSeatNode(index, patch) {
    setLayoutDraft((prev) => ({
      ...prev,
      seats: (prev.seats || []).map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      )
    }));
  }

  function removeSeatNode(index) {
    setLayoutDraft((prev) => ({
      ...prev,
      seats: (prev.seats || []).filter((_, idx) => idx !== index)
    }));
  }


  const totalRevenue = useMemo(() => {
    return orders
      .filter((o) => {
        const s = String(o.status || "").toLowerCase();
        return s === "paid" || s === "success" || s === "completed" || s === "done";
      })
      .reduce((acc, o) => {
        const amount = Number(o?.amountVnd ?? o?.amountVND ?? o?.totalAmount ?? 0);
        return acc + amount;
      }, 0);
  }, [orders]);

  const getBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid" || s === "success" || s === "completed" || s === "done") {
      return "admin-badge admin-badge--paid";
    }
    if (s === "pending" || s === "processing") {
      return "admin-badge admin-badge--pending";
    }
    return "admin-badge admin-badge--failed";
  };

  return (
    <div className="admin-layout-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <h2>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#60a5fa" }}
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
            Bloop Cinema
          </h2>
        </div>

        <nav className="admin-sidebar__nav">
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "movies" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("movies")}
          >
            🎬 Danh sách phim
          </button>
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "showtimes" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("showtimes")}
          >
            🕒 Lịch chiếu phim
          </button>
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "layouts" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("layouts")}
          >
            💺 Bố trí ghế ngồi
          </button>
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "theaters" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("theaters")}
          >
            🏛️ Quản lý rạp
          </button>
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "orders" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            💵 Giao dịch vé
          </button>
          <button
            type="button"
            className={`admin-sidebar__item ${activeTab === "banners" ? "admin-sidebar__item--active" : ""}`}
            onClick={() => setActiveTab("banners")}
          >
            🖼️ Banner trang chủ
          </button>
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <span className="admin-sidebar__user-email">{user?.email || "admin@bloop.local"}</span>
            <span className="admin-sidebar__user-role">{user?.role || "Administrator"}</span>
          </div>
          <button
            type="button"
            className="admin-sidebar__logout-btn"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            🚪 Đăng xuất
          </button>
        </div>
      </aside>

      <main className="admin-main-content">
        <div className="admin-layout-page__head" style={{ marginBottom: "30px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>Quản trị hệ thống</h1>
          <p style={{ color: "#94a3b8", marginTop: "6px" }}>Bảng điều khiển quản lý phòng vé, lịch chiếu và cấu hình rạp Bloop Cinema.</p>
        </div>

        {/* Metrics Grid */}
        <div className="admin-metrics-grid">
          <div className="admin-metric-card">
            <div className="admin-metric-card__info">
              <span className="admin-metric-card__label">Tổng phim</span>
              <span className="admin-metric-card__value">{movies.length}</span>
            </div>
            <div className="admin-metric-card__icon admin-metric-card__icon--blue">
              🎬
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-card__info">
              <span className="admin-metric-card__label">Suất chiếu</span>
              <span className="admin-metric-card__value">{showtimes.length}</span>
            </div>
            <div className="admin-metric-card__icon admin-metric-card__icon--purple">
              🕒
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-card__info">
              <span className="admin-metric-card__label">Rạp chiếu</span>
              <span className="admin-metric-card__value">{theaters.length}</span>
            </div>
            <div className="admin-metric-card__icon admin-metric-card__icon--indigo">
              🏛️
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-card__info">
              <span className="admin-metric-card__label">Doanh thu vé</span>
              <span className="admin-metric-card__value">{totalRevenue.toLocaleString("vi-VN")} đ</span>
            </div>
            <div className="admin-metric-card__icon admin-metric-card__icon--emerald">
              💵
            </div>
          </div>
        </div>

        {loading ? <p className="section-muted" style={{ color: "#94a3b8" }}>Đang tải dữ liệu admin...</p> : null}
        {error ? <p className="book-error" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "12px 14px", borderRadius: "12px", fontSize: "13px" }}>{error}</p> : null}

        {activeTab === "movies" ? (
          <div className="admin-glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Danh sách phim</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="admin-login-submit" style={{ padding: "8px 16px !important", width: "auto" }} onClick={() => navigate("/admin/movies/new")}>
                  + Thêm phim
                </button>
                <button type="button" className="btn-secondary" onClick={loadAdminData}>
                  Tải lại
                </button>
              </div>
            </div>
            {moviesError ? <p className="book-error">{moviesError}</p> : null}
            <div className="admin-table-container">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Tên phim</th>
                    <th>ID Phim</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {movies.slice(0, 30).map((m) => (
                    <tr key={m.id}>
                      <td><strong>{m.title}</strong></td>
                      <td><code>{m.id}</code></td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/admin/movies/${encodeURIComponent(m.id)}`)}
                          >
                            Sửa
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => removeMovie(m.id)}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "showtimes" ? (
          <div className="admin-glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Danh sách suất chiếu</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="admin-login-submit" style={{ padding: "8px 16px !important", width: "auto" }} onClick={() => navigate("/admin/showtimes/new")}>
                  + Thêm suất
                </button>
                <button type="button" className="btn-secondary" onClick={loadAdminData}>
                  Tải lại
                </button>
              </div>
            </div>
            {showtimesError ? <p className="book-error">{showtimesError}</p> : null}
            <div className="admin-table-container">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Mã suất chiếu</th>
                    <th>Phim</th>
                    <th>Phòng chiếu (Hall)</th>
                    <th>Thời gian bắt đầu</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {showtimes.slice(0, 50).map((s) => (
                    <tr key={s.id}>
                      <td><code>{s.id}</code></td>
                      <td><strong>{movieMap.get(s.movieId) || s.movieId}</strong></td>
                      <td>{s.hall}</td>
                      <td>{String(s.startAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/admin/showtimes/${encodeURIComponent(s.id)}`)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => removeShowtime(s.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "layouts" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div className="admin-glass-panel">
              <h2>Setup bố trí ghế</h2>
              <form className="admin-glass-form" onSubmit={saveLayout}>
                <label>
                  <span>Rạp</span>
                  <select
                    value={layoutDraft.theaterId}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({ ...p, theaterId: e.target.value, hall: "" }))
                    }
                  >
                    <option value="" disabled>-- chọn rạp --</option>
                    {theaters.map((theater) => (
                      <option key={theater.id} value={theater.id}>
                        {theater.name || theater.label || theater.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Phòng chiếu (Hall)</span>
                  <input
                    placeholder="Hall A, Hall B..."
                    value={layoutDraft.hall}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({ ...p, hall: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Hàng ghế (Ví dụ: A,B,C,D,E,F)</span>
                  <input
                    placeholder="Rows (A,B,C,D...)"
                    value={layoutDraft.rows}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({ ...p, rows: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Số cột</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Số cột"
                    value={layoutDraft.cols}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({ ...p, cols: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Ghế bị chặn (Ví dụ: A1,A2...)</span>
                  <input
                    placeholder="Ghế chặn (A1,A2...)"
                    value={layoutDraft.blockedSeats}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({ ...p, blockedSeats: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Giá vé thường (Standard)</span>
                  <input
                    type="number"
                    min={1000}
                    placeholder="Giá ghế thường"
                    value={layoutDraft.seatPrices?.standard || DEFAULT_SEAT_PRICES.standard}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({
                        ...p,
                        seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), standard: Number(e.target.value) || DEFAULT_SEAT_PRICES.standard }
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Giá vé VIP</span>
                  <input
                    type="number"
                    min={1000}
                    placeholder="Giá ghế VIP"
                    value={layoutDraft.seatPrices?.vip || DEFAULT_SEAT_PRICES.vip}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({
                        ...p,
                        seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), vip: Number(e.target.value) || DEFAULT_SEAT_PRICES.vip }
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Giá vé đôi (Couple)</span>
                  <input
                    type="number"
                    min={1000}
                    placeholder="Giá ghế đôi"
                    value={layoutDraft.seatPrices?.couple || DEFAULT_SEAT_PRICES.couple}
                    onChange={(e) =>
                      setLayoutDraft((p) => ({
                        ...p,
                        seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), couple: Number(e.target.value) || DEFAULT_SEAT_PRICES.couple }
                      }))
                    }
                  />
                </label>

                <div className="admin-layout-tools" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
                  <button type="button" className="btn-secondary" onClick={regenerateSeatsFromGrid}>
                    Tạo sơ đồ từ rows/cols
                  </button>
                  <select
                    value={quickAddSeatType}
                    onChange={(e) => setQuickAddSeatType(e.target.value)}
                    className="admin-layout-tools__select"
                    title="Loại ghế khi thêm tự do"
                    style={{ width: "auto !important", display: "inline-block" }}
                  >
                    <option value="standard">Thường</option>
                    <option value="vip">VIP</option>
                    <option value="couple">Đôi</option>
                  </select>
                  <button type="button" className="btn-secondary" onClick={addSeatNode}>
                    Thêm ghế tự do
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(`/admin/layouts/${encodeURIComponent(layoutDraft.hall)}`)}
                  >
                    Mở editor riêng
                  </button>
                </div>

                <div className="admin-seat-editor" style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid rgba(255,255,255,0.05)", padding: "10px", borderRadius: "12px", marginBottom: "16px" }}>
                  {(layoutDraft.seats || []).map((seat, idx) => (
                    <div key={`${seat.code}-${idx}`} className="admin-seat-editor__row" style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                      <input
                        placeholder="Mã ghế"
                        value={seat.code}
                        onChange={(e) =>
                          updateSeatNode(idx, { code: e.target.value.toUpperCase() })
                        }
                        style={{ width: "70px", marginBottom: 0 }}
                      />
                      <input
                        type="number"
                        placeholder="X"
                        value={seat.x}
                        onChange={(e) => updateSeatNode(idx, { x: Number(e.target.value) })}
                        style={{ width: "60px", marginBottom: 0 }}
                      />
                      <input
                        type="number"
                        placeholder="Y"
                        value={seat.y}
                        onChange={(e) => updateSeatNode(idx, { y: Number(e.target.value) })}
                        style={{ width: "60px", marginBottom: 0 }}
                      />
                      <select
                        value={seat.type || "standard"}
                        onChange={(e) => updateSeatNode(idx, { type: e.target.value })}
                        style={{ width: "100px", marginBottom: 0 }}
                      >
                        <option value="standard">standard</option>
                        <option value="vip">vip</option>
                        <option value="couple">couple</option>
                        <option value="aisle">aisle</option>
                      </select>
                      <label className="admin-seat-editor__check" style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(seat.enabled)}
                          onChange={(e) => updateSeatNode(idx, { enabled: e.target.checked })}
                          style={{ width: "auto !important", marginBottom: 0 }}
                        />
                        active
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeSeatNode(idx)}
                        style={{ padding: "4px 8px" }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
                <button type="submit" className="admin-login-submit">Lưu layout</button>
              </form>
            </div>

            <div className="admin-glass-panel">
              <h2>Sơ đồ ghế hiện có</h2>
              <div style={{ marginBottom: 16 }}>
                <button type="button" className="btn-secondary" onClick={loadAdminData}>
                  Tải lại
                </button>
              </div>
              {layoutsError ? <p className="book-error">{layoutsError}</p> : null}
              <div style={{ display: "grid", gap: 16 }}>
                {layouts.map((l) => (
                  <div key={l.hall} className="admin-layout-card" style={{ background: "rgba(15,23,42,0.3)", padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="admin-layout-card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <strong>{theaters.find((t) => t.id === (l.theaterId || l.theater || l.cinema))?.name || "Bố trí ghế"} · {l.hall}</strong>
                      <div className="admin-layout-card__actions" style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(`/admin/layouts/${encodeURIComponent(l.hall)}`)}
                        >
                          Chỉnh sửa canvas
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeLayout(l.id || l.hall)}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                    <div className="admin-seat-preview" style={{ position: "relative", minHeight: "150px", background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 10 }}>
                      {(l.seats || []).length ? (
                        <div className="admin-seat-preview-free" style={{ position: "relative", height: "200px", overflow: "auto" }}>
                          {l.seats.map((seat) => {
                            const blocked = (l.blockedSeats || []).includes(seat.code);
                            return (
                              <span
                                key={seat.code}
                                className={blocked ? "admin-seat admin-seat--blocked" : "admin-seat"}
                                style={{
                                  position: "absolute",
                                  left: `${seat.x}px`,
                                  top: `${seat.y}px`,
                                  backgroundImage: `url(${seatTypeImage(seat.type)})`,
                                  backgroundSize: "100% 100%",
                                  backgroundRepeat: "no-repeat",
                                  backgroundPosition: "center",
                                  border: "none",
                                  padding: 0,
                                  color: "#fff",
                                  width: "24px",
                                  height: "24px",
                                  fontSize: "8px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  textShadow: "0 1px 1px rgba(0,0,0,.45)"
                                }}
                              >
                                {seat.code}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        l.rows.map((r) => (
                          <div key={r} className="admin-seat-row" style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                            {makeColNumbers(l.cols).map((c) => {
                              const code = `${r}${c}`;
                              const blocked = (l.blockedSeats || []).includes(code);
                              return (
                                <span
                                  key={code}
                                  className={blocked ? "admin-seat admin-seat--blocked" : "admin-seat"}
                                  style={{
                                    backgroundImage: `url(${gheThuongImg})`,
                                    backgroundSize: "100% 100%",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "center",
                                    border: "none",
                                    padding: 0,
                                    color: "#fff",
                                    width: "24px",
                                    height: "24px",
                                    fontSize: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textShadow: "0 1px 1px rgba(0,0,0,.45)"
                                  }}
                                >
                                  {code}
                                </span>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "theaters" ? (
          <AdminTheatersPage onCreated={() => loadAdminData()} />
        ) : null}

        {activeTab === "orders" ? (
          <div className="admin-glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Danh sách giao dịch mua vé</h2>
              <button type="button" className="btn-secondary" onClick={loadAdminData}>
                Tải lại
              </button>
            </div>
            <div className="admin-table-container">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Mã vé</th>
                    <th>Ghế</th>
                    <th>Phim</th>
                    <th>Rạp</th>
                    <th>Suất</th>
                    <th>Khách hàng</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const seatCodes = getSeatCodes(o);
                    return (
                      <tr key={o.id}>
                        <td><code style={{ fontSize: "11px" }} title={o.id}>{o.id.substring(0, 8)}...</code></td>
                        <td>{seatCodes.join(", ") || o.seatCode || "-"}</td>
                        <td><strong>{getOrderMovieTitle(o)}</strong></td>
                        <td>{getOrderTheaterName(o)}</td>
                        <td><span style={{ fontSize: "13px" }}>{getOrderShowtime(o)}</span></td>
                        <td><span style={{ fontSize: "12px" }}>{getOrderUserName(o)}</span></td>
                        <td>
                          <span className={getBadgeClass(o.status)}>
                            {o.status || "UNKNOWN"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}><strong style={{ color: "#10b981" }}>{formatAmount(o)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "banners" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, alignItems: "start" }}>
            <div className="admin-glass-panel">
              <h2>Quản lý banner trang chủ</h2>
              <form className="admin-glass-form" onSubmit={saveBanner}>
                <label>
                  <span>ID banner (không bắt buộc)</span>
                  <input
                    placeholder="ID banner"
                    value={bannerDraft.id}
                    onChange={(e) => setBannerDraft((p) => ({ ...p, id: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Upload ảnh banner</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setBannerFileName(file ? file.name : "");
                      handleBannerUpload(file);
                    }}
                  />
                  {bannerFileName ? <small style={{ color: "#a1a1aa" }}>{bannerFileName}</small> : null}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row" }}>
                  <input
                    type="checkbox"
                    checked={bannerDraft.active}
                    onChange={(e) => setBannerDraft((p) => ({ ...p, active: e.target.checked }))}
                    style={{ width: "auto !important", marginBottom: 0 }}
                  />
                  <span style={{ color: "#cbd5e1" }}>Kích hoạt</span>
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="admin-login-submit" style={{ flex: 1 }}>Lưu banner</button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setBannerDraft({ id: "", title: "", description: "", image: "", active: true });
                      setBannerFileName("");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-glass-panel">
              <h2>Danh sách banner</h2>
              <div style={{ display: "grid", gap: 16 }}>
                {banners.map((item) => (
                  <div key={item.id} className="admin-banner-item" style={{ display: "flex", gap: 16, background: "rgba(15, 23, 42, 0.3)", padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", alignItems: "center" }}>
                    <img
                      src={(item.imageUrl || item.image) && String(item.imageUrl || item.image).startsWith("/") ? `${window.location.origin.replace(/:\d+$/, ":8082")}${item.imageUrl || item.image}` : (item.imageUrl || item.image)}
                      alt="banner"
                      style={{ width: "120px", height: "60px", objectFit: "cover", borderRadius: 8 }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: "#f8fafc" }}>{item.id}</strong>
                      <p style={{ color: "#64748b", fontSize: "12px", wordBreak: "break-all", margin: "4px 0 0" }}>{item.imageUrl || item.image}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn-secondary" onClick={() => editBanner(item)}>
                        Sửa
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => removeBanner(item.id)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

