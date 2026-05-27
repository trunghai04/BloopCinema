import { useEffect, useState } from "react";
import { getGenres, getMovies } from "../../api/client";
import MovieCardBeta from "../../components/MovieCardBeta";

export default function GenresPage() {
  const [genres, setGenres] = useState([]);
  const [movies, setMovies] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const [genresData, moviesData] = await Promise.all([
          getGenres(),
          getMovies(),
        ]);
        setGenres(genresData || []);
        setMovies(moviesData || []);
        // Chọn thể loại đầu tiên theo mặc định
        if (genresData && genresData.length > 0) {
          setSelectedGenre(genresData[0]);
        }
      } catch (e) {
        setLoadError(
          e?.message || "Không tải được dữ liệu. Kiểm tra kết nối API.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredMovies =
    selectedGenre && movies.length > 0
      ? movies.filter((movie) =>
          movie.genre?.toLowerCase().includes(selectedGenre.toLowerCase()),
        )
      : movies;

  return (
    <section className="genres-page">
      {loadError ? (
        <div className="container-main">
          <p className="api-fetch-error" role="alert">
            {loadError}
          </p>
        </div>
      ) : null}

      <div className="genres-container">
        <div className="genres-filter">
          <h2 className="filter-title">Thể loại</h2>
          <div className="genres-list">
            {isLoading ? (
              <p className="loading-text">Đang tải...</p>
            ) : genres && genres.length > 0 ? (
              genres.map((genre) => (
                <button
                  key={genre}
                  className={`genre-chip ${
                    selectedGenre === genre ? "active" : ""
                  }`}
                  onClick={() => setSelectedGenre(genre)}
                >
                  {genre}
                </button>
              ))
            ) : (
              <p className="no-data">Không có thể loại</p>
            )}
          </div>
        </div>

        <div className="genres-content">
          <div className="genres-header">
            <h2 className="section-title">
              {selectedGenre ? `Phim ${selectedGenre}` : "Tất cả phim"}
            </h2>
            <p className="section-muted">{filteredMovies.length} phim</p>
          </div>

          {isLoading ? (
            <div className="loading-container">
              <p>Đang tải phim...</p>
            </div>
          ) : filteredMovies && filteredMovies.length > 0 ? (
            <div className="movies-grid">
              {filteredMovies.map((movie) => (
                <MovieCardBeta key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="no-movies">
              <p>
                {selectedGenre
                  ? `Không có phim nào thuộc thể loại ${selectedGenre}`
                  : "Không có phim nào"}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
