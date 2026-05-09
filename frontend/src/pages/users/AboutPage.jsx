export default function AboutPage() {
  return (
    <section>
      <h2 className="section-title">Giới thiệu</h2>
      <p className="section-muted">
        Bloop Cinema là mô hình rạp chiếu hiện đại, tối ưu trải nghiệm đặt vé
        online và checkout tại kiosk.
      </p>
      <div className="grid">
        <article className="item-card">
          <h3 className="item-title">Vision</h3>
          <p>Xây trải nghiệm đặt vé online nhanh như thương mại điện tử.</p>
        </article>
        <article className="item-card">
          <h3 className="item-title">Ops</h3>
          <p>
            Hệ thống backend tách microservice để scale độc lập theo tải.
          </p>
        </article>
      </div>
    </section>
  );
}

