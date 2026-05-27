import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMovies,
  getReservationShowtimeSeats,
  getShowtimes,
} from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTheater } from "../../context/TheaterContext";
import { normalizeAgeRating, ratingForMovie } from "../../utils/movieRating";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const SAMPLE_SHOWTIMES = [
  { id: "demo-hn-1", movieId: "movie-1", hall: "Bloop Cinema Hà Nội - IMAX 1", startAt: "2026-05-16T09:30:00+07:00", theaterId: "hanoi" },
  { id: "demo-hn-2", movieId: "movie-2", hall: "Bloop Cinema Hà Nội - Room 3", startAt: "2026-05-16T13:15:00+07:00", theaterId: "hanoi" },
  { id: "demo-hn-3", movieId: "movie-3", hall: "Bloop Cinema Hà Nội - VIP 2", startAt: "2026-05-16T19:45:00+07:00", theaterId: "hanoi" },
  { id: "demo-dn-1", movieId: "movie-1", hall: "Bloop Cinema Đà Nẵng - Room 1", startAt: "2026-05-16T10:00:00+07:00", theaterId: "danang" },
  { id: "demo-dn-2", movieId: "movie-4", hall: "Bloop Cinema Đà Nẵng - Room 2", startAt: "2026-05-16T16:20:00+07:00", theaterId: "danang" },
  { id: "demo-dn-3", movieId: "movie-2", hall: "Bloop Cinema Đà Nẵng - VIP", startAt: "2026-05-16T21:10:00+07:00", theaterId: "danang" },
  { id: "demo-hcm-1", movieId: "movie-3", hall: "Bloop Cinema TP HCM - IMAX", startAt: "2026-05-16T11:00:00+07:00", theaterId: "hcm" },
  { id: "demo-hcm-2", movieId: "movie-4", hall: "Bloop Cinema TP HCM - Room 5", startAt: "2026-05-16T15:40:00+07:00", theaterId: "hcm" },
  { id: "demo-hcm-3", movieId: "movie-1", hall: "Bloop Cinema TP HCM - Premiere", startAt: "2026-05-16T20:30:00+07:00", theaterId: "hcm" },
];

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

function isLateNightShowtime(iso) {
  const d = new Date(iso);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= 22 * 60 || minutes < 3 * 60;
}

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function ShowtimesPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { selectedTheaterId } = useTheater();
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
        setShowtimes((showtimeList || []).length ? showtimeList || [] : SAMPLE_SHOWTIMES);
      })
      .catch((e) =>
        setLoadError(
          e?.message ||
            "Không tải được lịch chiếu. Kiểm tra api-gateway và kết nối mạng.",
        ),
      );
  }, []);


  const filteredShowtimes = useMemo(() => {
    if (!selectedTheaterId) return showtimes;
    const theaterIdLower = String(selectedTheaterId).toLowerCase();
    return showtimes.filter((st) => {
      const theaterId = String(st.theaterId || st.theater || st.cinema || "").toLowerCase();
      return theaterId && theaterId === theaterIdLower;
    });
  }, [showtimes, selectedTheaterId]);

  const sortedShowtimes = useMemo(
    () =>
      [...filteredShowtimes].sort((a, b) =>
        String(a.startAt).localeCompare(String(b.startAt)),
      ),
    [filteredShowtimes],
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
            occupied: d.occupied || [],
            layout: d,
          }))
          .catch(() => ({ id: st.id, occupied: null, layout: null })),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const nextFree = {};
      rows.forEach(({ id, occupied, layout }) => {
        if (!layout || occupied == null) {
          nextFree[id] = null;
          return;
        }
        const capacity = getSeatCapacity(layout);
        nextFree[id] = Math.max(0, capacity - occupied.length);
      });
      setSeatsFree(nextFree);
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

  const selectedTheaterShowtimes = sortedShowtimes;

  return (
    <section className="showtimes-by-cinema">
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <h2 className="showtimes-by-cinema__title">Lịch chiếu theo rạp</h2>
      

      

      <div className="showtimes-by-cinema__tabs" role="tablist">
        {dateTabs.length ? (
          dateTabs.map((tab) => (
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
          ))
        ) : (
          <p className="section-muted" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            Chưa có suất chiếu cho rạp này.
          </p>
        )}
      </div>

      <p className="showtimes-by-cinema__note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="showtimes-by-cinema__legend-box" aria-hidden="true" />
        Suất chiếu muộn từ 22h00
      </p>

      <div className="showtimes-by-cinema__movies-grid">
        {selectedTheaterShowtimes.length ? (
          groupedByMovie.map(({ movie, showtimes: sts }) => (
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
              <div className="showtimes-by-cinema__slots">
                {sts.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={isLateNightShowtime(st.startAt) ? "showtimes-by-cinema__slot showtimes-by-cinema__slot--late" : "showtimes-by-cinema__slot"}
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
          ))
        ) : (
          <p className="section-muted" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            Chưa có suất chiếu cho rạp này.
          </p>
        )}
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
