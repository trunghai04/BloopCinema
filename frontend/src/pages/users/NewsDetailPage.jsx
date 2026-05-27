import { Link, useParams } from "react-router-dom";
import { NEWS_ITEMS } from "./newsData";

export default function NewsDetailPage() {
  const { newsId } = useParams();
  const newsItem = NEWS_ITEMS.find((item) => item.id === newsId);
  const relatedNews = NEWS_ITEMS.filter((item) => item.id !== newsId).slice(0, 2);

  if (!newsItem) {
    return (
      <section className="news-detail-page">
        <div className="section-head">
          <h2 className="section-title">Tin tức không tìm thấy</h2>
          <p className="section-muted">
            Bài viết bạn đang tìm không tồn tại hoặc đã được di chuyển.
          </p>
          <Link to="/news" className="hero-alt-link">
            Quay lại trang tin tức
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="news-detail-page">
      <div
        className="page-hero page-hero--news"
        style={{ backgroundImage: `url(${newsItem.image})` }}
      >
        <div className="hero-copy">
          <span className="hero-eyebrow">Tin tức chi tiết</span>
          <h1>{newsItem.title}</h1>
          <p>{newsItem.summary}</p>
          <div className="hero-buttons">
            <Link to="/news">Quay lại tin tức</Link>
            <Link to="/showtimes" className="hero-alt-link">
              Xem lịch chiếu
            </Link>
          </div>
        </div>
      </div>

      <div className="news-section page-reveal">
        <div className="section-head">
          <h2 className="section-title">Chi tiết bài viết</h2>
          <p className="section-muted">{newsItem.date}</p>
        </div>
        <div className="news-detail-body">
          <p>{newsItem.content}</p>
          <h3>Điểm nổi bật</h3>
          <ul className="news-detail-list">
            <li>Khán giả được ưu tiên đặt vé sớm với quà tặng giới hạn.</li>
            <li>Chương trình đặc biệt bao gồm talkshow, review phim và hoạt động tương tác.</li>
            <li>Tiêu chuẩn an toàn rạp đã được nâng cấp để đảm bảo trải nghiệm tốt nhất.</li>
          </ul>
          <p>
            Đây là một bước tiến mới trong chiến lược nội dung của Bloop Cinema,
            khi chúng tôi muốn vừa mang đến trải nghiệm xem phim hấp dẫn vừa giữ
            sự an toàn và tiện lợi cho khán giả.
          </p>
          <div className="news-quote">
            <strong>“</strong> Chúng tôi cam kết mang đến những buổi chiếu phim đặc sắc,
            an toàn và đầy cảm hứng cho mọi đối tượng khán giả. <strong>”</strong>
          </div>
          <p>
            Đừng quên theo dõi trang tin tức để cập nhật thêm những bài viết mới nhất,
            ưu đãi đặt vé và sự kiện offline liên quan.
          </p>
        </div>
      </div>

      <div className="news-section page-reveal">
        <div className="section-head">
          <h2 className="section-title">Tin liên quan</h2>
          <p className="section-muted">
            Một số tin tức nổi bật bạn có thể quan tâm.
          </p>
        </div>
        <div className="news-grid">
          {relatedNews.map((item) => (
            <article key={item.id} className="news-card news-card--small">
              <img src={item.image} alt={item.title} className="news-card-image" />
              <div className="news-card-content">
                <div className="news-card-header">
                  <span>{item.date}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <Link to={`/news/${item.id}`} className="news-read-more">
                  Xem chi tiết
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
