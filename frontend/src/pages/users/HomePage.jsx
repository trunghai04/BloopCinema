import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMovies } from "../../api/client";
import MovieCardBeta from "../../components/MovieCardBeta";
import MovieTabs from "../../components/MovieTabs";

const TOP_MARQUEE_ITEMS = [
  "Khuyến mãi vé đôi mỗi Thứ 4",
  "Combo bắp nước giảm 25%",
  "Đặt vé online nhận điểm thành viên",
  "Suất chiếu đêm cập nhật liên tục"
];

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("now");
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setLoadError("");
    getMovies()
      .then(setMovies)
      .catch((e) =>
        setLoadError(
          e?.message ||
            "Không tải được danh sách phim. Kiểm tra API hoặc mạng."
        )
      );
  }, []);

  const featured = movies.slice(0, 4);
  const heroMovies = movies.slice(0, 6);

  useEffect(() => {
    if (heroMovies.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroMovies.length]);

  return (
    <section>
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="home-beta-lead">
        <div className="home-top-marquee" aria-label="Thông báo rạp">
          <div className="home-top-marquee__track">
            {[...TOP_MARQUEE_ITEMS, ...TOP_MARQUEE_ITEMS].map((item, idx) => (
              <span key={`${item}-${idx}`} className="home-top-marquee__item">
                {item}
              </span>
            ))}
          </div>
        </div>
        {heroMovies.length ? (
          <div className="home-hero-banner">
            <img
              className="home-hero-banner__image"
              src={heroMovies[heroIndex].backdropUrl || heroMovies[heroIndex].posterUrl}
              alt=""
            />
            <div className="home-hero-banner__dots">
              {heroMovies.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    idx === heroIndex
                      ? "home-hero-banner__dot home-hero-banner__dot--active"
                      : "home-hero-banner__dot"
                  }
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Xem banner ${m.title}`}
                />
              ))}
            </div>
          </div>
        ) : null}
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
              />
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <Link to="/movies" className="cta-link">
              Xem tất cả phim đang chiếu →
            </Link>
          </p>
        </>
      ) : (
        <p className="section-muted" style={{ textAlign: "center", padding: "32px 0" }}>
          {tab === "upcoming"
            ? "Phim sắp chiếu đang được cập nhật."
            : "Ưu đãi suất đặc biệt xem tại mục khuyến mãi."}
        </p>
      )}
    </section>
  );
}

