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
  const [draft, setDraft] = useState({ ...EMPTY_SHOWTIME });

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
    </section>
  );
}

