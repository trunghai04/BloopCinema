import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login as apiLogin } from "../../api/client";
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
      const { token } = await apiLogin(email.trim(), password);
      login(email.trim(), token);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2 className="section-title">Đăng nhập</h2>
      <p className="section-muted">
        Nhập email và mật khẩu (demo: mật khẩu bất kỳ, auth trả token giả lập).
      </p>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          required
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error ? <p style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Đang xử lý…" : "Đăng nhập"}
        </button>
      </form>
      <p className="section-muted">
        <Link to="/movies" className="cta-link">
          ← Quay lại danh sách phim
        </Link>
      </p>
    </section>
  );
}

