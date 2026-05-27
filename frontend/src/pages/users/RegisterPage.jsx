import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../api/client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setSuccess("Đăng ký thành công. Đang chuyển sang trang đăng nhập...");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-hero auth-hero--register">
        <div className="auth-hero__badge">BLOOP CINEMA</div>
        <h1>Tạo tài khoản mới</h1>
        <p>
          Đăng ký để đặt vé nhanh hơn, theo dõi lịch sử mua và nhận vé điện tử qua email.
        </p>
        <div className="auth-hero__stats">
          <div>
            <strong>1 phút</strong>
            <span>Đăng ký nhanh</span>
          </div>
          <div>
            <strong>An toàn</strong>
            <span>Lưu trong hệ thống</span>
          </div>
        </div>
      </div>

      <div className="auth-card auth-card--glass">
        <div className="auth-card__header">
          <p className="auth-kicker">Đăng ký</p>
          <h2>Khởi tạo tài khoản</h2>
          <p className="auth-desc">Điền thông tin để tạo tài khoản mới.</p>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            <span>Họ và tên</span>
            <input
              type="text"
              required
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>

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
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>Xác nhận mật khẩu</span>
            <input
              type="password"
              required
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error ? <p className="auth-message auth-message--error">{error}</p> : null}
          {success ? <p className="auth-message auth-message--success">{success}</p> : null}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Đang tạo tài khoản…" : "Đăng ký"}
          </button>
        </form>

        <div className="auth-card__footer">
          <p className="auth-switch">
            Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
          </p>
          <Link to="/movies" className="auth-backlink">
            ← Quay lại danh sách phim
          </Link>
        </div>
      </div>
    </section>
  );
}
