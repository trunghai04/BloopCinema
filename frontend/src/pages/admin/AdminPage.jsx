import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteAdminMovie,
  deleteAdminSeatLayout,
  deleteAdminShowtime,
  getAdminMovies,
  getAdminSeatLayouts,
  getAdminShowtimes,
  upsertAdminSeatLayout,
} from "../../api/client";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("movies");

  const [layoutDraft, setLayoutDraft] = useState({
    hall: "Hall A",
    rows: "A,B,C,D,E,F",
    cols: 10,
    blockedSeats: "",
    seatPrices: { ...DEFAULT_SEAT_PRICES },
    seats: makeSeatNodesFromGrid("A,B,C,D,E,F", 10)
  });
  const [quickAddSeatType, setQuickAddSeatType] = useState("standard");

  useEffect(() => {
    setDocumentTitle("Admin Console");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getAdminMovies(), getAdminShowtimes(), getAdminSeatLayouts()])
      .then(([remoteMovies, remoteShowtimes, remoteLayouts]) => {
        if (cancelled) return;
        setMovies(remoteMovies || []);
        setShowtimes(remoteShowtimes || []);
        setLayouts(remoteLayouts || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Không tải được dữ liệu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const movieMap = useMemo(() => {
    const m = new Map();
    movies.forEach((item) => m.set(item.id, item.title));
    return m;
  }, [movies]);

  async function saveLayout(event) {
    event.preventDefault();
    if (!layoutDraft.hall) return;
    const rows = layoutDraft.rows
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const blockedSeats = layoutDraft.blockedSeats
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const item = {
      hall: layoutDraft.hall,
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
      await upsertAdminSeatLayout(item);
      setLayouts((prev) => [
        item,
        ...prev.filter((l) => l.hall.toLowerCase() !== item.hall.toLowerCase())
      ]);
      setActiveTab("layouts");
    } catch (e) {
      setError(e?.message || "Lưu bố trí ghế thất bại.");
    }
  }

  function exportConfig() {
    const payload = {
      movies,
      showtimes,
      layouts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <p>
            Quản trị cấu hình phim, suất chiếu, bố trí ghế trực tiếp qua API admin.
          </p>
          <div className="admin-console__stats">
            <span>{movies.length} phim</span>
            <span>{showtimes.length} suất chiếu</span>
            <span>{layouts.length} sơ đồ ghế</span>
          </div>
        </div>
        <button type="button" className="admin-export-btn" onClick={exportConfig}>
          Export cấu hình JSON
        </button>
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
      </nav>

      {loading ? <p className="section-muted">Đang tải dữ liệu admin...</p> : null}
      {error ? <p className="book-error">{error}</p> : null}

      {activeTab === "movies" ? (
        <div className="admin-grid">
          <div className="item-card admin-list admin-panel">
            <h2>Danh sách phim</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate("/admin/movies/new")}>
                + Thêm phim
              </button>
            </div>
            {movies.slice(0, 30).map((m) => (
              <div key={m.id} className="admin-row">
                <strong>{m.title}</strong>
                <span>{m.id}</span>
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
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "showtimes" ? (
        <div className="admin-grid">
          <div className="item-card admin-list admin-panel">
            <h2>Danh sách suất chiếu</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate("/admin/showtimes/new")}>
                + Thêm suất
              </button>
            </div>
            {showtimes.slice(0, 50).map((s) => (
              <div key={s.id} className="admin-row">
                <strong>{s.id}</strong>
                <span>
                  {movieMap.get(s.movieId) || s.movieId} · {s.hall} · {String(s.startAt)}
                </span>
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
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "layouts" ? (
        <div className="admin-grid">
          <form className="item-card admin-form admin-panel" onSubmit={saveLayout}>
            <h2>Setup bố trí ghế</h2>
            <input
              placeholder="Hall (vd: Hall A)"
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
          <div className="item-card admin-list admin-panel">
            <h2>Layouts hiện có</h2>
            {layouts.map((l) => (
              <div key={l.hall} className="admin-layout-card">
                <div className="admin-layout-card__head">
                  <strong>{l.hall}</strong>
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
                      onClick={() => removeLayout(l.hall)}
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
    </section>
  );
}

