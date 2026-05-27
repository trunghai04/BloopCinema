import { useEffect, useMemo, useState } from "react";
import { getAdminBanners, upsertAdminBanner, deleteAdminBanner } from "../../api/client";
import { useNavigate } from "react-router-dom";
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


  return (
    <section className="admin-console">
      <header className="admin-console__header">
        <div className="admin-console__intro">
          <h1>Admin Cinema Console</h1>
         
          <div className="admin-console__stats">
            <span>{movies.length} phim</span>
            <span>{showtimes.length} suất chiếu</span>
            <span>{layouts.length} sơ đồ ghế</span>
          </div>
        </div>
        
      </header>

      <nav className="admin-tabs" aria-label="Admin tabs">
        <button
          type="button"
          className={activeTab === "movies" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("movies")}
        >
          Phim
        </button>
        <button
          type="button"
          className={activeTab === "showtimes" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("showtimes")}
        >
          Suất chiếu
        </button>
        <button
          type="button"
          className={activeTab === "layouts" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("layouts")}
        >
          Bố trí ghế
        </button>
        <button
          type="button"
          className={activeTab === "theaters" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("theaters")}
        >
          Rạp
        </button>
        <button
          type="button"
          className={activeTab === "orders" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("orders")}
        >
          Order
        </button>
        <button
          type="button"
          className={activeTab === "banners" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setActiveTab("banners")}
        >
          Banner
        </button>
      </nav>

      {loading ? <p className="section-muted">Đang tải dữ liệu admin...</p> : null}
      {error ? <p className="book-error">{error}</p> : null}

      {activeTab === "movies" ? (
        <div className="admin-horizontal-section">
          <div className="item-card admin-list admin-panel admin-horizontal-card">
            <h2>Danh sách phim</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate("/admin/movies/new")}>
                + Thêm phim
              </button>
              <button type="button" className="btn-secondary" onClick={loadAdminData}>
                Tải lại
              </button>
            </div>
            {moviesError ? <p className="book-error">{moviesError}</p> : null}
            <div className="admin-horizontal-items">
              {movies.slice(0, 30).map((m) => (
                <div key={m.id} className="admin-row admin-row--horizontal">
                  <div className="admin-row__main">
                    <strong>{m.title}</strong>
                    <span>{m.id}</span>
                  </div>
                  <div className="admin-row__actions">
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
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "showtimes" ? (
        <div className="admin-horizontal-section">
          <div className="item-card admin-list admin-panel admin-horizontal-card">
            <h2>Danh sách suất chiếu</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate("/admin/showtimes/new")}>
                + Thêm suất
              </button>
              <button type="button" className="btn-secondary" onClick={loadAdminData}>
                Tải lại
              </button>
            </div>
            {showtimesError ? <p className="book-error">{showtimesError}</p> : null}
            <div className="admin-horizontal-items">
              {showtimes.slice(0, 50).map((s) => (
                <div key={s.id} className="admin-row admin-row--horizontal">
                  <div className="admin-row__main">
                    <strong>{s.id}</strong>
                    <span>
                      {movieMap.get(s.movieId) || s.movieId} · {s.hall} · {String(s.startAt)}
                    </span>
                  </div>
                  <div className="admin-row__actions">
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
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "layouts" ? (
        <div className="admin-horizontal-section">
          <form className="item-card admin-form admin-panel admin-horizontal-card" onSubmit={saveLayout}>
            <h2>Setup bố trí ghế</h2>
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
            <input
              placeholder="Hall (nhập tay, ví dụ: Hall A)"
              value={layoutDraft.hall}
              onChange={(e) =>
                setLayoutDraft((p) => ({ ...p, hall: e.target.value }))
              }
            />
            <input
              placeholder="Rows (A,B,C,D...)"
              value={layoutDraft.rows}
              onChange={(e) =>
                setLayoutDraft((p) => ({ ...p, rows: e.target.value }))
              }
            />
            <input
              type="number"
              min={1}
              placeholder="Số cột"
              value={layoutDraft.cols}
              onChange={(e) =>
                setLayoutDraft((p) => ({ ...p, cols: e.target.value }))
              }
            />
            <input
              placeholder="Ghế chặn (A1,A2...)"
              value={layoutDraft.blockedSeats}
              onChange={(e) =>
                setLayoutDraft((p) => ({ ...p, blockedSeats: e.target.value }))
              }
            />
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
            <div className="admin-layout-tools">
              <button type="button" className="btn-secondary" onClick={regenerateSeatsFromGrid}>
                Tạo sơ đồ từ rows/cols
              </button>
              <select
                value={quickAddSeatType}
                onChange={(e) => setQuickAddSeatType(e.target.value)}
                className="admin-layout-tools__select"
                title="Loại ghế khi thêm tự do"
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
                onClick={() => navigate(`/layouts/${encodeURIComponent(layoutDraft.hall)}`)}
              >
                Mở editor riêng
              </button>
            </div>
            <div className="admin-seat-editor">
              {(layoutDraft.seats || []).map((seat, idx) => (
                <div key={`${seat.code}-${idx}`} className="admin-seat-editor__row">
                  <input
                    placeholder="Mã ghế"
                    value={seat.code}
                    onChange={(e) =>
                      updateSeatNode(idx, { code: e.target.value.toUpperCase() })
                    }
                  />
                  <input
                    type="number"
                    placeholder="X"
                    value={seat.x}
                    onChange={(e) => updateSeatNode(idx, { x: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    placeholder="Y"
                    value={seat.y}
                    onChange={(e) => updateSeatNode(idx, { y: Number(e.target.value) })}
                  />
                  <select
                    value={seat.type || "standard"}
                    onChange={(e) => updateSeatNode(idx, { type: e.target.value })}
                  >
                    <option value="standard">standard</option>
                    <option value="vip">vip</option>
                    <option value="couple">couple</option>
                    <option value="aisle">aisle</option>
                  </select>
                  <label className="admin-seat-editor__check">
                    <input
                      type="checkbox"
                      checked={Boolean(seat.enabled)}
                      onChange={(e) => updateSeatNode(idx, { enabled: e.target.checked })}
                    />
                    active
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeSeatNode(idx)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
            <button type="submit">Lưu layout</button>
          </form>
          <div className="item-card admin-list admin-panel admin-horizontal-card">
            <h2>Layouts hiện có</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" className="btn-secondary" onClick={loadAdminData}>
                Tải lại
              </button>
            </div>
            {layoutsError ? <p className="book-error">{layoutsError}</p> : null}
            {layouts.map((l) => (
              <div key={l.hall} className="admin-layout-card">
                <div className="admin-layout-card__head">
                  <strong>{theaters.find((t) => t.id === (l.theaterId || l.theater || l.cinema))?.name || "Bố trí ghế"} · {l.hall}</strong>
                  <div className="admin-layout-card__actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/layouts/${encodeURIComponent(l.hall)}`)}
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
                <div className="admin-seat-preview">
                  {(l.seats || []).length ? (
                    <div className="admin-seat-preview-free">
                      {l.seats.map((seat) => {
                        const blocked = (l.blockedSeats || []).includes(seat.code);
                        return (
                          <span
                            key={seat.code}
                            className={blocked ? "admin-seat admin-seat--blocked" : "admin-seat"}
                            style={{
                              left: `${seat.x}px`,
                              top: `${seat.y}px`,
                              backgroundImage: `url(${seatTypeImage(seat.type)})`,
                              backgroundSize: "100% 100%",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                              border: "none",
                              padding: 0,
                              color: "#fff",
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
                      <div key={r} className="admin-seat-row">
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
      ) : null}

      {activeTab === "theaters" ? (
        <AdminTheatersPage onCreated={() => loadAdminData()} />
      ) : null}

      {activeTab === "orders" ? (
        <div className="admin-horizontal-section">
          <div className="item-card admin-list admin-panel admin-horizontal-card">
            <h2>Danh sách giao dịch mua vé</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" className="btn-secondary" onClick={loadAdminData}>
                Tải lại
              </button>
            </div>
            <div className="admin-order-table" style={{ overflowX: "auto" }}>
              <div className="admin-order-table__head">
                <span>Mã vé</span>
                <span>Số ghế</span>
                <span>Ghế</span>
                <span>Phim</span>
                <span>Rạp</span>
                <span>Suất</span>
                <span>User</span>
                <span>Trạng thái</span>
                <span>Số tiền</span>
              </div>
              {orders.map((o) => {
                const seatCodes = getSeatCodes(o);
                return (
                  <div key={o.id} className="admin-order-table__row">
                    <span className="admin-order-table__cell admin-order-table__cell--id" title={o.id}>{o.id}</span>
                    <span title={String(seatCodes.length)}>{seatCodes.length}</span>
                    <span title={seatCodes.length ? seatCodes.join(", ") : o.seatCode || "-"}>{seatCodes.length ? seatCodes.join(", ") : o.seatCode || "-"}</span>
                    <span title={getOrderMovieTitle(o)}>{getOrderMovieTitle(o)}</span>
                    <span title={getOrderTheaterName(o)}>{getOrderTheaterName(o)}</span>
                    <span title={getOrderShowtime(o)}>{getOrderShowtime(o)}</span>
                    <span title={getOrderUserName(o)}>{getOrderUserName(o)}</span>
                    <span title={o.status || "-"}>{o.status || "-"}</span>
                    <span title={formatAmount(o)}>{formatAmount(o)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "banners" ? (
        <div className="admin-horizontal-section">
          <form className="item-card admin-list admin-panel admin-horizontal-card" onSubmit={saveBanner}>
            <h2>Quản lý banner trang chủ</h2>
            <input
              placeholder="ID banner (không bắt buộc)"
              value={bannerDraft.id}
              onChange={(e) => setBannerDraft((p) => ({ ...p, id: e.target.value }))}
            />
            <label style={{ display: "grid", gap: 6 }}>
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
              {bannerFileName ? <small>{bannerFileName}</small> : null}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={bannerDraft.active}
                onChange={(e) => setBannerDraft((p) => ({ ...p, active: e.target.checked }))}
              />
              Kích hoạt
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit">Lưu banner</button>
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
          <div className="item-card admin-list admin-panel admin-horizontal-card">
            <h2>Danh sách banner</h2>
            <div className="admin-banner-list">
              {banners.map((item) => (
                <div key={item.id} className="admin-banner-item">
                  <img src={(item.imageUrl || item.image) && String(item.imageUrl || item.image).startsWith("/") ? `${window.location.origin.replace(/:\d+$/, ":8082")}${item.imageUrl || item.image}` : (item.imageUrl || item.image)} alt="banner" className="admin-banner-item__image" />
                  <div className="admin-banner-item__body">
                    <strong>{item.id}</strong>
                    <p>{item.imageUrl || item.image}</p>
                  </div>
                  <div className="admin-banner-item__actions">
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
    </section>
  );
}

