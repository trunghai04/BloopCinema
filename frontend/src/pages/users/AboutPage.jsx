import { useEffect } from "react";
import { Link } from "react-router-dom";

const ABOUT_FEATURES = [
  {
    title: "Trải nghiệm đặt vé 5 sao",
    description:
      "Giao diện đặt vé dễ dùng, hỗ trợ chọn ghế, thanh toán và xem lại đơn hàng nhanh chóng.",
  },
  {
    title: "Hỗ trợ khách hàng chuyên nghiệp",
    description:
      "Hotline 24/7 và đội ngũ tư vấn viên sẵn sàng giải đáp mọi thắc mắc về vé và dịch vụ.",
  },
  {
    title: "Công nghệ rạp hiện đại",
    description:
      "Hệ thống microservice mạnh mẽ đảm bảo vận hành ổn định với lượng truy cập lớn.",
  },
];

const ABOUT_STEPS = [
  {
    label: "Bắt đầu",
    title: "Đặt vé và chọn ghế",
    detail:
      "Chọn suất chiếu yêu thích, tìm ghế và thanh toán nhanh trong vài bước.",
  },
  {
    label: "Trải nghiệm",
    title: "Sẵn sàng đến rạp",
    detail:
      "Nhận vé điện tử hoặc lấy vé tại quầy, tận hưởng không gian chiếu phim chất lượng.",
  },
  {
    label: "Hỗ trợ",
    title: "Luôn song hành cùng bạn",
    detail:
      "Giải quyết vấn đề mất vé, đổi suất hay hoàn tiền từ đội ngũ chăm sóc khách hàng.",
  },
];

export default function AboutPage() {
  useEffect(() => {
    const sections = document.querySelectorAll(".about-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="about-page">
      <div className="about-hero about-reveal">
        <div className="about-hero-copy">
          <span className="about-eyebrow">Giới thiệu Bloop Cinema</span>
          <h1>
            Rạp chiếu hiện đại cho trải nghiệm giải trí thông minh và nhanh gọn
          </h1>
          <p>
            Chúng tôi xây dựng nền tảng đặt vé và dịch vụ rạp để người dùng có
            thể thưởng thức phim dễ dàng hơn, từ đặt vé online, lựa chọn ghế,
            đến hỗ trợ trực tiếp khi cần.
          </p>
          <div className="about-hero-buttons">
            <Link to="/showtimes">Xem lịch chiếu</Link>
            <a href="/contact">Liên hệ CSKH</a>
          </div>
        </div>
        <div className="about-hero-stats">
          <div className="about-stat-card">
            <strong>120+</strong>
            <span>Rạp liên kết khắp cả nước</span>
          </div>
          <div className="about-stat-card">
            <strong>4.9/5</strong>
            <span>Đánh giá hài lòng của khách hàng</span>
          </div>
          <div className="about-stat-card">
            <strong>20.000+</strong>
            <span>Đơn vé mỗi tháng</span>
          </div>
        </div>
      </div>

      <div className="about-section about-reveal">
        <div className="section-head">
          <h2 className="section-title">Tại sao chọn Bloop Cinema?</h2>
          <p className="section-muted">
            Chúng tôi kết hợp thiết kế đẹp, công nghệ ổn định và dịch vụ tận tâm
            để tạo ra trải nghiệm đặt vé phim mượt mà nhất.
          </p>
        </div>
        <div className="about-values-grid">
          {ABOUT_FEATURES.map((feature) => (
            <article key={feature.title} className="about-value-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="about-section about-reveal">
        <div className="section-head">
          <h2 className="section-title">Hành trình trải nghiệm</h2>
          <p className="section-muted">
            Mỗi bước trong hành trình đặt vé đều được tối ưu để bạn cảm thấy đơn
            giản, an tâm và nhanh chóng.
          </p>
        </div>
        <div className="about-story-grid">
          {ABOUT_STEPS.map((step, index) => (
            <div key={step.label} className="about-story-card">
              <span className="story-label">Bước {index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="about-section about-reveal about-commitment">
        <div>
          <h2 className="section-title">Cam kết của chúng tôi</h2>
          <p className="section-muted">
            Bloop Cinema không chỉ là đặt vé, mà còn là cam kết về chất lượng
            dịch vụ, hỗ trợ khách hàng và trải nghiệm giải trí tốt nhất.
          </p>
          <ul className="about-commitment-list">
            <li>Hỗ trợ nhanh chóng 24/7 cho mọi nhu cầu của bạn.</li>
            <li>Bảo mật thông tin và thanh toán an toàn.</li>
            <li>Liên tục cập nhật phim mới và khuyến mãi hấp dẫn.</li>
          </ul>
        </div>
        <div className="about-commitment-visual">
          <div className="about-commitment-overlay">
            <span>Feel the premium experience</span>
            <h3>Chất lượng dịch vụ</h3>
            <p>
              Cam kết mang đến trải nghiệm xem phim chuyên nghiệp, hiện đại và
              an toàn.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
