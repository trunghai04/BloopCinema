export default function PromotionsPage() {
  return (
    <section>
      <h2 className="section-title">Khuyến mãi</h2>
      <p className="section-muted">Ưu đãi đang chạy trong tuần này.</p>
      <div className="grid">
        <article className="item-card">
          <h3 className="item-title">Combo Couple</h3>
          <p>Giảm 20% combo bắp + 2 nước cho suất sau 20:00.</p>
        </article>
        <article className="item-card">
          <h3 className="item-title">Member VIP</h3>
          <p>Tích điểm x2 cho đơn đặt vé online qua app/web.</p>
        </article>
      </div>
    </section>
  );
}

