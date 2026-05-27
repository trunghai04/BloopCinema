import { useEffect } from "react";
import { Link } from "react-router-dom";

const PROMO_DEALS = [
  {
    title: "Combo Couple",
    description: "Giảm 20% combo bắp + 2 nước cho suất sau 20:00.",
    tag: "Hot",
  },
  {
    title: "Member VIP",
    description: "Tích điểm x2 cho đơn đặt vé online qua app/web.",
    tag: "Thành viên",
  },
  {
    title: "Family Pack",
    description: "Mua 4 vé, tặng 1 vé cho trẻ em vào cuối tuần.",
    tag: "Gia đình",
  },
];

export default function PromotionsPage() {
  useEffect(() => {
    const sections = document.querySelectorAll(".page-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="promo-page">
      <div className="page-hero page-hero--promo page-reveal">
        <div className="hero-copy">
          <span className="hero-eyebrow">Ưu đãi đặc sắc</span>
          <h1>Khuyến mãi Bloop Cinema - Xem phim sang chảnh, giá nhẹ nhàng</h1>
          <p>
            Cập nhật ưu đãi mới nhất dành cho người yêu điện ảnh: combo, quà
            tặng, chương trình thành viên và suất chiếu cực kỳ hấp dẫn.
          </p>
          <div className="hero-buttons">
            <Link to="/showtimes">Xem lịch chiếu</Link>
            <Link to="/contact" className="hero-alt-link">
              Liên hệ CSKH
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <strong>3</strong>
            <span>Đề xuất ưu đãi cho bạn</span>
          </div>
          <div className="stat-card">
            <strong>20%</strong>
            <span>Giảm giá mỗi tuần</span>
          </div>
          <div className="stat-card">
            <strong>Hơn 10</strong>
            <span>Ưu đãi cho thành viên</span>
          </div>
        </div>
      </div>

      <div className="promo-section page-reveal">
        <div className="section-head">
          <h2 className="section-title">Ưu đãi nổi bật</h2>
          <p className="section-muted">
            Tất cả ưu đãi đang chạy và các chương trình dành riêng cho khách
            hàng.
          </p>
        </div>
        <div className="promo-grid">
          {PROMO_DEALS.map((deal) => (
            <article key={deal.title} className="promo-card">
              <div className="promo-tag">{deal.tag}</div>
              <h3>{deal.title}</h3>
              <p>{deal.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="promo-section page-reveal">
        <div className="promo-feature-card">
          <h2>Chương trình tài khoản VIP</h2>
          <p>
            Nâng cấp thành viên để nhận thêm voucher, ưu đãi sinh nhật và đặt vé
            với mức giá tốt hơn. Thành viên càng cao, trải nghiệm càng xịn.
          </p>
          <div className="promo-actions">
            <Link to="/contact">Tham gia ngay</Link>
            <Link to="/showtimes" className="hero-alt-link">
              Xem lịch chiếu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
