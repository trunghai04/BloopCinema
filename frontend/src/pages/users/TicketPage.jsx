import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { getReservationDetail } from "../../api/client";

export default function TicketPage() {
  const [params] = useSearchParams();
  const holdId = params.get("holdId") || "";

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!holdId) return;
    setLoading(true);
    setError("");
    try {
      const d = await getReservationDetail(holdId);
      setDetail(d);
      if (d.state !== "paid") {
        setError("Vé chưa được thanh toán hoặc phiên không hợp lệ.");
      }
    } catch {
      setError("Không tải được thông tin vé.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!holdId) {
    return (
      <section>
        <p className="section-muted">Thiếu mã vé.</p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="section-muted">Đang tải vé…</p>;
  }

  if (error || !detail || detail.state !== "paid") {
    return (
      <section>
        <p className="book-error">{error || "Không có vé hợp lệ."}</p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </section>
    );
  }

  const seats = detail.seatCodes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <section className="ticket-page">
      <h2 className="section-title">Hóa đơn / vé điện tử</h2>
      <div className="ticket-card item-card">
        <p>
          <strong>Mã vé:</strong> {detail.id}
        </p>
        <p>
          <strong>Ghế:</strong> {seats.join(", ")}
        </p>
        <p>
          <strong>Email:</strong> {detail.userEmail}
        </p>
        <p>
          <strong>Phim (id):</strong> {detail.movieId} · <strong>Suất:</strong>{" "}
          {detail.showtimeId}
        </p>
        <div className="ticket-qr-wrap">
          <QRCode
            value={detail.qrPayload || detail.id}
            size={200}
            bgColor="#f8fafc"
            fgColor="#0f172a"
            level="M"
          />
        </div>
        <p className="section-muted" style={{ marginBottom: 0 }}>
          Xuất mã QR khi check-in tại rạp. Dữ liệu mã khớp ghế đã thanh toán.
        </p>
      </div>
      <Link to="/movies" className="cta-link">
        ← Về trang phim
      </Link>
    </section>
  );
}

