import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getAdminSeatLayouts,
  getMovies,
  getReservationShowtimeSeats,
  getShowtimes,
  syncReservationSeatLock,
  holdReservation
} from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { normalizeAgeRating, ratingForMovie } from "../../utils/movieRating";
import gheTrong from "../../assets/ghetrong.webp";
import gheDangChon from "../../assets/ghedangchon.webp";
import gheDangGiu from "../../assets/ghedanggiu.webp";
import gheDaBan from "../../assets/ghedaban.webp";
import gheDatTruoc from "../../assets/ghedattruoc.webp";
import gheThuong from "../../assets/ghethuong.webp";
import gheVip from "../../assets/ghevip.webp";
import gheDoi from "../../assets/ghedoi.webp";
import { GRID_X, GRID_Y, SEAT_W, SEAT_H } from "../../utils/seatLayout";

const FALLBACK_ROWS = ["A", "B", "C", "D", "E", "F"];
const FALLBACK_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_SEAT_PRICES = { standard: 50000, vip: 75000, couple: 100000 };
const HOLD_SECONDS = 300;

function seatCode(row, col) {
  return `${row}${col}`;
}

function parseSeatCode(code) {
  const m = String(code || "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { row: m[1], col: Number(m[2]) || 0 };
}

export default function SeatSelectPage() {
  const { user, isLoggedIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const movieId = params.get("movieId") || "";
  const showtimeId = params.get("showtimeId") || "";
  const hallParam = params.get("hall") || "";

  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState([]);
  const [freeSeats, setFreeSeats] = useState([]);
  const [occupied, setOccupied] = useState([]);
  const [holding, setHolding] = useState([]);
  const [sold, setSold] = useState([]);
  const [reserved, setReserved] = useState([]);
  const [locking, setLocking] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seatMapWarning, setSeatMapWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [movie, setMovie] = useState(null);
  const [showtime, setShowtime] = useState(null);
  const [seatPrices, setSeatPrices] = useState(DEFAULT_SEAT_PRICES);
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const lockSessionId = useMemo(() => {
    const key = "seat-lock-session-id";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  }, []);

  const loadSeats = useCallback(async () => {
    if (!showtimeId) return;
    try {
      const data = await getReservationShowtimeSeats(showtimeId);
      setRows(data.rows || []);
      setCols(data.cols || []);
      setOccupied(data.occupied || []);
      setHolding(data.holding || []);
      setSold(data.sold || []);
      setReserved(data.reserved || []);
      setLocking(data.locking || []);
    } catch (e) {
      if (e?.status === 404) {
        setRows(FALLBACK_ROWS);
        setCols(FALLBACK_COLS);
        setOccupied([]);
        setHolding([]);
        setSold([]);
        setReserved([]);
        setLocking([]);
        setSeatMapWarning(
          "API sơ đồ ghế chưa sẵn sàng (404). Đang dùng sơ đồ ghế mặc định."
        );
      } else {
        setError(e.message || "Không tải được sơ đồ ghế");
      }
    }
  }, [showtimeId]);

  useEffect(() => {
    if (!movieId || !showtimeId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setSeatMapWarning("");
    Promise.all([loadSeats(), getMovies(), getShowtimes(), getAdminSeatLayouts()])
      .then(([, movies, showtimes, seatLayouts]) => {
        if (cancelled) return;
        setMovie(movies.find((m) => m.id === movieId) || null);
        const st = showtimes.find((s) => s.id === showtimeId) || null;
        setShowtime(st);
        const hall = String(hallParam || st?.hall || "").trim().toLowerCase();
        const layout = (seatLayouts || []).find(
          (l) => String(l?.hall || "").trim().toLowerCase() === hall
        );
        const prices = layout?.seatPrices || {};
        setSeatPrices({
          standard: Number(prices.standard) || DEFAULT_SEAT_PRICES.standard,
          vip: Number(prices.vip) || DEFAULT_SEAT_PRICES.vip,
          couple: Number(prices.couple) || DEFAULT_SEAT_PRICES.couple
        });
        const layoutSeats = (layout?.seats || [])
          .map((s) => ({
            code: String(s.code || "").toUpperCase(),
            x: Number(s.x) || 0,
            y: Number(s.y) || 0,
            type: String(s.type || "standard").toLowerCase(),
            enabled: s?.enabled !== false
          }))
          .filter((s) => s.code);
        if (layoutSeats.length) {
          setFreeSeats(layoutSeats);
        } else {
          setFreeSeats([]);
          if (layout?.rows?.length) setRows(layout.rows);
          if (layout?.cols > 0) {
            setCols(Array.from({ length: Number(layout.cols) }, (_, i) => i + 1));
          }
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Không tải được dữ liệu chọn ghế.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSeats, movieId, showtimeId, hallParam]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const occupiedSet = useMemo(
    () => new Set((occupied || []).map((s) => String(s).toUpperCase())),
    [occupied]
  );
  const holdingSet = useMemo(
    () => new Set((holding || []).map((s) => String(s).toUpperCase())),
    [holding]
  );
  const soldSet = useMemo(
    () => new Set((sold || []).map((s) => String(s).toUpperCase())),
    [sold]
  );
  const reservedSet = useMemo(
    () => new Set((reserved || []).map((s) => String(s).toUpperCase())),
    [reserved]
  );
  const lockingSet = useMemo(
    () => new Set((locking || []).map((s) => String(s).toUpperCase())),
    [locking]
  );
  const selectedSeats = useMemo(() => [...selected].sort(), [selected]);
  const codedSeatGrid = useMemo(() => {
    if (!freeSeats.length) return null;
    const parsed = freeSeats
      .map((s) => ({ seat: s, meta: parseSeatCode(s.code) }))
      .filter((x) => x.meta && x.meta.col > 0);
    if (!parsed.length || parsed.length !== freeSeats.length) return null;

    const rowMap = new Map(); // row -> Map<slotIdx, seat>
    let maxSlot = 0;
    parsed.forEach(({ seat, meta }) => {
      const row = meta.row;
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row).push(seat);
    });

    const normalizedRowMap = new Map();
    [...rowMap.entries()].forEach(([row, seats]) => {
      const minX = Math.min(...seats.map((s) => s.x));
      const slotMap = new Map();
      seats.forEach((s) => {
        const slot = Math.max(1, Math.round((s.x - minX) / GRID_X) + 1);
        slotMap.set(slot, s);
        if (slot > maxSlot) maxSlot = slot;
      });
      normalizedRowMap.set(row, slotMap);
    });

    const rowKeys = [...normalizedRowMap.keys()].sort();
    return { rowKeys, rowMap: normalizedRowMap, maxCol: maxSlot };
  }, [freeSeats]);
  const selectedTypeMap = useMemo(
    () => new Map((freeSeats || []).map((s) => [String(s.code || "").toUpperCase(), String(s.type || "standard").toLowerCase()])),
    [freeSeats]
  );
  const totalPrice = useMemo(
    () =>
      selectedSeats.reduce((sum, code) => {
        const t = selectedTypeMap.get(code) || "standard";
        if (t === "vip") return sum + (seatPrices.vip || DEFAULT_SEAT_PRICES.vip);
        if (t === "couple") return sum + (seatPrices.couple || DEFAULT_SEAT_PRICES.couple);
        return sum + (seatPrices.standard || DEFAULT_SEAT_PRICES.standard);
      }, 0),
    [selectedSeats, selectedTypeMap, seatPrices]
  );
  const movieRating = movie?.id
    ? normalizeAgeRating(movie?.ageRating) || ratingForMovie(movie.id)
    : "T13";

  useEffect(() => {
    if (!showtimeId || !lockSessionId) return undefined;
    let cancelled = false;
    syncReservationSeatLock({
      showtimeId,
      sessionId: lockSessionId,
      seats: selectedSeats
    })
      .then((res) => {
        if (cancelled) return;
        setLocking(res.locking || []);
        const expiresAtMs = res?.expiresAt ? new Date(res.expiresAt).getTime() : 0;
        if (expiresAtMs > 0) setSessionExpiresAtMs(expiresAtMs);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.status === 409) {
          const conflicts = e?.message?.conflicts || [];
          setSelected((prev) => {
            const next = new Set(prev);
            conflicts.forEach((s) => next.delete(String(s).toUpperCase()));
            return next;
          });
          setError("Một số ghế vừa bị người khác giữ trước.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeats, showtimeId, lockSessionId]);

  useEffect(() => {
    if (!showtimeId || !lockSessionId) return undefined;
    const poll = setInterval(() => {
      loadSeats();
    }, 5000);
    return () => clearInterval(poll);
  }, [loadSeats, showtimeId, lockSessionId]);

  useEffect(() => () => {
    if (!showtimeId || !lockSessionId) return;
    syncReservationSeatLock({ showtimeId, sessionId: lockSessionId, seats: [] }).catch(() => {});
  }, [showtimeId, lockSessionId]);

  const timeLeft = useMemo(() => {
    if (!sessionExpiresAtMs) return HOLD_SECONDS;
    return Math.max(0, Math.floor((sessionExpiresAtMs - nowMs) / 1000));
  }, [sessionExpiresAtMs, nowMs]);

  useEffect(() => {
    if (timeLeft > 0) return;
    if (!sessionExpiresAtMs || !showtimeId || !lockSessionId) return;

    syncReservationSeatLock({ showtimeId, sessionId: lockSessionId, seats: [] }).catch(() => {});
    setSelected(new Set());
    navigate("/");
  }, [timeLeft, sessionExpiresAtMs, showtimeId, lockSessionId, navigate]);

  const timeLeftText = useMemo(() => {
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const ss = String(timeLeft % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [timeLeft]);

  function toggleSeat(code) {
    const c = code.toUpperCase();
    if (occupiedSet.has(c)) return;
    if (lockingSet.has(c) && !selected.has(c)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function confirmHold() {
    if (!isLoggedIn || !user?.email) {
      navigate(
        `/login?redirect=${encodeURIComponent(`/book/seats?movieId=${movieId}&showtimeId=${showtimeId}&hall=${encodeURIComponent(hallParam)}`)}`
      );
      return;
    }
    if (!movieId || !showtimeId) {
      setError("Thiếu phim hoặc suất chiếu.");
      return;
    }
    const seats = selectedSeats;
    if (seats.length === 0) {
      setError("Chọn ít nhất một ghế.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await holdReservation({
        userEmail: user.email,
        movieId,
        showtimeId,
        sessionId: lockSessionId,
        seats
      });
      navigate(`/book/payment?holdId=${encodeURIComponent(res.id)}`);
    } catch (e) {
      setError(e.message || "Giữ ghế thất bại — có thể ghế vừa bị đặt.");
      await loadSeats();
      setSelected(new Set());
    } finally {
      setSubmitting(false);
    }
  }

  if (!movieId || !showtimeId) {
    return (
      <section>
        <p className="section-muted">Thiếu tham số phim hoặc suất chiếu.</p>
        <Link to="/movies" className="cta-link">
          Chọn phim
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="section-muted">Đang tải sơ đồ ghế…</p>;
  }

  return (
    <section className="seat-select-layout">
      <div>
      <h2 className="section-title">Chọn ghế</h2>
      {seatMapWarning ? <p className="section-muted">{seatMapWarning}</p> : null}
      <div className="seat-legend">
        <span>
          <img src={gheTrong} className="seat-sample-img" alt="" aria-hidden /> Ghế trống
        </span>
        <span>
          <img src={gheDangChon} className="seat-sample-img" alt="" aria-hidden /> Ghế đang chọn
        </span>
        <span>
          <img src={gheDangGiu} className="seat-sample-img" alt="" aria-hidden /> Ghế đang giữ
        </span>
        <span>
          <img src={gheDaBan} className="seat-sample-img" alt="" aria-hidden /> Ghế đã bán
        </span>
        <span>
          <img src={gheDatTruoc} className="seat-sample-img" alt="" aria-hidden /> Ghế đặt trước
        </span>
      </div>
      <div className="seat-screen">MÀN HÌNH</div>
      <div className="seat-grid">
        {freeSeats.length && codedSeatGrid ? (
          <div className="seat-grid-coded">
            {codedSeatGrid.rowKeys.map((row) => (
              <div key={row} className="seat-row seat-row--coded">
                {Array.from({ length: codedSeatGrid.maxCol }, (_, i) => i + 1).map((col) => {
                  const seat = codedSeatGrid.rowMap.get(row)?.get(col) || null;
                  if (!seat) return <span key={`${row}-${col}`} className="seat-gap" aria-hidden />;
              const code = seat.code;
              const soldSeat = soldSet.has(code);
              const holdingSeat = holdingSet.has(code);
              const reservedSeat = reservedSet.has(code);
              const lockingSeat = lockingSet.has(code) && !selected.has(code);
              const occ = occupiedSet.has(code) || lockingSeat || !seat.enabled;
              const sel = selected.has(code);
              const baseSeatImage =
                seat.type === "vip"
                  ? gheVip
                  : seat.type === "couple"
                    ? gheDoi
                    : gheThuong;
                  const imageSrc = baseSeatImage;
              return (
                <button
                  key={code}
                  type="button"
                  className={
                    [
                      "seat-cell",
                      occ ? "seat-cell--occupied" : "",
                      sel ? "seat-cell--selected" : "",
                      holdingSeat ? "seat-cell--holding" : "",
                      reservedSeat ? "seat-cell--reserved" : "",
                      soldSeat ? "seat-cell--sold" : "",
                      lockingSeat ? "seat-cell--locking" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                  style={{ "--seat-mask": `url(${baseSeatImage})` }}
                  disabled={occ}
                  onClick={() => toggleSeat(code)}
                >
                  <img src={imageSrc} className="seat-cell__img" alt="" aria-hidden />
                  <span className="seat-cell__state-fill" aria-hidden />
                  <span className="seat-cell__code">{code}</span>
                </button>
              );
                })}
              </div>
            ))}
          </div>
        ) : freeSeats.length ? (
          <div className="seat-grid-free-wrap">
            <div className="seat-grid-free">
              {freeSeats.map((seat) => {
                const code = seat.code;
                const soldSeat = soldSet.has(code);
                const holdingSeat = holdingSet.has(code);
                const reservedSeat = reservedSet.has(code);
                const lockingSeat = lockingSet.has(code) && !selected.has(code);
                const occ = occupiedSet.has(code) || lockingSeat || !seat.enabled;
                const sel = selected.has(code);
                const baseSeatImage =
                  seat.type === "vip"
                    ? gheVip
                    : seat.type === "couple"
                      ? gheDoi
                      : gheThuong;
                const imageSrc = baseSeatImage;
                return (
                  <button
                    key={code}
                    type="button"
                    className={
                      [
                        "seat-cell",
                        "seat-cell--free",
                        occ ? "seat-cell--occupied" : "",
                        sel ? "seat-cell--selected" : "",
                        holdingSeat ? "seat-cell--holding" : "",
                        reservedSeat ? "seat-cell--reserved" : "",
                        soldSeat ? "seat-cell--sold" : "",
                        lockingSeat ? "seat-cell--locking" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")
                    }
                    style={{
                      left: `${seat.x}px`,
                      top: `${seat.y}px`,
                      width: `${SEAT_W}px`,
                      height: `${SEAT_H}px`,
                      "--seat-mask": `url(${baseSeatImage})`
                    }}
                    disabled={occ}
                    onClick={() => toggleSeat(code)}
                  >
                    <img src={imageSrc} className="seat-cell__img" alt="" aria-hidden />
                    <span className="seat-cell__state-fill" aria-hidden />
                    <span className="seat-cell__code">{code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row} className="seat-row">
              {cols.map((col) => {
                const code = seatCode(row, col);
                const soldSeat = soldSet.has(code);
                const holdingSeat = holdingSet.has(code);
                const reservedSeat = reservedSet.has(code);
                const lockingSeat = lockingSet.has(code) && !selected.has(code);
                const occ = occupiedSet.has(code) || lockingSeat;
                const sel = selected.has(code);
                const imageSrc = soldSeat
                  ? gheDaBan
                  : reservedSeat
                    ? gheDatTruoc
                    : holdingSeat
                      ? gheDangGiu
                      : lockingSeat
                        ? gheDangGiu
                        : sel
                          ? gheDangChon
                          : gheTrong;
                return (
                  <button
                    key={code}
                    type="button"
                    className={
                      occ
                        ? "seat-cell seat-cell--occupied"
                        : sel
                          ? "seat-cell seat-cell--selected"
                          : "seat-cell"
                    }
                    disabled={occ}
                    onClick={() => toggleSeat(code)}
                  >
                    <img
                      src={imageSrc}
                      className="seat-cell__img"
                      alt=""
                      aria-hidden
                    />
                    <span className="seat-cell__code">{code}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
      <div className="seat-type-legend" aria-label="Phân loại ghế">
        <p className="seat-type-legend__title">Phân loại ghế</p>
        <div className="seat-type-legend__items">
          <span className="seat-type-legend__item">
            <img src={gheThuong} className="seat-type-legend__img" alt="" aria-hidden />
            Ghế thường
          </span>
          <span className="seat-type-legend__item">
            <img src={gheVip} className="seat-type-legend__img" alt="" aria-hidden />
            Ghế VIP
          </span>
          <span className="seat-type-legend__item">
            <img src={gheDoi} className="seat-type-legend__img" alt="" aria-hidden />
            Ghế đôi
          </span>
        </div>
      </div>
      {error ? <p className="book-error">{error}</p> : null}
      <div className="seat-summary-bar">
        <div className="seat-summary-item">
          <span className="seat-summary-label">Số lượng vé</span>
          <strong>{selectedSeats.length}</strong>
        </div>
        <div className="seat-summary-item">
          <span className="seat-summary-label">Tổng tiền</span>
          <strong>{totalPrice.toLocaleString("vi-VN")} vnđ</strong>
        </div>
        <div className="seat-summary-item">
          <span className="seat-summary-label">Thời gian còn lại</span>
          <strong>{timeLeftText}</strong>
        </div>
      </div>
      <div className="book-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(-1)}
        >
          Quay lại
        </button>
      </div>
      </div>
      <aside className="seat-side-card">
        <div className="seat-side-card__hero">
          {movie?.posterUrl ? (
            <div className="seat-side-card__poster-wrap">
              <img className="seat-side-card__poster" src={movie.posterUrl} alt="" />
              <span className="seat-side-card__rating">{movieRating}</span>
            </div>
          ) : null}
          <div>
            <h3 className="seat-side-card__title">{movie?.title || movieId}</h3>
            <p className="seat-side-card__format">2D Phụ đề</p>
          </div>
        </div>
        <dl className="seat-side-card__meta">
          <dt>Thể loại</dt>
          <dd>{movie?.genre || "Đang cập nhật"}</dd>
          <dt>Thời lượng</dt>
          <dd>{movie?.durationMin ? `${movie.durationMin} phút` : "Đang cập nhật"}</dd>
          <dt>Rạp chiếu</dt>
          <dd>{showtime?.hall || "Rạp trung tâm"}</dd>
          <dt>Ngày chiếu</dt>
          <dd>
            {showtime?.startAt
              ? new Date(showtime.startAt).toLocaleDateString("vi-VN")
              : "Đang cập nhật"}
          </dd>
          <dt>Giờ chiếu</dt>
          <dd>
            {showtime?.startAt
              ? new Date(showtime.startAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false
                })
              : "Đang cập nhật"}
          </dd>
          <dt>Ghế ngồi</dt>
          <dd>{selectedSeats.join(", ") || "--"}</dd>
        </dl>
        <button
          type="button"
          className="seat-side-card__cta"
          onClick={confirmHold}
          disabled={submitting || selectedSeats.length === 0}
        >
          {submitting ? "ĐANG GIỮ GHẾ…" : "TIẾP TỤC"}
        </button>
      </aside>
    </section>
  );
}

