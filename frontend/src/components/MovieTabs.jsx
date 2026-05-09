const TABS = [
  { id: "upcoming", label: "PHIM SẮP CHIẾU" },
  { id: "now", label: "PHIM ĐANG CHIẾU" },
  { id: "special", label: "SUẤT CHIẾU ĐẶC BIỆT" }
];

export default function MovieTabs({ active, onChange }) {
  return (
    <div className="movie-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={
            active === t.id ? "movie-tab movie-tab--active" : "movie-tab"
          }
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
