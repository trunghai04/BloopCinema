import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMovies, getShowtimes } from "../../api/client";
import MovieCardBeta from "../../components/MovieCardBeta";
import MovieTabs from "../../components/MovieTabs";
import { useTheater } from "../../context/TheaterContext";

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

function isFuturePremiere(movie) {
  const premiere = parsePremiereDate(movie?.premiereDate);
  return Boolean(premiere && premiere.getTime() > Date.now());
}

export default function MoviesPage() {
  const { selectedTheater } = useTheater();
  const [params, setParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [loadError, setLoadError] = useState("");

  const tab = params.get("tab") || "now";
  const setTab = (newTab) => {
    setParams({ tab: newTab });
  };

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
            "Không tải được phim. Trên điện thoại mở đúng địa chỉ máy chủ (cùng Wi‑Fi)."
        )
      );
  }, []);

  const showtimesByMovieId = useMemo(() => {
    const map = new Map();
    const theaterId = String(selectedTheater?.id || "").toLowerCase();
    showtimes.forEach((st) => {
      const stTheaterId = String(st.theaterId || st.theater || st.cinema || "").toLowerCase();
      if (theaterId && stTheaterId && stTheaterId !== theaterId) return;
      if (!map.has(st.movieId)) map.set(st.movieId, []);
      map.get(st.movieId).push(st);
    });
    return map;
  }, [showtimes, selectedTheater?.id]);

  const upcomingMovies = useMemo(
    () => movies.filter((movie) => isFuturePremiere(movie)),
    [movies]
  );

  const nowMovies = useMemo(() => {
    return movies.filter((movie) => !isFuturePremiere(movie));
  }, [movies]);

  const specialMovies = useMemo(() => {
    return movies.filter((movie) => {
      const isUpcoming = isFuturePremiere(movie);
      const hasShowtimes = (showtimesByMovieId.get(movie.id) || []).length > 0;
      return isUpcoming && hasShowtimes;
    });
  }, [movies, showtimesByMovieId]);

  return (
    <section>
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <MovieTabs active={tab} onChange={setTab} />

      {tab === "now" ? (
        <div className="movie-grid-beta">
          {nowMovies.map((movie, idx) => (
            <MovieCardBeta
              key={movie.id}
              movie={movie}
              showHot={idx < 2}
              showBuyButton={(showtimesByMovieId.get(movie.id) || []).length > 0}
            />
          ))}
        </div>
      ) : tab === "upcoming" ? (
        <div className="movie-grid-beta">
          {upcomingMovies.map((movie, idx) => (
            <MovieCardBeta
              key={movie.id}
              movie={movie}
              showHot={idx < 2}
              showBuyButton={false}
            />
          ))}
        </div>
      ) : (
        <div className="movie-grid-beta">
          {specialMovies.map((movie, idx) => (
            <MovieCardBeta
              key={movie.id}
              movie={movie}
              showHot={idx < 2}
              showBuyButton={(showtimesByMovieId.get(movie.id) || []).length > 0}
            />
          ))}
          {!specialMovies.length && (
            <p className="section-muted" style={{ textAlign: "center", padding: "32px 0", gridColumn: "1/-1" }}>
              Hiện chưa có suất chiếu đặc biệt nào.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

