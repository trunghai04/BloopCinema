import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAdminMovies, upsertAdminMovie } from "../../api/client";
import { setDocumentTitle } from "../../utils/documentTitle";

const EMPTY_MOVIE = {
  id: "",
  title: "",
  genre: "",
  durationMin: 120,
  ageRating: "T13",
  description: "",
  language: "",
  premiereDate: "",
  director: "",
  cast: "",
  posterUrl: "",
  backdropUrl: "",
  trailerYoutubeId: "",
  synopsis: ""
};

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read file failed"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

function formatDateVN(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function AdminMovieFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const movieId = params.movieId || "";
  const isEdit = Boolean(movieId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movieDraft, setMovieDraft] = useState({ ...EMPTY_MOVIE });

  useEffect(() => {
    setDocumentTitle(isEdit ? `Admin - Sửa phim ${movieId}` : "Admin - Thêm phim");
  }, [isEdit, movieId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdminMovies()
      .then((movies) => {
        if (cancelled) return;
        if (!isEdit) {
          const generatedId = "mv" + Date.now().toString().slice(-5) + Math.floor(Math.random() * 10);
          setMovieDraft({ ...EMPTY_MOVIE, id: generatedId });
          return;
        }
        const found = (movies || []).find((m) => m.id === movieId);
        if (!found) {
          setError("Không tìm thấy phim để sửa.");
          setMovieDraft({ ...EMPTY_MOVIE, id: movieId });
          return;
        }
        setMovieDraft({
          ...EMPTY_MOVIE,
          ...found,
          durationMin: Number(found.durationMin) || 120,
          ageRating: found.ageRating || "T13"
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Không tải được dữ liệu phim.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, movieId]);

  const canSubmit = useMemo(() => Boolean(movieDraft.id && movieDraft.title), [movieDraft.id, movieDraft.title]);

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    try {
      const payload = {
        ...movieDraft,
        id: String(movieDraft.id || "").trim(),
        title: String(movieDraft.title || "").trim(),
        genre: String(movieDraft.genre || "").trim(),
        durationMin: Number(movieDraft.durationMin) || 120,
        ageRating: String(movieDraft.ageRating || "T13").trim(),
        description: String(movieDraft.description || "").trim(),
        language: String(movieDraft.language || "").trim(),
        premiereDate: String(movieDraft.premiereDate || "").trim(),
        director: String(movieDraft.director || "").trim(),
        cast: String(movieDraft.cast || "").trim(),
        posterUrl: String(movieDraft.posterUrl || "").trim(),
        backdropUrl: String(movieDraft.backdropUrl || "").trim(),
        trailerYoutubeId: String(movieDraft.trailerYoutubeId || "").trim(),
        synopsis: String(movieDraft.synopsis || "").trim()
      };
      await upsertAdminMovie(payload);
      navigate("/admin");
    } catch (err) {
      setError(err?.message || "Lưu phim thất bại.");
    }
  }

  if (loading) return <p className="section-muted">Đang tải…</p>;

  return (
    <section className="admin-console">
      <header className="admin-console__header">
        <div className="admin-console__intro">
          <h1>{isEdit ? "Sửa phim" : "Thêm phim"}</h1>
          <p>Field đã sync theo trang chi tiết users (poster, rating, mô tả, giới thiệu...).</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate("/admin")}>
          Quay lại
        </button>
      </header>

      {error ? <p className="book-error">{error}</p> : null}

      <div className="admin-grid">
        <form className="item-card admin-form admin-panel" onSubmit={submit}>
          <h2>Thông tin phim</h2>
          <input
            name="movieId"
            value={movieDraft.id}
            disabled
            title="ID phim được tạo tự động bởi hệ thống"
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          />
          <input
            name="movieTitle"
            autoComplete="off"
            placeholder="Tên phim"
            value={movieDraft.title}
            onChange={(e) => setMovieDraft((p) => ({ ...p, title: e.target.value }))}
          />
          <input
            name="movieGenre"
            autoComplete="off"
            placeholder="Thể loại"
            value={movieDraft.genre}
            onChange={(e) => setMovieDraft((p) => ({ ...p, genre: e.target.value }))}
          />
          <input
            name="movieDurationMin"
            type="number"
            min={1}
            autoComplete="off"
            placeholder="Thời lượng (phút)"
            value={movieDraft.durationMin}
            onChange={(e) => setMovieDraft((p) => ({ ...p, durationMin: e.target.value }))}
          />
          <input
            name="movieLanguage"
            autoComplete="off"
            placeholder="Ngôn ngữ"
            value={movieDraft.language}
            onChange={(e) => setMovieDraft((p) => ({ ...p, language: e.target.value }))}
          />
          <select
            name="movieAgeRating"
            value={movieDraft.ageRating}
            onChange={(e) => setMovieDraft((p) => ({ ...p, ageRating: e.target.value }))}
            title="Giới hạn độ tuổi"
          >
            <option value="K">K</option>
            <option value="T13">T13</option>
            <option value="T16">T16</option>
            <option value="T18">T18</option>
          </select>
          <input
            name="movieDescription"
            autoComplete="off"
            placeholder="Mô tả ngắn (description)"
            value={movieDraft.description}
            onChange={(e) => setMovieDraft((p) => ({ ...p, description: e.target.value }))}
          />
          <textarea
            name="movieSynopsis"
            autoComplete="off"
            placeholder="Giới thiệu / Synopsis"
            value={movieDraft.synopsis}
            onChange={(e) => setMovieDraft((p) => ({ ...p, synopsis: e.target.value }))}
            rows={6}
          />
          <input
            name="movieLanguage"
            autoComplete="off"
            placeholder="Ngôn ngữ"
            value={movieDraft.language}
            onChange={(e) => setMovieDraft((p) => ({ ...p, language: e.target.value }))}
          />
          <input
            name="moviePremiereDate"
            type="date"
            placeholder="Ngày khởi chiếu"
            value={movieDraft.premiereDate}
            onChange={(e) => setMovieDraft((p) => ({ ...p, premiereDate: e.target.value }))}
          />
          <input
            name="movieDirector"
            autoComplete="off"
            placeholder="Đạo diễn"
            value={movieDraft.director}
            onChange={(e) => setMovieDraft((p) => ({ ...p, director: e.target.value }))}
          />
          <input
            name="movieCast"
            autoComplete="off"
            placeholder="Diễn viên"
            value={movieDraft.cast}
            onChange={(e) => setMovieDraft((p) => ({ ...p, cast: e.target.value }))}
          />
          <input
            name="movieTrailerYoutubeId"
            autoComplete="off"
            placeholder="Trailer Youtube ID"
            value={movieDraft.trailerYoutubeId}
            onChange={(e) => setMovieDraft((p) => ({ ...p, trailerYoutubeId: e.target.value }))}
          />

          <h2>Hình ảnh</h2>
          <input
            placeholder="Poster URL (hoặc upload)"
            value={movieDraft.posterUrl}
            onChange={(e) => setMovieDraft((p) => ({ ...p, posterUrl: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              try {
                const dataUrl = await readFileAsDataURL(f);
                if (dataUrl) setMovieDraft((p) => ({ ...p, posterUrl: dataUrl }));
              } catch {
                setError("Upload poster thất bại.");
              }
            }}
          />
          <input
            placeholder="Backdrop URL (hoặc upload)"
            value={movieDraft.backdropUrl}
            onChange={(e) => setMovieDraft((p) => ({ ...p, backdropUrl: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              try {
                const dataUrl = await readFileAsDataURL(f);
                if (dataUrl) setMovieDraft((p) => ({ ...p, backdropUrl: dataUrl }));
              } catch {
                setError("Upload backdrop thất bại.");
              }
            }}
          />

          <button type="submit" disabled={!canSubmit}>
            {isEdit ? "Cập nhật phim" : "Tạo phim"}
          </button>
        </form>

        <div className="item-card admin-panel">
          <h2>Preview giống users</h2>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "start" }}>
            <div style={{ position: "relative", width: 120, aspectRatio: "2 / 3", borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              {movieDraft.posterUrl ? (
                <img src={movieDraft.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div className="section-muted" style={{ padding: 10 }}>Chưa có poster</div>
              )}
              <span className="movie-card-beta__badge-age">{movieDraft.ageRating || "T13"}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: "2px 0 6px" }}>{movieDraft.title || "Tên phim"}</h3>
              <div className="section-muted" style={{ margin: 0, display: "grid", gap: 4 }}>
                <p style={{ margin: 0 }}>
                  <strong>Thể loại: </strong>{movieDraft.genre || "—"}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Thời lượng: </strong>{movieDraft.durationMin ? `${Number(movieDraft.durationMin)} phút` : "—"}
                </p>
              </div>
              <div style={{ height: 10 }} />
              <dl className="movie-detail-meta-list">
                <dt>Đạo diễn</dt>
                <dd>{movieDraft.director || "—"}</dd>
                <dt>Diễn viên</dt>
                <dd>{movieDraft.cast || "—"}</dd>
                <dt>Ngôn ngữ</dt>
                <dd>{movieDraft.language || "—"}</dd>
                <dt>Ngày khởi chiếu</dt>
                <dd>{formatDateVN(movieDraft.premiereDate)}</dd>
              </dl>
            </div>
          </div>
          <div style={{ height: 14 }} />
          <h2>Mô tả / giới thiệu</h2>
          <p className="movie-detail-synopsis">
            {movieDraft.synopsis || movieDraft.description || "Chưa có nội dung."}
          </p>
        </div>
      </div>
    </section>
  );
}

