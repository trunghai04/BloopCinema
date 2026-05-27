import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getProfile, login as apiLogin } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = params.get("redirect") || "/movies";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { token } = await apiLogin(normalizedEmail, password);
      let profile = {};
      try {
        profile = await getProfile(normalizedEmail);
      } catch {
        profile = {};
      }
      login(normalizedEmail, token, profile);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero__badge">BLOOP CINEMA</div>
        <h1>Chào mừng trở lại</h1>
        <p>
          Đăng nhập để tiếp tục đặt vé, xem lịch sử giao dịch và nhận vé điện tử ngay sau thanh toán.
        </p>
        <div className="auth-hero__stats">
          <div>
            <strong>Hỗ trợ</strong>
            <span>Thanh toán nhanh</span>
          </div>
          <div>
            <strong>Vé điện tử</strong>
            <span>Gửi qua email</span>
          </div>
        </div>
      </div>

      <div className="auth-card auth-card--glass">
        <div className="auth-card__header">
          <p className="auth-kicker">Đăng nhập</p>
          <h2>Vào tài khoản của bạn</h2>
          <p className="auth-desc">Dùng email và mật khẩu đã đăng ký.</p>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              required
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="auth-message auth-message--error">{error}</p> : null}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Đang xử lý…" : "Đăng nhập"}
          </button>
        </form>

        <div className="auth-card__footer">
          <p className="auth-switch">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
          <Link to="/movies" className="auth-backlink">
            ← Quay lại danh sách phim
          </Link>
        </div>
      </div>
    </section>
  );
}

