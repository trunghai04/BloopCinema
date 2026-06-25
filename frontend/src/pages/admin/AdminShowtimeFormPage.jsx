import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAdminMovies, getAdminSeatLayouts, getAdminShowtimes, getAdminTheaters, upsertAdminShowtime } from "../../api/client";
import { setDocumentTitle } from "../../utils/documentTitle";

const EMPTY_SHOWTIME = { id: "", movieId: "", theaterId: "", hall: "", startAt: "" };

function toDatetimeLocalValue(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIsoFromDatetimeLocal(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString();
}

function formatPreview(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function getMinuteString(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminShowtimeFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const showtimeId = params.showtimeId || "";
  const isEdit = Boolean(showtimeId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movies, setMovies] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [draft, setDraft] = useState({ ...EMPTY_SHOWTIME });
  const [conflictModal, setConflictModal] = useState({ isOpen: false, movieTitle: "", hall: "", startAt: "" });

  useEffect(() => {
    setDocumentTitle(isEdit ? `Admin - Sửa suất ${showtimeId}` : "Admin - Thêm suất chiếu");
  }, [isEdit, showtimeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getAdminMovies(), getAdminShowtimes(), getAdminSeatLayouts(), getAdminTheaters()])
      .then(([mv, sts, lts, ths]) => {
        if (cancelled) return;
        setMovies(mv || []);
        setShowtimes(sts || []);
        setLayouts(lts || []);
        setTheaters(ths || []);
        if (!isEdit) {
          const generatedId = "st" + Date.now().toString().slice(-5) + Math.floor(Math.random() * 10);
          setDraft({ ...EMPTY_SHOWTIME, id: generatedId });
          return;
        }
        const found = (sts || []).find((s) => s.id === showtimeId);
        if (!found) {
          setError("Không tìm thấy suất chiếu để sửa.");
          setDraft({ ...EMPTY_SHOWTIME, id: showtimeId });
          return;
        }
        setDraft({
          ...EMPTY_SHOWTIME,
          ...found,
          theaterId: found.theaterId || found.theater || found.cinema || "hanoi",
          startAt: toDatetimeLocalValue(found.startAt)
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Không tải được dữ liệu suất chiếu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, showtimeId]);

  const hallOptions = useMemo(() => {
    const halls = layouts
      .filter((layout) => {
        const theaterId = String(layout?.theaterId || layout?.theater || layout?.cinema || "").trim();
        return theaterId === draft.theaterId;
      })
      .map((layout) => String(layout.hall || "").trim())
      .filter(Boolean);
    return [...new Set(halls)].sort((a, b) => a.localeCompare(b, "vi"));
  }, [layouts, draft.theaterId]);

  const theaterOptions = useMemo(() => {
    return (theaters || []).map((theater) => ({
      id: theater.id,
      label: theater.name,
    }));
  }, [theaters]);

  const currentConflict = useMemo(() => {
    if (!draft.theaterId || !draft.hall || !draft.startAt) return null;

    const draftMinuteStr = getMinuteString(draft.startAt);
    if (!draftMinuteStr) return null;

    return showtimes.find((st) => {
      if (st.id === draft.id) return false;
      
      const stTheater = String(st.theaterId || st.theater || st.cinema || "").trim();
      const draftTheater = String(draft.theaterId || "").trim();
      
      const stHall = String(st.hall || "").trim();
      const draftHall = String(draft.hall || "").trim();

      if (stTheater !== draftTheater || stHall !== draftHall) return false;

      const stMinuteStr = getMinuteString(st.startAt);
      return stMinuteStr === draftMinuteStr;
    });
  }, [showtimes, draft]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    // Client-side friendly validation
    if (!String(draft.id || "").trim()) {
      setError("Vui lòng điền mã suất chiếu (ví dụ: st100).");
      return;
    }
    if (!draft.movieId) {
      setError("Vui lòng chọn phim.");
      return;
    }
    if (!draft.theaterId) {
      setError("Vui lòng chọn rạp.");
      return;
    }
    if (!draft.hall) {
      setError("Vui lòng chọn phòng chiếu (hall).");
      return;
    }
    if (!draft.startAt) {
      setError("Vui lòng chọn ngày và giờ chiếu.");
      return;
    }

    try {
      const normalizedStartAt = toUtcIsoFromDatetimeLocal(draft.startAt);
      if (!normalizedStartAt) {
        setError("Thời gian chiếu không hợp lệ.");
        return;
      }

      // Check collision
      const draftMinuteStr = getMinuteString(draft.startAt);
      const conflict = showtimes.find((st) => {
        if (st.id === draft.id) return false;
        
        const stTheater = String(st.theaterId || st.theater || st.cinema || "").trim();
        const draftTheater = String(draft.theaterId || "").trim();
        
        const stHall = String(st.hall || "").trim();
        const draftHall = String(draft.hall || "").trim();

        if (stTheater !== draftTheater || stHall !== draftHall) return false;

        const stMinuteStr = getMinuteString(st.startAt);
        return stMinuteStr === draftMinuteStr;
      });

      if (conflict) {
        const conflictMovie = movies.find((m) => m.id === conflict.movieId);
        const conflictMovieTitle = conflictMovie ? conflictMovie.title : conflict.movieId;
        setConflictModal({
          isOpen: true,
          movieTitle: conflictMovieTitle,
          hall: draft.hall,
          startAt: formatPreview(draft.startAt),
        });
        return;
      }

      const payload = {
        ...draft,
        startAt: normalizedStartAt,
        theaterId: draft.theaterId,
        theater: draft.theaterId,
        cinema: draft.theaterId,
        hall: String(draft.hall || "").trim()
      };
      await upsertAdminShowtime(payload);
      navigate("/admin");
    } catch (err) {
      setError(err?.message || "Lưu suất chiếu thất bại.");
    }
  }

  if (loading) return <p className="section-muted">Đang tải…</p>;

  return (
    <section className="admin-console">
      <header className="admin-console__header">
        <div className="admin-console__intro">
          <h1>{isEdit ? "Sửa suất chiếu" : "Thêm suất chiếu"}</h1>
          <p>Chuẩn hóa `startAt` sang ISO UTC trước khi lưu. Dữ liệu preview hiển thị theo giờ địa phương.</p>
          {!draft.id || !draft.movieId || !draft.startAt || !draft.hall ? (
            <p className="section-muted" style={{ marginTop: 8 }}>
              Điền đủ mã suất, phim, rạp chiếu và giờ chiếu rồi bấm tạo/cập nhật.
            </p>
          ) : null}
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate("/admin")}>
          Quay lại
        </button>
      </header>

      {error ? <p className="book-error">{error}</p> : null}
      {currentConflict ? (
        <p className="book-error" style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}>
          Lưu ý: Khung giờ và phòng này đã được xếp lịch cho phim "{movies.find((m) => m.id === currentConflict.movieId)?.title || currentConflict.movieId}".
        </p>
      ) : null}

      <div className="admin-grid">
        <form className="item-card admin-form admin-panel admin-showtime-form" onSubmit={submit}>
          <h2>Thông tin suất</h2>
          <input
            value={draft.id}
            disabled
            title="Mã suất chiếu được tạo tự động bởi hệ thống"
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          />
          <select value={draft.movieId} onChange={(e) => setDraft((p) => ({ ...p, movieId: e.target.value }))}>
            <option value="">-- chọn phim --</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.id})
              </option>
            ))}
          </select>
          <select
            value={draft.theaterId}
            onChange={(e) => setDraft((p) => ({ ...p, theaterId: e.target.value, hall: "" }))}
          >
            <option value="">-- chọn rạp --</option>
            {theaterOptions.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.label}
              </option>
            ))}
          </select>
          <select
            value={draft.hall}
            onChange={(e) => setDraft((p) => ({ ...p, hall: e.target.value }))}
            disabled={!draft.theaterId}
          >
            <option value="">-- chọn hall --</option>
            {hallOptions.map((hall) => (
              <option key={hall} value={hall}>
                {hall}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={draft.startAt}
            onChange={(e) => setDraft((p) => ({ ...p, startAt: e.target.value }))}
          />
          <button type="submit">
            {isEdit ? "Cập nhật suất" : "Tạo suất"}
          </button>
        </form>

        <div className="item-card admin-panel admin-showtime-preview">
          <h2>Preview</h2>
          <div className="admin-showtime-preview__meta">
            <div><strong>Phim:</strong> {movies.find((m) => m.id === draft.movieId)?.title || draft.movieId || "--"}</div>
            <div><strong>Rạp:</strong> {theaterOptions.find((t) => t.id === draft.theaterId)?.label || "--"}</div>
            <div><strong>Hall:</strong> {draft.hall || "--"}</div>
            <div><strong>Giờ chiếu:</strong> {formatPreview(draft.startAt)}</div>
          </div>
        </div>
      </div>

      {conflictModal.isOpen && (
        <div className="movie-detail-confirm-overlay" style={{ zIndex: 100 }}>
          <div className="movie-detail-confirm-modal" style={{ maxWidth: 480, textAlign: "center" }}>
            <button
              type="button"
              className="movie-detail-confirm-modal__close"
              aria-label="Đóng"
              onClick={() => setConflictModal({ isOpen: false, movieTitle: "", hall: "", startAt: "" })}
            >
              ×
            </button>
            <p className="movie-detail-confirm-modal__kicker" style={{ color: "#dc2626" }}>
              TRÙNG LỊCH CHIẾU
            </p>
            <h3 className="movie-detail-confirm-modal__title" style={{ fontSize: 24, marginBottom: 16 }}>
              Không thể xếp lịch
            </h3>
            <div style={{ padding: "16px 0", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: "#374151", margin: 0 }}>
                Phòng <strong>{conflictModal.hall}</strong> vào lúc <strong>{conflictModal.startAt}</strong> đã được thêm cho phim:
              </p>
              <p style={{ color: "var(--navy)", fontSize: 18, fontWeight: 800, margin: "10px 0 0" }}>
                {conflictModal.movieTitle}
              </p>
            </div>
            <p className="section-muted" style={{ fontSize: 13, marginBottom: 20 }}>
              Vui lòng thay đổi khung giờ hoặc phòng chiếu khác mà không cần nhập lại thông tin.
            </p>
            <button
              type="button"
              className="movie-detail-confirm-modal__agree"
              style={{ margin: "0 auto", display: "block" }}
              onClick={() => setConflictModal({ isOpen: false, movieTitle: "", hall: "", startAt: "" })}
            >
              CHỌN LẠI GIỜ
            </button>
          </div>
        </div>
      )}

      {/* Debug Info Panel */}
      <div style={{ marginTop: 30, padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", maxWidth: 600 }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#1e293b", fontSize: 18 }}>Thông tin Debug (Kiểm tra trùng lịch)</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, color: "#475569" }}>
          <li><strong>Tổng số suất chiếu:</strong> {showtimes.length}</li>
          <li><strong>Mã suất chiếu đang mở:</strong> {draft.id || "--"}</li>
          <li><strong>Rạp:</strong> {draft.theaterId || "--"}</li>
          <li><strong>Phòng (Hall):</strong> {draft.hall || "--"}</li>
          <li><strong>Khung giờ chọn:</strong> {draft.startAt || "--"} (định dạng local)</li>
          <li><strong>Khung giờ so sánh (stMinuteStr):</strong> {getMinuteString(draft.startAt) || "--"}</li>
          <li><strong>Trạng thái Trùng lịch:</strong> {currentConflict ? (
            <span style={{ color: "#ef4444", fontWeight: "bold" }}>
              CÓ TRÙNG (Với suất "{currentConflict.id}" - Phim "{movies.find(m => m.id === currentConflict.movieId)?.title || currentConflict.movieId}")
            </span>
          ) : (
            <span style={{ color: "#22c55e", fontWeight: "bold" }}>KHÔNG TRÙNG</span>
          )}</li>
        </ul>
      </div>
    </section>
  );
}

