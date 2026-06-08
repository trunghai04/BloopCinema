import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function AdminLoginPage() {
  const { login, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    if (isLoggedIn && user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [isLoggedIn, user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { token } = await adminLogin(normalizedEmail, password);
      // Gán role admin cho profile
      login(normalizedEmail, token, { role: "admin" });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Đăng nhập Admin thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <span className="admin-login-logo__badge">Bloop Console</span>
          <h2>Hệ Thống Quản Trị</h2>
          <p>Đăng nhập bằng tài khoản Quản trị viên</p>
        </div>

        <form onSubmit={onSubmit} className="admin-login-form">
          <label>
            <span>Email Admin</span>
            <input
              type="email"
              required
              placeholder="admin@bloop.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={loading}
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
              disabled={loading}
            />
          </label>

          {error ? <p className="admin-login-error">{error}</p> : null}

          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
          </button>
        </form>

        <div className="admin-login-footer">
          <Link to="/" className="admin-login-backlink">
            ← Quay lại trang chủ khách hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
