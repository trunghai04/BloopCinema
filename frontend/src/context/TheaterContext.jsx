import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { refreshTheaters, getAllTheaters, getTheaterById } from "../theaters";

const STORAGE_KEY = "bloop-selected-theater";
const TheaterContext = createContext(null);

export function TheaterProvider({ children }) {
  const [selectedTheaterId, setSelectedTheaterId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "hanoi";
  });
  const [theaters, setTheaters] = useState(() => getAllTheaters());

  useEffect(() => {
    refreshTheaters().then((items) => {
      setTheaters(Array.isArray(items) ? items : []);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedTheaterId) return;
    window.localStorage.setItem(STORAGE_KEY, selectedTheaterId);
  }, [selectedTheaterId]);

  const selectedTheater =
    getTheaterById(selectedTheaterId) ||
    theaters.find((theater) => theater.id === selectedTheaterId) ||
    theaters[0] || {
      id: selectedTheaterId,
      name: "Rạp chọn",
      city: "",
      description: "",
    };

  const value = useMemo(
    () => ({
      selectedTheaterId,
      setSelectedTheaterId,
      selectedTheater,
      theaters,
    }),
    [selectedTheaterId, selectedTheater, theaters],
  );

  return (
    <TheaterContext.Provider value={value}>{children}</TheaterContext.Provider>
  );
}

export function useTheater() {
  const ctx = useContext(TheaterContext);
  if (!ctx) throw new Error("useTheater must be used within TheaterProvider");
  return ctx;
}
