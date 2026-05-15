import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NEWS_ITEMS } from "./newsData";

const NEWS_CAROUSEL_IMAGES = [
  "/news-carousel-1.jpg",
  "/news-carousel-2.jpg",
  "/news-carousel-3.jpg",
  "/news-carousel-4.jpg",
];

export default function NewsPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

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

  // Auto-rotate carousel
  useEffect(() => {
    if (!isAutoPlaying) {
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % NEWS_CAROUSEL_IMAGES.length;
        console.log(`Auto-rotating to slide ${next}`);
        setProgress(0); // Reset progress
        return next;
      });
    }, 3000);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 100 / (3000 / 100), 100));
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [isAutoPlaying]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    // Reset auto-play timer when user interacts
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 1000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % NEWS_CAROUSEL_IMAGES.length);
    // Reset auto-play timer when user interacts
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 1000);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) =>
        (prev - 1 + NEWS_CAROUSEL_IMAGES.length) % NEWS_CAROUSEL_IMAGES.length,
    );
    // Reset auto-play timer when user interacts
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 1000);
  };

  return (
    <section className="news-page">
      {/* Carousel ảnh */}
      <div
        className="news-carousel"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        <div className="carousel-track">
          {NEWS_CAROUSEL_IMAGES.map((image, index) => (
            <div
              key={index}
              className={`carousel-slide ${
                index === currentSlide ? "active" : ""
              }`}
            >
              <img src={image} alt={`Tin tức ${index + 1}`} />
            </div>
          ))}
        </div>

        {/* Nút điều hướng */}
        <button className="carousel-btn carousel-btn--prev" onClick={prevSlide}>
          ‹
        </button>
        <button className="carousel-btn carousel-btn--next" onClick={nextSlide}>
          ›
        </button>

        {/* Dots chỉ báo */}
        <div className="carousel-dots">
          {NEWS_CAROUSEL_IMAGES.map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === currentSlide ? "active" : ""}`}
              onClick={() => goToSlide(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Progress bar */}
        {isAutoPlaying && (
          <div className="carousel-progress">
            <div
              className="carousel-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="news-section">
        <div className="section-head">
          <h2 className="section-title">Bài viết nổi bật</h2>
          <p className="section-muted">
            Những cập nhật không thể bỏ qua dành cho khán giả yêu phim.
          </p>
        </div>
        <div className="news-grid">
          {NEWS_ITEMS.map((item) => (
            <article key={item.id} className="news-card">
              <div className="news-card-header">
                <span>{item.date}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <Link to={`/news/${item.id}`} className="news-read-more">
                Xem chi tiết
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="news-section news-highlight-card">
        <div className="news-highlight-card__content">
          <h2>Góc review & xu hướng</h2>
          <p>
            Đón đọc những bài phân tích phim mới nhất, góc nhìn của biên tập
            viên và danh sách phim đáng xem tháng này.
          </p>
          <div className="news-actions">
            <Link to="/showtimes">Đặt vé ngay</Link>
            <Link to="/promotions" className="hero-alt-link">
              Khuyến mãi liên quan
            </Link>
          </div>
        </div>
        <div className="news-highlight-card__media">
          <img src="/news-hero.jpg" alt="Góc review và xu hướng" />
        </div>
      </div>
    </section>
  );
}
