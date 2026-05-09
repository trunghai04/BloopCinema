import { useEffect, useState } from "react";
import { getMovies } from "../../api/client";
import MovieCardBeta from "../../components/MovieCardBeta";
import MovieTabs from "../../components/MovieTabs";

export default function MoviesPage() {
  const [movies, setMovies] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("now");

  useEffect(() => {
    setLoadError("");
    getMovies()
      .then(setMovies)
      .catch((e) =>
        setLoadError(
          e?.message ||
            "Không tải được phim. Trên điện thoại mở đúng địa chỉ máy chủ (cùng Wi‑Fi)."
        )
      );
  }, []);

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
          {movies.map((movie, idx) => (
            <MovieCardBeta
              key={movie.id}
              movie={movie}
              showHot={idx < 2}
            />
          ))}
        </div>
      ) : (
        <p className="section-muted" style={{ textAlign: "center", padding: "32px 0" }}>
          {tab === "upcoming"
            ? "Phần phim sắp chiếu đang cập nhật — quay lại sau."
            : "Suất chiếu đặc biệt sẽ được công bố trên trang khuyến mãi."}
        </p>
      )}
    </section>
  );
}

