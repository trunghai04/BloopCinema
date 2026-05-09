import { useEffect, useState } from "react";
import { getGenres } from "../../api/client";

export default function GenresPage() {
  const [genres, setGenres] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadError("");
    getGenres()
      .then(setGenres)
      .catch((e) =>
        setLoadError(e?.message || "Không tải được thể loại. Kiểm tra API.")
      );
  }, []);

  return (
    <section>
      {loadError ? (
        <p className="api-fetch-error" role="alert">
          {loadError}
        </p>
      ) : null}
      <h2 className="section-title">Thể loại đang chiếu</h2>
      <p className="section-muted">Khám phá theo gu phim của bạn.</p>
      <div className="chip-row">
        {genres.map((genre) => (
          <span className="chip" key={genre}>
            {genre}
          </span>
        ))}
      </div>
    </section>
  );
}

