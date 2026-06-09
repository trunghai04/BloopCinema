import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMovies, getReservationShowtimeSeats, getShowtimes } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTheater } from "../../context/TheaterContext";
import { setDocumentTitle } from "../../utils/documentTitle";
import { normalizeAgeRating, ratingForMovie } from "../../utils/movieRating";


const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function localDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateTabLabel(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} - ${WEEKDAY_SHORT[d.getDay()]}`;
}

function formatTimeHM(iso) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatDateDMY(iso) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

function getSeatCapacity(layout) {
  const capacity = Number(layout?.capacity);
  if (Number.isFinite(capacity) && capacity > 0) return capacity;

  const seats = Array.isArray(layout?.seats) ? layout.seats : [];
  const enabledSeats = seats.filter((seat) => seat?.enabled !== false);
  if (enabledSeats.length > 0) return enabledSeats.length;

  const rows = Array.isArray(layout?.rows) ? layout.rows.length : 0;
  const cols = Array.isArray(layout?.cols) ? Number(layout.cols) : 0;
  if (rows > 0 && cols > 0) return rows * cols;

  return 0;
}

function parsePremiereDate(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const alt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(alt.getTime())) return alt;
  }
  return null;
}

export default function MovieDetailPage() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { selectedTheaterId, selectedTheater } = useTheater();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [showtimeId, setShowtimeId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateKey, setDateKey] = useState("");
  const [seatsFree, setSeatsFree] = useState({});
  const [confirmShowtime, setConfirmShowtime] = useState(null);

  useEffect(() => {
    setLoadError("");
    setLoading(true);
    setMovie(null);
    setDateKey("");
    Promise.all([getMovies(), getShowtimes()])
      .then(([movies, sts]) => {
        setMovie(movies.find((item) => item.id === movieId) || null);
        setShowtimes(
          sts.filter((s) => {
            if (String(s.movieId) !== String(movieId)) return false;
            const theaterId = String(s.theaterId || s.theater || s.cinema || "").toLowerCase();
            return !selectedTheaterId || theaterId === String(selectedTheaterId).toLowerCase() || !theaterId;
          })
        );
      })
      .catch((e) =>
        setLoadError(
          e?.message ||
            "Không tải được dữ liệu phim."
        )
      )
      .finally(() => setLoading(false));
  }, [movieId]);

  useEffect(() => {
    if (loading) return;
    if (loadError) {
      setDocumentTitle("Lỗi tải phim");
      return;
    }
    if (!movie) {
      setDocumentTitle("Không tìm thấy phim");
      return;
    }
    if (movie.id === movieId && movie.title) {
      setDocumentTitle(movie.title);
    }
  }, [loading, loadError, movie, movieId]);

  const synopsis = movie?.synopsis || movie?.description || "";
  const trailerId = movie?.trailerYoutubeId;
  const rating = movie
    ? normalizeAgeRating(movie.ageRating) || ratingForMovie(movie.id)
    : "T13";
  const premiereDate = parsePremiereDate(movie?.premiereDate);
  const isUpcomingMovie = Boolean(premiereDate && premiereDate.getTime() > Date.now());
  const hasShowtimes = showtimes.length > 0;

  const sortedShowtimes = useMemo(
    () =>
      [...showtimes].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))),
    [showtimes]
  );

  const isPastShowtime = (st) => {
    const t = new Date(st?.startAt || "").getTime();
    if (!Number.isFinite(t)) return false;
    return t <= Date.now();
  };

  const dateTabs = useMemo(() => {
    const m = new Map();
    sortedShowtimes.forEach((st) => {
      const k = localDateKey(st.startAt);
      if (!m.has(k)) m.set(k, st.startAt);
    });
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, sampleIso]) => ({ key, label: dateTabLabel(sampleIso) }));
  }, [sortedShowtimes]);

  useEffect(() => {
    if (dateTabs.length && !dateKey) setDateKey(dateTabs[0].key);
  }, [dateTabs, dateKey]);

  const showtimesForDay = useMemo(
    () =>
      dateKey
        ? sortedShowtimes.filter((st) => localDateKey(st.startAt) === dateKey)
        : [],
    [sortedShowtimes, dateKey]
  );

  useEffect(() => {
    if (!showtimesForDay.length) {
      setShowtimeId("");
      return;
    }
    setShowtimeId((prev) =>
      showtimesForDay.some((st) => st.id === prev)
        ? prev
        : showtimesForDay[0].id
    );
  }, [showtimesForDay]);

  useEffect(() => {
    let cancelled = false;
    setSeatsFree({});
    if (!showtimesForDay.length) return undefined;
    Promise.all(
      showtimesForDay.map((st) =>
        getReservationShowtimeSeats(st.id)
          .then((d) => ({
            id: st.id,
            occupied: d.occupied || [],
            layout: d,
          }))
          .catch(() => ({ id: st.id, occupied: null, layout: null }))
      )
    ).then((rows) => {
      if (cancelled) return;
      const o = {};
      rows.forEach(({ id, occupied, layout }) => {
        if (!layout || occupied == null) {
          o[id] = null;
          return;
        }
        const capacity = getSeatCapacity(layout);
        o[id] = Math.max(0, capacity - occupied.length);
      });
      setSeatsFree(o);
    });
    return () => {
      cancelled = true;
    };
  }, [showtimesForDay]);

  function proceedToSeatSelect(targetShowtimeId) {
    if (!movieId || !targetShowtimeId) return;
    const selectedShowtime = showtimes.find((s) => s.id === targetShowtimeId);
    const hall = String(selectedShowtime?.hall || "");
    const dest = `/book/seats?movieId=${encodeURIComponent(movieId)}&showtimeId=${encodeURIComponent(targetShowtimeId)}&hall=${encodeURIComponent(hall)}`;
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(dest)}`);
      return;
    }
    navigate(dest);
  }

  if (loading) {
    return <p className="section-muted">Đang tải thông tin phim...</p>;
  }

  if (loadError) {
    return (
      <section>
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  if (!movie) {
    return <p className="section-muted">Không tìm thấy phim.</p>;
  }

  return (
    <div className="movie-detail-layout">
      <nav className="movie-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="movie-detail-breadcrumb__sep">&gt;</span>
        <span>{movie.title}</span>
      </nav>

      <div className="movie-detail-title-block">
        <h1 className="movie-detail-title-block__h">{movie.title}</h1>
      </div>

      <div className="movie-detail-main">
        <div className="movie-detail-poster-wrap">
          <img
            className="movie-detail-poster-wrap__img"
            src={movie.posterUrl}
            alt=""
          />
          <span className="movie-detail-poster-wrap__badge">{rating}</span>
        </div>
        <div className="movie-detail-info">
          <section className="movie-detail-info-block" aria-label="Mô tả">
            <h2 className="movie-detail-info-block__title">Mô tả</h2>
            <p className="movie-detail-synopsis">
              {synopsis || "Thông tin mô tả đang được cập nhật."}
            </p>
          </section>

          <section className="movie-detail-info-block" aria-label="Giới thiệu">
            <h2 className="movie-detail-info-block__title">Giới thiệu</h2>
            <dl className="movie-detail-meta-list">
              <dt>Đạo diễn</dt>
              <dd>{movie.director || "Đang cập nhật"}</dd>
              <dt>Diễn viên</dt>
              <dd>{movie.cast || "Đang cập nhật"}</dd>
              <dt>Thể loại</dt>
              <dd>{movie.genre || "Đang cập nhật"}</dd>
              <dt>Thời lượng</dt>
              <dd>{movie.durationMin ? `${movie.durationMin} phút` : "Đang cập nhật"}</dd>
              <dt>Ngôn ngữ</dt>
              <dd>{movie.language || "Đang cập nhật"}</dd>
              <dt>Ngày khởi chiếu</dt>
              <dd>{movie.premiereDate || "Đang cập nhật"}</dd>
            </dl>
          </section>
        </div>
      </div>

      {hasShowtimes ? (
        <section className="movie-detail-showtimes" aria-label="Suất chiếu">
          <h2 className="movie-detail-showtimes__heading">Chọn suất</h2>
          {dateTabs.length ? (
            <div className="movie-detail-date-tabs" role="tablist">
              {dateTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={dateKey === tab.key}
                  className={
                    dateKey === tab.key
                      ? "movie-detail-date-tab movie-detail-date-tab--active"
                      : "movie-detail-date-tab"
                  }
                  onClick={() => setDateKey(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {showtimesForDay.length ? (
            <>
              <h3 className="movie-detail-format-label">2D PHỤ ĐỀ</h3>
              <div className="movie-detail-slot-grid">
                {showtimesForDay.map((st) => {
                  const past = isPastShowtime(st);
                  return (
                  <button
                    key={st.id}
                    type="button"
                    className={
                      showtimeId === st.id
                        ? "movie-detail-slot movie-detail-slot--active"
                        : "movie-detail-slot"
                    }
                    disabled={past}
                    onClick={() => {
                      setShowtimeId(st.id);
                      setConfirmShowtime(st);
                    }}
                  >
                    <span className="movie-detail-slot__time">
                      {formatTimeHM(st.startAt)}
                    </span>
                    <span className="movie-detail-slot__seat">
                      {seatsFree[st.id] == null
                        ? "Đang tính..."
                        : `${seatsFree[st.id]} ghế trống`}
                    </span>
                    {past ? <span className="section-muted">Đã chiếu</span> : null}
                  </button>
                )})}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {trailerId ? (
        <section className="movie-detail-trailer-band" aria-label="Trailer">
          <div className="movie-detail-trailer-band__title-wrap">
            <h2 className="movie-detail-trailer-band__title">TRAILER</h2>
          </div>
          <div className="movie-detail-trailer-band__video">
            <div className="trailer-embed trailer-embed--on-dark">
              <iframe
                title={`Trailer ${movie.title}`}
                src={`https://www.youtube.com/embed/${trailerId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      ) : null}

      {confirmShowtime ? (
        <div
          className="movie-detail-confirm-overlay"
          role="presentation"
          onClick={() => setConfirmShowtime(null)}
        >
          <section
            className="movie-detail-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận suất chiếu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="movie-detail-confirm-modal__close"
              aria-label="Đóng"
              onClick={() => setConfirmShowtime(null)}
            >
              ×
            </button>
            <p className="movie-detail-confirm-modal__kicker">BẠN ĐANG ĐẶT VÉ XEM PHIM</p>
            <h3 className="movie-detail-confirm-modal__title">{movie.title}</h3>
            <div className="movie-detail-confirm-modal__table">
              <div className="movie-detail-confirm-modal__head">Rạp chiếu</div>
              <div className="movie-detail-confirm-modal__head">Ngày chiếu</div>
              <div className="movie-detail-confirm-modal__head">Giờ chiếu</div>
              <div>{selectedTheater?.name || "Rạp trung tâm"}</div>
              <div>{formatDateDMY(confirmShowtime.startAt)}</div>
              <div>{formatTimeHM(confirmShowtime.startAt)}</div>
            </div>
            <button
              type="button"
              className="movie-detail-confirm-modal__agree"
              onClick={() => proceedToSeatSelect(confirmShowtime.id)}
            >
              ĐỒNG Ý
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

