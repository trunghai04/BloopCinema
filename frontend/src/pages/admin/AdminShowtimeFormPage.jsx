import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAdminMovies, getAdminShowtimes, upsertAdminShowtime } from "../../api/client";
import { setDocumentTitle } from "../../utils/documentTitle";

const EMPTY_SHOWTIME = { id: "", movieId: "", hall: "Hall A", startAt: "" };

function toDatetimeLocalValue(iso) {
  const d = new Date(iso);
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
  const [draft, setDraft] = useState({ ...EMPTY_SHOWTIME });

  useEffect(() => {
    setDocumentTitle(isEdit ? `Admin - Sửa suất ${showtimeId}` : "Admin - Thêm suất chiếu");
  }, [isEdit, showtimeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getAdminMovies(), getAdminShowtimes()])
      .then(([mv, sts]) => {
        if (cancelled) return;
        setMovies(mv || []);
        if (!isEdit) {
          setDraft({ ...EMPTY_SHOWTIME });
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

  const canSubmit = useMemo(() => Boolean(draft.id && draft.movieId && draft.startAt && draft.hall), [draft]);

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    try {
      const normalizedStartAt = draft.startAt ? new Date(draft.startAt).toISOString() : "";
      await upsertAdminShowtime({ ...draft, startAt: normalizedStartAt });
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
          <p>Chuẩn hóa `startAt` sang ISO UTC trước khi lưu.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate("/admin")}>
          Quay lại
        </button>
      </header>

      {error ? <p className="book-error">{error}</p> : null}

      <div className="admin-grid">
        <form className="item-card admin-form admin-panel" onSubmit={submit}>
          <h2>Thông tin suất</h2>
          <input
            placeholder="showtime id (vd: st200)"
            value={draft.id}
            disabled={isEdit}
            onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))}
          />
          <select value={draft.movieId} onChange={(e) => setDraft((p) => ({ ...p, movieId: e.target.value }))}>
            <option value="">-- chọn phim --</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.id})
              </option>
            ))}
          </select>
          <input
            placeholder="Hall"
            value={draft.hall}
            onChange={(e) => setDraft((p) => ({ ...p, hall: e.target.value }))}
          />
          <input
            type="datetime-local"
            value={draft.startAt}
            onChange={(e) => setDraft((p) => ({ ...p, startAt: e.target.value }))}
          />
          <button type="submit" disabled={!canSubmit}>
            {isEdit ? "Cập nhật suất" : "Tạo suất"}
          </button>
        </form>

        <div className="item-card admin-panel">
          <h2>Preview</h2>
          <p className="section-muted" style={{ marginTop: 0 }}>
            {draft.movieId || "--"} · {draft.hall || "--"} ·{" "}
            {draft.startAt ? new Date(draft.startAt).toLocaleString("vi-VN") : "--"}
          </p>
        </div>
      </div>
    </section>
  );
}

