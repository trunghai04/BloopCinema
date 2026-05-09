export default function NewsPage() {
  return (
    <section>
      <h2 className="section-title">Tin tức</h2>
      <p className="section-muted">Cập nhật mới nhất từ cụm rạp Bloop.</p>
      <div className="grid">
        <article className="item-card">
          <h3 className="item-title">Tuần lễ Sci-Fi</h3>
          <p>Mở thêm 4 suất chiếu đêm cho thể loại viễn tưởng.</p>
        </article>
        <article className="item-card">
          <h3 className="item-title">Premiere Event</h3>
          <p>Đặt trước vé premiere và nhận quà lưu niệm giới hạn.</p>
        </article>
      </div>
    </section>
  );
}

