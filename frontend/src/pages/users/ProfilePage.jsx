import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProfilePage() {
  const { user, isLoggedIn } = useAuth();

  if (!isLoggedIn || !user?.email) {
    return (
      <section>
        <h2 className="section-title">Hồ sơ người dùng</h2>
        <p className="section-muted">
          Đăng nhập để xem thông tin tài khoản và đồng bộ với luồng đặt vé.
        </p>
        <Link to="/login?redirect=/profile" className="cta-link">
          Đăng nhập
        </Link>
      </section>
    );
  }

  const seed = encodeURIComponent(user.email);

  return (
    <section>
      <h2 className="section-title">Hồ sơ người dùng</h2>
      <p className="section-muted">
        Theo dõi lịch sử đặt vé, điểm thưởng và voucher cá nhân.
      </p>
      <div className="profile-card">
        <img
          className="profile-avatar"
          src={`https://api.dicebear.com/9.x/glass/svg?seed=${seed}`}
          alt=""
        />
        <div>
          <h3 className="item-title">{user.email.split("@")[0]}</h3>
          <p className="section-muted" style={{ marginBottom: 0 }}>
            {user.email}
          </p>
        </div>
      </div>
      <div className="grid">
        <article className="item-card">
          <h3 className="item-title">Điểm thành viên</h3>
          <p>Đồng bộ đặt vé qua tài khoản hiện tại.</p>
        </article>
        <article className="item-card">
          <h3 className="item-title">Voucher khả dụng</h3>
          <p>Kiểm tra khuyến mãi tại quầy hoặc kênh online.</p>
        </article>
      </div>
    </section>
  );
}

