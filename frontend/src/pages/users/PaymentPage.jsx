import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ApiError,
  createStripeCheckoutSession,
  getReservationDetail,
  getStripePaymentStatus,
  payReservation
} from "../../api/client";

export default function PaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const holdId = params.get("holdId") || "";

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [stripeStatusLoaded, setStripeStatusLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const redirectedPaid = useRef(false);
  const redirectedExpired = useRef(false);

  const load = useCallback(async () => {
    if (!holdId) return;
    setLoading(true);
    setError("");
    try {
      const d = await getReservationDetail(holdId);
      setDetail(d);
    } catch {
      setError("Không tìm thấy phiên giữ ghế.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getStripePaymentStatus()
      .then((s) => setStripeConfigured(Boolean(s?.stripeConfigured)))
      .catch(() => setStripeConfigured(false))
      .finally(() => setStripeStatusLoaded(true));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!detail || detail.state !== "paid" || redirectedPaid.current) return;
    redirectedPaid.current = true;
    navigate(`/book/ticket?holdId=${encodeURIComponent(holdId)}`, {
      replace: true
    });
  }, [detail, holdId, navigate]);

  const expiresMs = detail?.holdExpiresAt
    ? new Date(detail.holdExpiresAt).getTime()
    : 0;
  const remainingSec =
    expiresMs > now ? Math.max(0, Math.floor((expiresMs - now) / 1000)) : 0;
  const expired = remainingSec === 0 && Date.now() > expiresMs;

  useEffect(() => {
    if (!detail || detail.state === "paid" || !expired || redirectedExpired.current) return;
    redirectedExpired.current = true;
    navigate("/", { replace: true });
  }, [detail, expired, navigate]);

  async function startStripeCheckout() {
    if (!holdId) return;
    setPaying(true);
    setPayError("");
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/book/payment/return?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/book/payment?holdId=${encodeURIComponent(holdId)}`;
      const { url } = await createStripeCheckoutSession({
        holdId,
        successUrl,
        cancelUrl
      });
      window.location.href = url;
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e?.message || "Không mở được Stripe.";
      setPayError(msg);
    } finally {
      setPaying(false);
    }
  }

  async function payDemo(success) {
    if (!holdId) return;
    setPaying(true);
    setPayError("");
    try {
      const out = await payReservation({ holdId, success });
      if (success && out.state === "paid") {
        navigate(`/book/ticket?holdId=${encodeURIComponent(holdId)}`, {
          replace: true
        });
        return;
      }
      if (!success) {
        setPayError(
          "Thanh toán thất bại (demo). Ghế vẫn bị giữ trong thời gian còn lại của phiên, sau đó hệ thống nhả ghế."
        );
        setDetail(out);
      }
    } catch (err) {
      setPayError(err.message || "Giao dịch lỗi.");
      await load();
    } finally {
      setPaying(false);
    }
  }

  const showDevDemo =
    import.meta.env.DEV && stripeStatusLoaded && !stripeConfigured;
  const movieBackLink = detail?.movieId ? `/movies/${detail.movieId}` : "/movies";

  if (!holdId) {
    return (
      <section>
        <p className="section-muted">Thiếu mã giữ chỗ.</p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="section-muted">Đang tải…</p>;
  }

  if (error || !detail) {
    return (
      <section>
        <p className="book-error">{error || "Lỗi"}</p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </section>
    );
  }

  if (detail.state === "paid") {
    return <p className="section-muted">Đang chuyển đến vé…</p>;
  }

  return (
    <section>
      <h2 className="section-title">Thanh toán</h2>
      <div className="item-card">
        <p>
          <strong>Ghế:</strong> {detail.seatCodes}
        </p>
        <p>
          <strong>Email:</strong> {detail.userEmail}
        </p>
        <p>
          <strong>Trạng thái:</strong> {detail.state}
        </p>
        {expired ? (
          <p className="book-error">
            Phiên giữ ghế đã hết hạn. Vui lòng chọn lại.
          </p>
        ) : (
          <p className="section-muted">
            Thời gian giữ còn lại:{" "}
            <strong>
              {Math.floor(remainingSec / 60)}:
              {String(remainingSec % 60).padStart(2, "0")}
            </strong>
          </p>
        )}
      </div>
      {payError ? <p className="book-error">{payError}</p> : null}

      {stripeConfigured ? (
        <>
          <p className="section-muted">
            Thanh toán an toàn qua{" "}
            <strong>Stripe Checkout</strong> (thẻ test: xem{" "}
            <a
              href="https://docs.stripe.com/testing"
              target="_blank"
              rel="noreferrer"
              className="cta-link"
            >
              Stripe Testing
            </a>
            ).
          </p>
          <div className="book-actions">
            <button
              type="button"
              disabled={paying || expired}
              onClick={startStripeCheckout}
            >
              {paying ? "Đang chuyển…" : "Thanh toán bằng thẻ (Stripe)"}
            </button>
          </div>
        </>
      ) : (
        <div className="item-card payment-stripe-hint">
          <p className="section-muted" style={{ marginBottom: 8 }}>
            Backend chưa cấu hình <code>STRIPE_SECRET_KEY</code> — không thể mở
            cổng thật. Thêm key test từ Stripe Dashboard và khởi động lại{" "}
            booking-service.
          </p>
          <p className="section-muted" style={{ marginBottom: 0 }}>
            Tuỳ chọn: <code>TICKET_PRICE_PER_SEAT_VND</code> (mặc định 90000),
            <code> STRIPE_WEBHOOK_SECRET</code> cho webhook{" "}
            <code>/api/v1/reservations/stripe/webhook</code>.
          </p>
        </div>
      )}

      {showDevDemo ? (
        <>
          <p className="section-muted dev-tools-hint">
            Dev — không có Stripe: giả lập kết quả thanh toán.
          </p>
          <div className="book-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={paying || expired}
              onClick={() => payDemo(false)}
            >
              Demo: thất bại
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={paying || expired}
              onClick={() => payDemo(true)}
            >
              Demo: thành công
            </button>
          </div>
        </>
      ) : null}

      <p style={{ marginTop: 16 }}>
        <Link to={movieBackLink} className="cta-link">
          ← Hủy và về phim
        </Link>
      </p>
    </section>
  );
}

