const RATINGS = ["K", "T13", "T16", "T18"];

export function ratingForMovie(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h += id.charCodeAt(i);
  return RATINGS[h % RATINGS.length];
}

export function normalizeAgeRating(value) {
  const v = String(value || "").trim().toUpperCase();
  return RATINGS.includes(v) ? v : "";
}
