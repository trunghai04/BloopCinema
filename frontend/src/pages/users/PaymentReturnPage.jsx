import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmStripeCheckoutSession } from "../../api/client";

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id") || "";

  const [message, setMessage] = useState("Đang xác nhận thanh toán…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setFailed(true);
      setMessage("Thiếu thông tin phiên thanh toán (session_id).");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await confirmStripeCheckoutSession(sessionId);
        if (cancelled) return;
        navigate(`/book/ticket?holdId=${encodeURIComponent(res.id)}`, {
          replace: true
        });
      } catch (e) {
        if (cancelled) return;
        setFailed(true);
        setMessage(e.message || "Xác nhận thanh toán thất bại.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  return (
    <section>
      <h2 className="section-title">Hoàn tất thanh toán</h2>
      <p className={failed ? "book-error" : "section-muted"}>{message}</p>
      {failed ? (
        <p>
          <Link to="/movies" className="cta-link">
            Về trang phim
          </Link>
        </p>
      ) : null}
    </section>
  );
}

