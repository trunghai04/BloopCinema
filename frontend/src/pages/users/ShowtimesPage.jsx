import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMovies,
  getReservationShowtimeSeats,
  getShowtimes,
} from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { normalizeAgeRating, ratingForMovie } from "../../utils/movieRating";

const SEAT_CAPACITY = 180;
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function localDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateTabParts(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { dd, mm, weekday: WEEKDAY_SHORT[d.getDay()] };
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function ShowtimesPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [dateKey, setDateKey] = useState("");
  const [seatsFree, setSeatsFree] = useState({});
  const [loadError, setLoadError] = useState("");
  const [confirmShowtime, setConfirmShowtime] = useState(null);
  const [trailerMovie, setTrailerMovie] = useState(null);

  useEffect(() => {
    setLoadError("");
    Promise.all([getMovies(), getShowtimes()])
      .then(([movieList, showtimeList]) => {
        setMovies(movieList || []);
        setShowtimes(showtimeList || []);
      })
      .catch((e) =>
        setLoadError(
          e?.message ||
            "Không tải được lịch chiếu. Kiểm tra api-gateway và kết nối mạng.",
        ),
      );
  }, []);

  const sortedShowtimes = useMemo(
    () =>
      [...showtimes].sort((a, b) =>
        String(a.startAt).localeCompare(String(b.startAt)),
      ),
    [showtimes],
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
      .map(([key, sampleIso]) => ({ key, ...dateTabParts(sampleIso) }));
  }, [sortedShowtimes]);

  useEffect(() => {
    if (!dateTabs.length) return;
    setDateKey((prev) => (prev ? prev : dateTabs[0].key));
  }, [dateTabs]);

  const showtimesForDay = useMemo(
    () =>
      dateKey
        ? sortedShowtimes.filter((st) => localDateKey(st.startAt) === dateKey)
        : [],
    [sortedShowtimes, dateKey],
  );

  const moviesById = useMemo(() => {
    const map = new Map();
    movies.forEach((movie) => map.set(movie.id, movie));
    return map;
  }, [movies]);

  const groupedByMovie = useMemo(() => {
    const groups = new Map();
    showtimesForDay.forEach((st) => {
      if (!groups.has(st.movieId)) groups.set(st.movieId, []);
      groups.get(st.movieId).push(st);
    });
    return [...groups.entries()].map(([movieId, sts]) => ({
      movie: moviesById.get(movieId),
      showtimes: sts.sort((a, b) =>
        String(a.startAt).localeCompare(String(b.startAt)),
      ),
    }));
  }, [showtimesForDay, moviesById]);

  useEffect(() => {
    let cancelled = false;
    setSeatsFree({});
    if (!showtimesForDay.length) return undefined;
    Promise.all(
      showtimesForDay.map((st) =>
        getReservationShowtimeSeats(st.id)
          .then((d) => ({
            id: st.id,
            n: Math.max(0, SEAT_CAPACITY - (d.occupied?.length || 0)),
          }))
          .catch(() => ({ id: st.id, n: null })),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach(({ id, n }) => {
        next[id] = n;
      });
      setSeatsFree(next);
    });
    return () => {
      cancelled = true;
    };
  }, [showtimesForDay]);

  function proceedToSeatSelect(movieId, showtimeId, hall) {
    if (!movieId || !showtimeId) return;
    const dest = `/book/seats?movieId=${encodeURIComponent(movieId)}&showtimeId=${encodeURIComponent(showtimeId)}&hall=${encodeURIComponent(String(hall || ""))}`;
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(dest)}`);
      return;
    }
    navigate(dest);
  }

  return (
    <section className="showtimes-by-cinema">
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <h2 className="showtimes-by-cinema__title">Lịch chiếu theo rạp</h2>

      <div className="showtimes-by-cinema__tabs" role="tablist">
        {dateTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              dateKey === tab.key
                ? "showtimes-by-cinema__tab showtimes-by-cinema__tab--active"
                : "showtimes-by-cinema__tab"
            }
            onClick={() => setDateKey(tab.key)}
          >
            <span className="showtimes-by-cinema__tab-day">{tab.dd}</span>
            <span className="showtimes-by-cinema__tab-sub">
              <span className="showtimes-by-cinema__tab-sep">/</span>
              <span className="showtimes-by-cinema__tab-month">{tab.mm}</span>
              <span className="showtimes-by-cinema__tab-sep"> - </span>
              <span className="showtimes-by-cinema__tab-weekday">
                {tab.weekday}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="showtimes-by-cinema__note">Suất chiếu muộn từ 22h00</p>

      <div className="showtimes-by-cinema__movies-grid">
        {groupedByMovie.map(({ movie, showtimes: sts }) => (
          <article
            key={movie?.id || sts[0]?.movieId}
            className="showtimes-by-cinema__movie"
          >
            <div className="showtimes-by-cinema__poster-wrap">
              {movie?.posterUrl ? (
                <img
                  className="showtimes-by-cinema__poster"
                  src={movie.posterUrl}
                  alt=""
                />
              ) : null}
              <span className="showtimes-by-cinema__rating">
                {movie?.id
                  ? normalizeAgeRating(movie?.ageRating) ||
                    ratingForMovie(movie.id)
                  : "T13"}
              </span>
              {movie?.trailerYoutubeId ? (
                <button
                  type="button"
                  className="movie-card-beta__trailer-play"
                  aria-label={`Xem trailer ${movie.title}`}
                  onClick={() => setTrailerMovie(movie)}
                >
                  ▶
                </button>
              ) : null}
            </div>
            <div className="showtimes-by-cinema__body">
              <h3 className="showtimes-by-cinema__movie-title">
                {movie?.title || sts[0]?.movieId}
              </h3>
              <p className="showtimes-by-cinema__meta">
                {movie?.genre || "Đang cập nhật"} · {movie?.durationMin || "--"}{" "}
                phút
              </p>
              <p className="showtimes-by-cinema__format">2D PHỤ ĐỀ</p>
              <div className="showtimes-by-cinema__slots">
                {sts.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className="showtimes-by-cinema__slot"
                    disabled={isPastShowtime(st)}
                    onClick={() => setConfirmShowtime({ showtime: st, movie })}
                  >
                    <span className="showtimes-by-cinema__slot-time">
                      {timeLabel(st.startAt)}
                    </span>
                    <span className="showtimes-by-cinema__slot-seat">
                      {seatsFree[st.id] == null
                        ? "..."
                        : `${seatsFree[st.id]} ghế trống`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

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
            <p className="movie-detail-confirm-modal__kicker">
              BẠN ĐANG ĐẶT VÉ XEM PHIM
            </p>
            <h3 className="movie-detail-confirm-modal__title">
              {confirmShowtime.movie?.title ||
                confirmShowtime.showtime?.movieId}
            </h3>
            <div className="movie-detail-confirm-modal__table">
              <div className="movie-detail-confirm-modal__head">Rạp chiếu</div>
              <div className="movie-detail-confirm-modal__head">Ngày chiếu</div>
              <div className="movie-detail-confirm-modal__head">Giờ chiếu</div>
              <div>{confirmShowtime.showtime?.hall || "Rạp trung tâm"}</div>
              <div>{dateLabel(confirmShowtime.showtime?.startAt)}</div>
              <div>{timeLabel(confirmShowtime.showtime?.startAt)}</div>
            </div>
            <button
              type="button"
              className="movie-detail-confirm-modal__agree"
              onClick={() =>
                proceedToSeatSelect(
                  confirmShowtime.showtime?.movieId,
                  confirmShowtime.showtime?.id,
                  confirmShowtime.showtime?.hall,
                )
              }
            >
              ĐỒNG Ý
            </button>
          </section>
        </div>
      ) : null}

      {trailerMovie?.trailerYoutubeId ? (
        <div
          className="movie-card-beta__trailer-overlay"
          role="presentation"
          onClick={() => setTrailerMovie(null)}
        >
          <section
            className="movie-card-beta__trailer-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Trailer ${trailerMovie.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="movie-card-beta__trailer-close"
              aria-label="Đóng"
              onClick={() => setTrailerMovie(null)}
            >
              ×
            </button>
            <h3 className="movie-card-beta__trailer-title">
              TRAILER - {trailerMovie.title}
            </h3>
            <div className="trailer-embed">
              <iframe
                title={`Trailer ${trailerMovie.title}`}
                src={`https://www.youtube.com/embed/${trailerMovie.trailerYoutubeId}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
