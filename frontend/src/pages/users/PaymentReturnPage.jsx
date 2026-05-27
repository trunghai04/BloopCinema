import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, confirmStripeCheckoutSession } from "../../api/client";

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id") || params.get("sessionId") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("Thiếu mã phiên Stripe.");
      setLoading(false);
      return;
    }
    confirmStripeCheckoutSession(sessionId)
      .then((res) => {
        if (res?.status === "paid") {
          navigate(`/book/ticket?holdId=${encodeURIComponent(res.id || res.holdId || "")}`, {
            replace: true
          });
          return;
        }
        setError("Thanh toán chưa hoàn tất.");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : err?.message || "Không xác nhận được thanh toán.");
      })
      .finally(() => setLoading(false));
  }, [navigate, sessionId]);

  if (loading) {
    return <p className="section-muted">Đang xác nhận thanh toán Stripe…</p>;
  }

  return (
    <section>
      <h2 className="section-title">Xác nhận thanh toán</h2>
      {error ? <p className="book-error">{error}</p> : null}
      <p>
        <Link to="/movies" className="cta-link">
          Về trang phim
        </Link>
      </p>
    </section>
  );
}
