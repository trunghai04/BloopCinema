import { useState } from "react";
import { Link } from "react-router-dom";
import TicketIcon from "./TicketIcon";
import { normalizeAgeRating, ratingForMovie } from "../utils/movieRating";

/** Thẻ phim kiểu rạp: poster + badge tuổi + CTA MUA VÉ (navy + icon tím/hồng). */
export default function MovieCardBeta({ movie, showHot = false, showBuyButton = true, statusLabel = "" }) {
  const rating = normalizeAgeRating(movie?.ageRating) || ratingForMovie(movie.id);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerId = String(movie?.trailerYoutubeId || "").trim();

  return (
    <article className="movie-card-beta">
      <div className="movie-card-beta__poster-wrap">
        <Link to={`/movies/${movie.id}`} className="movie-card-beta__poster-link">
          <img
            className="movie-card-beta__poster"
            src={movie.posterUrl}
            alt={movie.title}
          />
          <span className="movie-card-beta__badge-age">{rating}</span>
          {showHot ? (
            <span className="movie-card-beta__ribbon" aria-hidden>
              HOT
            </span>
          ) : null}
        </Link>
        {trailerId ? (
          <button
            type="button"
            className="movie-card-beta__trailer-play"
            onClick={() => setShowTrailer(true)}
            aria-label={`Xem trailer ${movie.title}`}
          >
            ▶
          </button>
        ) : null}
      </div>
      <div className="movie-card-beta__body">
        <Link to={`/movies/${movie.id}`} className="movie-card-beta__title">
          {movie.title}
        </Link>
        {statusLabel ? <p className="movie-card-beta__status">{statusLabel}</p> : null}
        <p className="movie-card-beta__meta">
          <span className="movie-card-beta__label">Thể loại:</span> {movie.genre}
        </p>
        <p className="movie-card-beta__meta">
          <span className="movie-card-beta__label">Thời lượng:</span>{" "}
          {movie.durationMin} phút
        </p>
        {showBuyButton ? (
          <Link to={`/movies/${movie.id}`} className="btn-mua-ve">
            <span className="btn-mua-ve__icon" aria-hidden>
              <TicketIcon />
            </span>
            <span className="btn-mua-ve__label">MUA VÉ</span>
          </Link>
        ) : (
          <span className="movie-card-beta__no-showtimes">Chưa có lịch chiếu</span>
        )}
      </div>

      {showTrailer ? (
        <div
          className="movie-card-beta__trailer-overlay"
          role="presentation"
          onClick={() => setShowTrailer(false)}
        >
          <section
            className="movie-card-beta__trailer-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Trailer ${movie.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="movie-card-beta__trailer-close"
              aria-label="Đóng"
              onClick={() => setShowTrailer(false)}
            >
              ×
            </button>
            <h3 className="movie-card-beta__trailer-title">TRAILER - {movie.title}</h3>
            <div className="trailer-embed">
              <iframe
                title={`Trailer ${movie.title}`}
                src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
