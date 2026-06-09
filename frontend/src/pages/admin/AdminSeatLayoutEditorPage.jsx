import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAdminSeatLayouts, getAdminTheaters, upsertAdminSeatLayout } from "../../api/client";
import gheThuongImg from "../../assets/ghethuong.webp";
import gheVipImg from "../../assets/ghevip.webp";
import gheDoiImg from "../../assets/ghedoi.webp";
import { GRID_X, GRID_Y, SEAT_W, SEAT_H } from "../../utils/seatLayout";

const TOOLS = { SELECT: "select", ADD: "add", ERASE: "erase" };
const DEFAULT_SEAT_PRICES = { standard: 50000, vip: 75000, couple: 100000 };

function normalizeRows(rowsCsv) {
  return String(rowsCsv)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function makeSeatNodesFromGrid(rowsCsv, cols) {
  const rows = normalizeRows(rowsCsv);
  const maxCols = Number(cols) > 0 ? Number(cols) : 10;
  const seats = [];
  rows.forEach((row, rowIndex) => {
    for (let col = 1; col <= maxCols; col += 1) {
      seats.push({
        code: `${row}${col}`,
        x: colToX(col - 1),
        y: rowToY(rowIndex),
        type: "standard",
        enabled: true
      });
    }
  });
  return seats;
}

function xToCol(x) {
  return Math.max(0, Math.round((Number(x) || 0) / GRID_X));
}
function yToRow(y) {
  return Math.max(0, Math.round((Number(y) || 0) / GRID_Y));
}
function colToX(col) {
  return Math.max(0, col) * GRID_X;
}
function rowToY(row) {
  return Math.max(0, row) * GRID_Y;
}

function codeAt(rowIdx, colIdx, rows) {
  const label = rows[rowIdx] || String.fromCharCode(65 + rowIdx);
  return `${label}${colIdx + 1}`;
}

function buildSeatMap(seats) {
  const map = new Map();
  (seats || []).forEach((s, idx) => map.set(String(s.code || "").toUpperCase(), { ...s, idx }));
  return map;
}

export default function AdminSeatLayoutEditorPage() {
  const { hall } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [selectedCodes, setSelectedCodes] = useState(new Set());
  const [dragState, setDragState] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [addSeatType, setAddSeatType] = useState("standard");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [clipboard, setClipboard] = useState([]);
  const [pasteCount, setPasteCount] = useState(0);
  const [theaters, setTheaters] = useState([]);
  const [layoutDraft, setLayoutDraft] = useState({
    theaterId: "",
    hall: decodeURIComponent(hall || "Hall A"),
    rows: "A,B,C,D,E,F",
    cols: 10,
    blockedSeats: "",
    seatPrices: { ...DEFAULT_SEAT_PRICES },
    seats: makeSeatNodesFromGrid("A,B,C,D,E,F", 10)
  });

  const draftKey = useMemo(
    () => `admin-seat-layout-draft:${decodeURIComponent(hall || "Hall A")}`,
    [hall]
  );

  function pushHistory(currentSeats) {
    setUndoStack((prev) => [...prev.slice(-39), JSON.parse(JSON.stringify(currentSeats || []))]);
    setRedoStack([]);
  }

  function updateSeats(mutator) {
    setLayoutDraft((prev) => {
      pushHistory(prev.seats);
      const nextSeats = mutator(prev.seats || []);
      return { ...prev, seats: nextSeats };
    });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getAdminSeatLayouts(), getAdminTheaters()])
      .then(([layouts, theaterList]) => {
        if (cancelled) return;
        setTheaters(theaterList || []);
        const targetHall = decodeURIComponent(hall || "Hall A");
        const current = (layouts || []).find(
          (l) => String(l.hall || "").toLowerCase() === String(targetHall).toLowerCase()
        );
        const inferredTheaterId = String(current?.theaterId || current?.theater || current?.cinema || theaterList[0]?.id || "").trim();
        const draftRaw = localStorage.getItem(`admin-seat-layout-draft:${targetHall}`);
        if (draftRaw) {
          try {
            const parsed = JSON.parse(draftRaw);
            const normalized = {
              ...parsed,
              theaterId: String(parsed?.theaterId || inferredTheaterId || "").trim(),
              hall: String(parsed?.hall || targetHall).trim()
            };
            if (!normalized.theaterId) {
              localStorage.removeItem(`admin-seat-layout-draft:${targetHall}`);
            } else {
              setLayoutDraft(normalized);
              setLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem(`admin-seat-layout-draft:${targetHall}`);
          }
        }
        if (!current) {
          setLayoutDraft((prev) => ({
            ...prev,
            hall: targetHall,
            theaterId: inferredTheaterId || theaterList[0]?.id || prev.theaterId
          }));
          if (!inferredTheaterId) localStorage.removeItem(`admin-seat-layout-draft:${targetHall}`);
          return;
        }
        const prices = current.seatPrices || {};
        setLayoutDraft({
          theaterId: inferredTheaterId || theaterList[0]?.id || "",
          hall: current.hall || targetHall,
          rows: (current.rows || []).join(","),
          cols: Number(current.cols) || 10,
          blockedSeats: (current.blockedSeats || []).join(","),
          seatPrices: {
            standard: Number(prices.standard) || DEFAULT_SEAT_PRICES.standard,
            vip: Number(prices.vip) || DEFAULT_SEAT_PRICES.vip,
            couple: Number(prices.couple) || DEFAULT_SEAT_PRICES.couple
          },
          seats:
            current.seats?.length > 0
              ? current.seats.map((s) => ({
                  code: String(s.code || "").toUpperCase(),
                  x: Number(s.x) || 0,
                  y: Number(s.y) || 0,
                  type: String(s.type || "standard").toLowerCase(),
                  enabled: s.enabled !== false
                }))
              : makeSeatNodesFromGrid((current.rows || []).join(","), current.cols || 10)
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Không tải được layout.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hall]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(draftKey, JSON.stringify(layoutDraft));
  }, [layoutDraft, draftKey, loading]);

  const rows = useMemo(() => normalizeRows(layoutDraft.rows), [layoutDraft.rows]);
  const maxCols = useMemo(() => (Number(layoutDraft.cols) > 0 ? Number(layoutDraft.cols) : 10), [layoutDraft.cols]);
  const canvasSize = useMemo(
    () => ({
      width: Math.max(620, maxCols * GRID_X + 20),
      height: Math.max(320, Math.max(rows.length, 1) * GRID_Y + 24)
    }),
    [rows.length, maxCols]
  );
  const seatMap = useMemo(() => buildSeatMap(layoutDraft.seats), [layoutDraft.seats]);
  const selectedSeat = useMemo(() => {
    const code = [...selectedCodes][0];
    return code ? seatMap.get(code) : null;
  }, [selectedCodes, seatMap]);

  function undo() {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      setLayoutDraft((cur) => {
        const last = prev[prev.length - 1];
        setRedoStack((r) => [...r.slice(-39), JSON.parse(JSON.stringify(cur.seats || []))]);
        return { ...cur, seats: JSON.parse(JSON.stringify(last)) };
      });
      return prev.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      setLayoutDraft((cur) => {
        const last = prev[prev.length - 1];
        setUndoStack((u) => [...u.slice(-39), JSON.parse(JSON.stringify(cur.seats || []))]);
        return { ...cur, seats: JSON.parse(JSON.stringify(last)) };
      });
      return prev.slice(0, -1);
    });
  }

  function addSeatAt(rowIdx, colIdx) {
    const code = codeAt(rowIdx, colIdx, rows);
    if (seatMap.has(code)) return;
    updateSeats((seats) => [
      ...seats,
      { code, x: colToX(colIdx), y: rowToY(rowIdx), type: addSeatType, enabled: true }
    ]);
    setSelectedCodes(new Set([code]));
  }

  function eraseSeat(code) {
    updateSeats((seats) => seats.filter((s) => String(s.code || "").toUpperCase() !== code));
    setSelectedCodes((prev) => {
      const n = new Set(prev);
      n.delete(code);
      return n;
    });
  }

  function fillMissingSeats() {
    updateSeats((seats) => {
      const byCode = new Map(seats.map((s) => [String(s.code || "").toUpperCase(), s]));
      const next = [];
      for (let r = 0; r < Math.max(rows.length, 1); r += 1) {
        for (let c = 0; c < maxCols; c += 1) {
          const code = codeAt(r, c, rows);
          const existing = byCode.get(code);
          next.push(
            existing || {
              code,
              x: colToX(c),
              y: rowToY(r),
              type: "standard",
              enabled: true
            }
          );
        }
      }
      return next;
    });
  }

  function autoRenumber() {
    updateSeats((seats) => {
      const ordered = [...seats].sort(
        (a, b) => yToRow(a.y) - yToRow(b.y) || xToCol(a.x) - xToCol(b.x)
      );
      const rowCounters = new Map();
      return ordered.map((s) => {
        const r = yToRow(s.y);
        const current = rowCounters.get(r) || 0;
        const next = current + 1;
        rowCounters.set(r, next);
        const label = rows[r] || String.fromCharCode(65 + r);
        return { ...s, code: `${label}${next}` };
      });
    });
  }

  function applyTypeDirectly(newType) {
    if (!selectedCodes.size) return;
    updateSeats((seats) =>
      seats.map((s) =>
        selectedCodes.has(String(s.code || "").toUpperCase()) ? { ...s, type: newType } : s
      )
    );
  }

  function toggleSelectedEnabled() {
    if (!selectedCodes.size) return;
    updateSeats((seats) =>
      seats.map((s) =>
        selectedCodes.has(String(s.code || "").toUpperCase()) ? { ...s, enabled: !s.enabled } : s
      )
    );
  }

  function regenerateLayoutFromGrid() {
    if (window.confirm("Bạn có chắc chắn muốn xóa sơ đồ hiện tại để tạo lại từ đầu theo lưới Hàng & Cột mới?")) {
      const nextSeats = makeSeatNodesFromGrid(layoutDraft.rows, layoutDraft.cols);
      updateSeats(() => nextSeats);
      setSelectedCodes(new Set());
    }
  }

  function clearLayoutCanvas() {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ ghế trên sơ đồ?")) {
      updateSeats(() => []);
      setSelectedCodes(new Set());
    }
  }

  function onCanvasClick(event) {
    if (dragState) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - pan.x) / zoom;
    const worldY = (event.clientY - rect.top - pan.y) / zoom;
    const col = xToCol(worldX);
    const row = yToRow(worldY);
    if (col >= maxCols) return;
    const code = codeAt(row, col, rows);

    if (tool === TOOLS.ADD) {
      addSeatAt(row, col);
      return;
    }
    if (tool === TOOLS.ERASE) {
      if (seatMap.has(code)) eraseSeat(code);
      return;
    }
    if (!seatMap.has(code)) {
      setSelectedCodes(new Set());
      return;
    }
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (event.shiftKey) {
        if (next.has(code)) next.delete(code);
        else next.add(code);
      } else {
        next.clear();
        next.add(code);
      }
      return next;
    });
  }

  function onSeatMouseDown(event, code) {
    if (tool !== TOOLS.SELECT && tool !== TOOLS.ERASE) return;
    if (tool === TOOLS.ERASE) {
      eraseSeat(code);
      return;
    }
    if (!canvasRef.current) return;
    const seat = seatMap.get(code);
    if (!seat) return;
    if (!selectedCodes.has(code)) setSelectedCodes(new Set([code]));
    setDragState({
      type: "move",
      startX: event.clientX,
      startY: event.clientY,
      originalSeats: JSON.parse(JSON.stringify(layoutDraft.seats || [])),
      hasMoved: false,
      originPositions: (layoutDraft.seats || [])
        .filter((s) => selectedCodes.has(String(s.code || "").toUpperCase()) || String(s.code || "").toUpperCase() === code)
        .map((s) => ({ code: String(s.code || "").toUpperCase(), x: s.x, y: s.y })),
    });
  }

  function onCanvasMouseDown(event) {
    if (!canvasRef.current) return;
    if (spacePressed) {
      setDragState({
        type: "pan",
        startX: event.clientX,
        startY: event.clientY,
        originPanX: pan.x,
        originPanY: pan.y
      });
      return;
    }
    if (tool !== TOOLS.SELECT) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - pan.x) / zoom;
    const worldY = (event.clientY - rect.top - pan.y) / zoom;
    setDragState({
      type: "box",
      startX: worldX,
      startY: worldY,
      currentX: worldX,
      currentY: worldY
    });
    setSelectionBox({ startX: worldX, startY: worldY, currentX: worldX, currentY: worldY });
  }

  useEffect(() => {
    if (!dragState) return undefined;
    const onMove = (event) => {
      if (dragState.type === "pan") {
        setPan({
          x: dragState.originPanX + (event.clientX - dragState.startX),
          y: dragState.originPanY + (event.clientY - dragState.startY)
        });
        return;
      }
      if (dragState.type === "box") {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const worldX = (event.clientX - rect.left - pan.x) / zoom;
        const worldY = (event.clientY - rect.top - pan.y) / zoom;
        const next = { ...dragState, currentX: worldX, currentY: worldY };
        setDragState(next);
        setSelectionBox(next);
        return;
      }
      const dx = colToX(xToCol((event.clientX - dragState.startX) / zoom));
      const dy = rowToY(yToRow((event.clientY - dragState.startY) / zoom));
      if (dx !== 0 || dy !== 0) {
        dragState.hasMoved = true;
      }
      setLayoutDraft((prev) => ({
        ...prev,
        seats: (prev.seats || []).map((s) => {
          const code = String(s.code || "").toUpperCase();
          const target = dragState.originPositions.find((p) => p.code === code);
          if (!target) return s;
          return {
            ...s,
            x: Math.min(canvasSize.width - SEAT_W, Math.max(0, target.x + dx)),
            y: Math.min(canvasSize.height - SEAT_H, Math.max(0, target.y + dy))
          };
        })
      }));
    };
    const onUp = () => {
      if (dragState.type === "box") {
        const minX = Math.min(dragState.startX, dragState.currentX);
        const maxX = Math.max(dragState.startX, dragState.currentX);
        const minY = Math.min(dragState.startY, dragState.currentY);
        const maxY = Math.max(dragState.startY, dragState.currentY);
        const nextSelected = new Set(
          (layoutDraft.seats || [])
            .filter((s) => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
            .map((s) => String(s.code || "").toUpperCase())
        );
        setSelectedCodes(nextSelected);
        setSelectionBox(null);
      }
      if (dragState.type === "move" && dragState.hasMoved) {
        setUndoStack((prev) => [...prev.slice(-39), JSON.parse(JSON.stringify(dragState.originalSeats))]);
        setRedoStack([]);
      }
      setDragState(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, canvasSize.width, canvasSize.height, zoom, pan.x, pan.y, layoutDraft.seats]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "SELECT" ||
        document.activeElement.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        setSpacePressed(true);
        e.preventDefault();
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }

      // Clipboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedCodes.size > 0) {
          e.preventDefault();
          copySelected();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (clipboard.length > 0) {
          e.preventDefault();
          pasteClipboard();
        }
      }

      // Delete/Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedCodes.size > 0) {
          e.preventDefault();
          const targets = new Set(selectedCodes);
          updateSeats((seats) =>
            seats.filter((s) => !targets.has(String(s.code || "").toUpperCase()))
          );
          setSelectedCodes(new Set());
        }
      }

      // Fast Apply Type Shortcuts
      if (selectedCodes.size > 0) {
        let typeToApply = null;
        if (e.key === "1") typeToApply = "standard";
        if (e.key === "2") typeToApply = "vip";
        if (e.key === "3") typeToApply = "couple";
        if (e.key === "4") typeToApply = "aisle";

        if (typeToApply) {
          e.preventDefault();
          applyTypeDirectly(typeToApply);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedCodes, clipboard, layoutDraft.seats, rows, pasteCount]);

  function copySelected() {
    const selected = (layoutDraft.seats || []).filter((s) =>
      selectedCodes.has(String(s.code || "").toUpperCase())
    );
    if (!selected.length) return;
    const minX = Math.min(...selected.map((s) => s.x));
    const minY = Math.min(...selected.map((s) => s.y));
    setClipboard(selected.map((s) => ({ ...s, x: s.x - minX, y: s.y - minY })));
    setPasteCount(0);
  }

  function pasteClipboard() {
    if (!clipboard.length) return;
    updateSeats((seats) => {
      const used = new Set(seats.map((s) => String(s.code || "").toUpperCase()));
      const offsetX = (pasteCount + 1) * GRID_X;
      const offsetY = (pasteCount + 1) * GRID_Y;
      const pasted = clipboard.map((s) => {
        const row = yToRow(s.y + offsetY);
        const col = xToCol(s.x + offsetX);
        let code = codeAt(row, col, rows);
        if (used.has(code)) {
          let k = 2;
          while (used.has(`${code}_${k}`)) k += 1;
          code = `${code}_${k}`;
        }
        used.add(code);
        return {
          ...s,
          code,
          x: colToX(col),
          y: rowToY(row)
        };
      });
      return [...seats, ...pasted];
    });
    setPasteCount((c) => c + 1);
  }

  function mirrorSelectedHorizontally() {
    if (!selectedCodes.size) return;
    updateSeats((seats) => {
      const target = seats.filter((s) => selectedCodes.has(String(s.code || "").toUpperCase()));
      if (!target.length) return seats;
      const minX = Math.min(...target.map((s) => s.x));
      const maxX = Math.max(...target.map((s) => s.x));
      return seats.map((s) => {
        const code = String(s.code || "").toUpperCase();
        if (!selectedCodes.has(code)) return s;
        const mirrored = minX + maxX - s.x;
        return { ...s, x: colToX(xToCol(mirrored)) };
      });
    });
  }

  async function saveLayout() {
    setSaving(true);
    setError("");
    try {
      const theaterId = String(layoutDraft.theaterId || "").trim();
      const hallName = String(layoutDraft.hall || "").trim();
      const payload = {
        id: `${theaterId}-${hallName}`.toLowerCase().replace(/\s+/g, "-"),
        theaterId,
        theater: theaterId,
        cinema: theaterId,
        hall: hallName,
        rows,
        cols: maxCols,
        blockedSeats: String(layoutDraft.blockedSeats)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        seatPrices: {
          standard: Number(layoutDraft.seatPrices?.standard) || DEFAULT_SEAT_PRICES.standard,
          vip: Number(layoutDraft.seatPrices?.vip) || DEFAULT_SEAT_PRICES.vip,
          couple: Number(layoutDraft.seatPrices?.couple) || DEFAULT_SEAT_PRICES.couple
        },
        seats: (layoutDraft.seats || []).map((s) => ({
          code: String(s.code || "").toUpperCase(),
          x: Number(s.x) || 0,
          y: Number(s.y) || 0,
          type: String(s.type || "standard").toLowerCase(),
          enabled: Boolean(s.enabled)
        }))
      };
      if (!theaterId) {
        setLayoutDraft((prev) => ({ ...prev, theaterId: theaters[0]?.id || "" }));
        throw new Error("theaterId required");
      }
      if (!hallName) throw new Error("hall required");
      console.log("[seat-layout payload]", payload);
      await upsertAdminSeatLayout(payload);
      localStorage.removeItem(draftKey);
      navigate("/admin");
    } catch (e) {
      setError(e?.message || "Lưu layout thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="section-muted">Đang tải editor layout...</p>;

  return (
    <section className="admin-layout-page">
      <header className="admin-layout-page__head">
        <div>
          <h1>Editor bố trí ghế - {layoutDraft.hall}</h1>
          <p>Rạp: {theaters.find((t) => t.id === layoutDraft.theaterId)?.name || layoutDraft.theaterId || "--"}</p>
          <select
            value={layoutDraft.theaterId}
            onChange={(e) => setLayoutDraft((p) => ({ ...p, theaterId: e.target.value }))}
          >
            <option value="">-- chọn rạp --</option>
            {theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.name}
              </option>
            ))}
          </select>
          <p>Công cụ: chọn, thêm, xóa. Kéo cả cụm ghế bằng cách chọn nhiều hoặc dùng hộp chọn.</p>
        </div>
        <div className="admin-layout-page__actions">
          <Link to="/admin" className="btn-secondary">
            Quay lại admin
          </Link>
          <button type="button" onClick={saveLayout} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu layout"}
          </button>
        </div>
      </header>

      <div className="admin-layout-page__toolbar">
        <input
          value={layoutDraft.rows}
          onChange={(e) => setLayoutDraft((p) => ({ ...p, rows: e.target.value }))}
          placeholder="Rows: A,B,C,D..."
          title="Các hàng (cách nhau bởi dấu phẩy)"
        />
        <input
          type="number"
          min={1}
          value={layoutDraft.cols}
          onChange={(e) => setLayoutDraft((p) => ({ ...p, cols: Number(e.target.value) || 10 }))}
          placeholder="Cols"
          title="Số cột tối đa"
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", borderColor: "rgba(99, 102, 241, 0.4)", fontWeight: "bold" }}
          onClick={regenerateLayoutFromGrid}
        >
          Tạo lại từ lưới
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)", fontWeight: "bold" }}
          onClick={clearLayoutCanvas}
        >
          Xóa toàn bộ
        </button>
        
        <div style={{ width: "2px", background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />

        <button
          type="button"
          className={tool === TOOLS.SELECT ? "admin-tool-btn admin-tool-btn--active" : "admin-tool-btn"}
          onClick={() => setTool(TOOLS.SELECT)}
        >
          Select (Chọn)
        </button>
        <button
          type="button"
          className={tool === TOOLS.ADD ? "admin-tool-btn admin-tool-btn--active" : "admin-tool-btn"}
          onClick={() => setTool(TOOLS.ADD)}
        >
          Add (Thêm)
        </button>
        <select
          value={addSeatType}
          onChange={(e) => setAddSeatType(e.target.value)}
          className="admin-add-seat-type"
          title="Loại ghế khi bấm thêm mới"
        >
          <option value="standard">Standard (Thường)</option>
          <option value="vip">VIP</option>
          <option value="couple">Couple (Đôi)</option>
          <option value="aisle">Aisle (Lối đi)</option>
        </select>
        <button
          type="button"
          className={tool === TOOLS.ERASE ? "admin-tool-btn admin-tool-btn--active" : "admin-tool-btn"}
          onClick={() => setTool(TOOLS.ERASE)}
        >
          Erase (Xóa)
        </button>
        <button type="button" className="btn-secondary" onClick={fillMissingSeats}>
          Điền ghế trống
        </button>
        <button type="button" className="btn-secondary" onClick={autoRenumber}>
          Đánh số lại
        </button>
        <button type="button" className="btn-secondary" onClick={copySelected} disabled={!selectedCodes.size}>
          Copy
        </button>
        <button type="button" className="btn-secondary" onClick={pasteClipboard} disabled={!clipboard.length}>
          Paste
        </button>
        <button type="button" className="btn-secondary" onClick={mirrorSelectedHorizontally} disabled={!selectedCodes.size}>
          Mirror L/R
        </button>
        <button type="button" className="btn-secondary" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>
          Zoom-
        </button>
        <button type="button" className="btn-secondary" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
          Zoom+
        </button>
        <button type="button" className="btn-secondary" onClick={() => setPan({ x: 0, y: 0 })}>
          Reset Pan
        </button>
        <button type="button" className="btn-secondary" onClick={undo} disabled={!undoStack.length}>
          Undo
        </button>
        <button type="button" className="btn-secondary" onClick={redo} disabled={!redoStack.length}>
          Redo
        </button>
      </div>

      <div className="admin-layout-page__toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", color: "#94a3b8" }}>Giá vé:</span>
          <input
            type="number"
            min={1000}
            value={layoutDraft.seatPrices?.standard || DEFAULT_SEAT_PRICES.standard}
            onChange={(e) =>
              setLayoutDraft((p) => ({
                ...p,
                seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), standard: Number(e.target.value) || DEFAULT_SEAT_PRICES.standard }
              }))
            }
            placeholder="Giá ghế thường"
            title="Giá ghế thường"
          />
          <input
            type="number"
            min={1000}
            value={layoutDraft.seatPrices?.vip || DEFAULT_SEAT_PRICES.vip}
            onChange={(e) =>
              setLayoutDraft((p) => ({
                ...p,
                seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), vip: Number(e.target.value) || DEFAULT_SEAT_PRICES.vip }
              }))
            }
            placeholder="Giá ghế VIP"
            title="Giá ghế VIP"
          />
          <input
            type="number"
            min={1000}
            value={layoutDraft.seatPrices?.couple || DEFAULT_SEAT_PRICES.couple}
            onChange={(e) =>
              setLayoutDraft((p) => ({
                ...p,
                seatPrices: { ...(p.seatPrices || DEFAULT_SEAT_PRICES), couple: Number(e.target.value) || DEFAULT_SEAT_PRICES.couple }
              }))
            }
            placeholder="Giá ghế đôi"
            title="Giá ghế đôi"
          />
        </div>
      </div>

      <div className="admin-layout-page__workspace">
        <div
          ref={canvasRef}
          className="admin-seat-canvas"
          style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
          onClick={onCanvasClick}
          onMouseDown={onCanvasMouseDown}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => {
              const next = e.deltaY > 0 ? z - 0.1 : z + 0.1;
              return Math.max(0.6, Math.min(2, +next.toFixed(2)));
            });
          }}
        >
          <div
            className="admin-seat-layer"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left"
            }}
          >
            {(layoutDraft.seats || []).map((seat) => {
              const code = String(seat.code || "").toUpperCase();
              const selected = selectedCodes.has(code);
              const seatType = String(seat.type || "standard").toLowerCase();
              const seatImage =
                seatType === "vip"
                  ? gheVipImg
                  : seatType === "couple"
                    ? gheDoiImg
                    : seatType === "standard"
                      ? gheThuongImg
                      : null;
              
              const isAisle = seatType === "aisle";
              const opacity = seat.enabled === false ? 0.35 : 1;

              return (
                <button
                  key={code}
                  type="button"
                  className={selected ? "admin-seat--canvas-selected" : ""}
                  style={{
                    position: "absolute",
                    left: `${seat.x}px`,
                    top: `${seat.y}px`,
                    width: `${SEAT_W}px`,
                    height: `${SEAT_H}px`,
                    minWidth: `${SEAT_W}px`,
                    minHeight: `${SEAT_H}px`,
                    padding: 0,
                    border: isAisle ? "1.5px dashed rgba(255, 255, 255, 0.3)" : "none",
                    borderRadius: isAisle ? "6px" : "0",
                    outline: "none",
                    overflow: "hidden",
                    cursor: "grab",
                    userSelect: "none",
                    color: "inherit",
                    backgroundColor: isAisle ? "rgba(255, 255, 255, 0.05)" : "transparent",
                    backgroundImage: seatImage ? `url(${seatImage})` : "none",
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    opacity: opacity,
                    transition: "all 0.15s ease",
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSeatMouseDown(e, code);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <span 
                    className="admin-seat__label" 
                    style={{ 
                      position: "absolute",
                      color: isAisle ? "rgba(255, 255, 255, 0.4)" : "#fff",
                      fontWeight: isAisle ? "400" : "800",
                      fontSize: isAisle ? "8px" : "9px"
                    }}
                  >
                    {code}
                  </span>
                  {seat.enabled === false && !isAisle && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(239, 68, 68, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ef4444",
                      fontSize: "12px",
                      fontWeight: "bold",
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)"
                    }}>
                      ✕
                    </div>
                  )}
                </button>
              );
            })}
            {selectionBox ? (
              <div
                className="admin-selection-box"
                style={{
                  left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                  top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                  width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                  height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`
                }}
              />
            ) : null}
          </div>
        </div>

        <aside className="admin-seat-inspector">
          <h3>Inspector</h3>
          <p style={{ fontSize: "14px", fontWeight: "bold", color: "#2563eb" }}>{selectedCodes.size} ghế đang chọn</p>
          
          <div className="inspector-actions" style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1", textAlign: "left", paddingLeft: "12px" }}
              disabled={!selectedCodes.size}
              onClick={() => applyTypeDirectly("standard")}
            >
              Ghế Thường (Phím 1)
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#fef9c3", color: "#854d0e", borderColor: "#fef08a", textAlign: "left", paddingLeft: "12px" }}
              disabled={!selectedCodes.size}
              onClick={() => applyTypeDirectly("vip")}
            >
              Ghế VIP (Phím 2)
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca", textAlign: "left", paddingLeft: "12px" }}
              disabled={!selectedCodes.size}
              onClick={() => applyTypeDirectly("couple")}
            >
              Ghế Đôi (Phím 3)
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1", textAlign: "left", paddingLeft: "12px" }}
              disabled={!selectedCodes.size}
              onClick={() => applyTypeDirectly("aisle")}
            >
              Lối Đi / Trống (Phím 4)
            </button>
            
            <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />

            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe", fontWeight: "bold" }}
              disabled={!selectedCodes.size}
              onClick={toggleSelectedEnabled}
            >
              Bật/Tắt hoạt động (Khóa)
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca", fontWeight: "bold" }}
              disabled={!selectedCodes.size}
              onClick={() => {
                const targets = new Set(selectedCodes);
                updateSeats((seats) =>
                  seats.filter((s) => !targets.has(String(s.code || "").toUpperCase()))
                );
                setSelectedCodes(new Set());
              }}
            >
              Xóa ghế khỏi sơ đồ (Del)
            </button>
          </div>

          {selectedSeat ? (
            <div className="admin-seat-inspector__detail" style={{ marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
              <strong>Chi tiết ghế: {selectedSeat.code}</strong>
              <div style={{ display: "grid", gap: "6px", fontSize: "12px", marginTop: "8px", opacity: 0.85 }}>
                <span>Vị trí: Hàng {yToRow(selectedSeat.y) + 1}, Cột {xToCol(selectedSeat.x) + 1}</span>
                <span>Tọa độ: X={selectedSeat.x}, Y={selectedSeat.y}</span>
                <span>Kiểu ghế: <span style={{ textTransform: "capitalize", fontWeight: "bold", color: "#2563eb" }}>{selectedSeat.type}</span></span>
                <span>Trạng thái: <span style={{ color: selectedSeat.enabled ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>{selectedSeat.enabled ? "Hoạt động" : "Bị khóa"}</span></span>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="admin-layout-page__shortcuts-guide" style={{
        marginTop: "24px",
        padding: "16px 20px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        color: "#64748b",
        fontSize: "13px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
      }}>
        <h4 style={{ color: "#0f172a", marginTop: 0, marginBottom: "10px", fontWeight: "700" }}>Bảng hướng dẫn phím tắt nhanh (Figma-style)</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>1</kbd> Ghế Thường</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>2</kbd> Ghế VIP</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>3</kbd> Ghế Đôi</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>4</kbd> Lối đi / Trống (Aisle)</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>Del / Backspace</kbd> Xóa ghế được chọn</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>Space + Kéo chuột</kbd> Pan di chuyển canvas</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>Ctrl + C / V</kbd> Sao chép / Dán cụm ghế</div>
          <div><kbd style={{ background: "#f1f5f9", color: "#0f172a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px", border: "1px solid #cbd5e1" }}>Ctrl + Z / Y</kbd> Hoàn tác / Làm lại</div>
        </div>
      </div>

      {error ? <p className="book-error">{error}</p> : null}
    </section>
  );
}

