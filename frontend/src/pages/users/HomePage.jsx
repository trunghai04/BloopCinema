import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, getMovies, getShowtimes, getAdminBanners } from "../../api/client";
import MovieCardBeta from "../../components/MovieCardBeta";
import MovieTabs from "../../components/MovieTabs";

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

const DEFAULT_HERO_BANNERS = [
  {
    id: "hb1",
    image: "/news-carousel-1.jpg",
    active: true
  }
];

const HERO_STORAGE_KEY = "bloop_homepage_banners";

function loadStoredBanners() {
  if (typeof window === "undefined") return DEFAULT_HERO_BANNERS;
  try {
    const raw = window.localStorage.getItem(HERO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_HERO_BANNERS;
}

const BANNER_ASSET_BASE = API_BASE;

function normalizeBanner(item) {
  const image = item?.imageUrl || item?.image || "/news-carousel-1.jpg";
  const resolvedImage = image.startsWith("/") ? `${BANNER_ASSET_BASE}${image}` : image;
  return {
    id: item?.id || String(Date.now()),
    image: resolvedImage,
    active: item?.active !== false
  };
}

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("now");
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroBanners, setHeroBanners] = useState(() => loadStoredBanners());

  useEffect(() => {
    let alive = true;
    setLoadError("");
    Promise.allSettled([getMovies(), getShowtimes()]).then(([moviesRes, showtimesRes]) => {
      if (!alive) return;
      if (moviesRes.status === "fulfilled") {
        setMovies(moviesRes.value || []);
      }
      if (showtimesRes.status === "fulfilled") {
        setShowtimes(showtimesRes.value || []);
      }
      if (moviesRes.status === "rejected" || showtimesRes.status === "rejected") {
        setLoadError(
          moviesRes.reason?.message ||
            showtimesRes.reason?.message ||
            "Không tải được danh sách phim. Kiểm tra API hoặc mạng."
        );
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const showtimesByMovieId = useMemo(() => {
    const map = new Map();
    showtimes.forEach((st) => {
      if (!map.has(st.movieId)) map.set(st.movieId, []);
      map.get(st.movieId).push(st);
    });
    return map;
  }, [showtimes]);

  const nowMovies = useMemo(() => movies.filter((movie) => !isFuturePremiere(movie)), [movies]);
  const upcomingMovies = useMemo(() => movies.filter((movie) => isFuturePremiere(movie)), [movies]);
  const specialMovies = useMemo(() => {
    return movies.filter((movie) => {
      const isUpcoming = isFuturePremiere(movie);
      const hasShowtimes = (showtimesByMovieId.get(movie.id) || []).length > 0;
      return isUpcoming && hasShowtimes;
    });
  }, [movies, showtimesByMovieId]);
  const featured = nowMovies.slice(0, 4);
  const heroMovies = nowMovies.length ? nowMovies.slice(0, 6) : movies.slice(0, 6);

  useEffect(() => {
    const count = heroBanners.length || 1;
    if (count <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % count);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  useEffect(() => {
    let mounted = true;
    getAdminBanners()
      .then((remote) => {
        if (!mounted) return;
        const banners = (Array.isArray(remote) ? remote : []).map(normalizeBanner).filter((b) => b.active);
        setHeroBanners(banners.length ? banners : DEFAULT_HERO_BANNERS);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(banners.length ? banners : DEFAULT_HERO_BANNERS));
        }
      })
      .catch(() => {
        if (!mounted) return;
        const banners = loadStoredBanners().map(normalizeBanner).filter((b) => b.active);
        setHeroBanners(banners.length ? banners : DEFAULT_HERO_BANNERS);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedHeroBanners = heroBanners.length ? heroBanners : DEFAULT_HERO_BANNERS;
  const activeHero = normalizedHeroBanners[heroIndex % normalizedHeroBanners.length];

  return (
    <section>
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="home-beta-lead">
        <div className="home-hero-banner home-hero-banner--cinema">
          <img
            className="home-hero-banner__image"
            src={activeHero.image}
            alt="banner"
          />
          <div className="home-hero-banner__overlay" />
          <div className="home-hero-banner__dots">
            {normalizedHeroBanners.map((banner, idx) => (
              <button
                key={banner.id}
                type="button"
                className={
                  idx === heroIndex % normalizedHeroBanners.length
                    ? "home-hero-banner__dot home-hero-banner__dot--active"
                    : "home-hero-banner__dot"
                }
                onClick={() => setHeroIndex(idx)}
                aria-label={`Xem banner ${banner.id}`}
              />
            ))}
          </div>
        </div>
      </div>

      <MovieTabs active={tab} onChange={setTab} />

      {tab === "now" ? (
        <>
          <div className="movie-grid-beta">
            {featured.map((movie, idx) => (
              <MovieCardBeta
                key={movie.id}
                movie={movie}
                showHot={idx === 0}
                showBuyButton={(showtimesByMovieId.get(movie.id) || []).length > 0}
                statusLabel={isFuturePremiere(movie) ? "Phim sắp chiếu" : ""}
              />
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <Link to="/movies" className="cta-link">
              Xem tất cả phim đang chiếu →
            </Link>
          </p>
        </>
      ) : tab === "upcoming" ? (
        <>
          <div className="movie-grid-beta">
            {upcomingMovies.slice(0, 4).map((movie, idx) => (
              <MovieCardBeta
                key={movie.id}
                movie={movie}
                showHot={idx === 0}
                showBuyButton={false}
                statusLabel="Phim sắp chiếu"
              />
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <Link to="/movies" className="cta-link">
              Xem tất cả phim sắp chiếu →
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="movie-grid-beta">
            {specialMovies.slice(0, 4).map((movie, idx) => (
              <MovieCardBeta
                key={movie.id}
                movie={movie}
                showHot={idx === 0}
                showBuyButton={(showtimesByMovieId.get(movie.id) || []).length > 0}
                statusLabel="Suất chiếu sớm"
              />
            ))}
          </div>
          {specialMovies.length > 0 ? (
            <p style={{ textAlign: "center", marginTop: 24 }}>
              <Link to="/movies?tab=special" className="cta-link">
                Xem tất cả suất chiếu đặc biệt →
              </Link>
            </p>
          ) : (
            <p className="section-muted" style={{ textAlign: "center", padding: "32px 0" }}>
              Hiện chưa có suất chiếu đặc biệt nào.
            </p>
          )}
        </>
      )}
    </section>
  );
}

