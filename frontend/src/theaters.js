import { getTheaters } from "./api/client";

let cachePromise = null;
let cache = [];

function fetchAndCacheTheaters() {
  cachePromise = getTheaters()
    .then((items) => {
      cache = Array.isArray(items) ? items : [];
      return cache;
    })
    .catch(() => {
      cache = [];
      return [];
    });
  return cachePromise;
}

export async function loadTheaters(forceRefresh = false) {
  if (forceRefresh || !cachePromise) {
    return fetchAndCacheTheaters();
  }
  return cachePromise;
}

export async function refreshTheaters() {
  return fetchAndCacheTheaters();
}

export function getTheaterLabel(theaterId) {
  return cache.find((theater) => theater.id === theaterId)?.name || "Rạp chọn";
}

export function getTheaterKeywords(theaterId) {
  return cache.find((theater) => theater.id === theaterId)?.keywords || [];
}

export function getTheaterById(theaterId) {
  return cache.find((theater) => theater.id === theaterId) || cache[0] || null;
}

export function getAllTheaters() {
  return cache;
}

export function matchTheaterFromText(text) {
  const normalized = String(text || "").toLowerCase();
  return cache.find((theater) =>
    [theater.id, theater.name, theater.city, ...(theater.keywords || [])]
      .filter(Boolean)
      .some((value) => normalized.includes(String(value).toLowerCase())),
  );
}
