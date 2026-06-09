import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, verifyOtp } from "../../api/client";
import logo from "../../assets/logo_rounded.png";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
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
      const res = await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (res?.message === "otp_sent") {
        setSuccess("Mã OTP đã được gửi đến email của bạn. Vui lòng nhập mã để xác thực.");
        setShowOtp(true);
      } else {
        setSuccess("Đăng ký thành công. Đang chuyển sang trang đăng nhập...");
        setTimeout(() => navigate("/login", { replace: true }), 1200);
      }
    } catch (err) {
      setError(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (otp.length !== 6) {
      setError("Mã OTP phải có đúng 6 chữ số.");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), otp.trim());
      setSuccess("Xác thực email thành công! Đang chuyển sang trang đăng nhập...");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err.message || "Xác thực OTP thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="Bloop Cinema Logo" className="auth-brand-logo" />
          <h1 className="auth-brand-title">
            Bloop <span>Cinemas</span>
          </h1>
        </div>

        <div className="auth-card__header">
          <p className="auth-kicker">Đăng ký thành viên</p>
          <h2>Khởi tạo tài khoản</h2>
          <p className="auth-desc">Điền thông tin để tạo tài khoản mới.</p>
        </div>

        {!showOtp ? (
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
        ) : (
          <form onSubmit={onVerifyOtp} className="auth-form">
            <label>
              <span>Mã xác thực OTP (6 chữ số)</span>
              <input
                type="text"
                maxLength="6"
                pattern="\d{6}"
                required
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                style={{
                  textAlign: "center",
                  fontSize: "24px",
                  letterSpacing: "8px",
                  border: "1px solid #cbd5e1",
                  color: "var(--navy)"
                }}
              />
            </label>

            {error ? <p className="auth-message auth-message--error">{error}</p> : null}
            {success ? <p className="auth-message auth-message--success">{success}</p> : null}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Đang xác thực…" : "Xác nhận OTP"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "8px 12px", fontSize: "13px" }}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowOtp(false);
                }}
              >
                ← Quay lại
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "8px 12px", fontSize: "13px" }}
                disabled={loading}
                onClick={async () => {
                  setError("");
                  setSuccess("");
                  setLoading(true);
                  try {
                    await registerUser({
                      name: name.trim(),
                      email: email.trim().toLowerCase(),
                      password,
                    });
                    setSuccess("Đã gửi lại mã OTP mới về email của bạn.");
                  } catch (err) {
                    setError(err.message || "Gửi lại OTP thất bại.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Gửi lại mã
              </button>
            </div>
          </form>
        )}

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
