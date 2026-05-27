import { useMemo } from "react";
import { useTheater } from "../../context/TheaterContext";

const FALLBACK_THEATERS = [
  {
    id: "hanoi",
    name: "Bloop Cinema Hà Nội",
    city: "Hà Nội",
    address: "Hoàng Gia Plaza, Tây Hồ",
    openingHours: "09:00 - 23:30",
    rooms: "6 phòng chiếu",
    capacity: "900 ghế",
    description: "Rạp hiện đại với nhiều phòng chiếu và dịch vụ tiện ích.",
    image: "/news-carousel-1.jpg",
    highlights: ["Phòng chiếu chuẩn Hollywood", "Âm thanh sống động", "Ghế ngồi thoải mái"],
    movies: [],
  },
  {
    id: "danang",
    name: "Bloop Cinema Đà Nẵng",
    city: "Đà Nẵng",
    address: "Sân bay Đà Nẵng, Quận Sơn Trà",
    openingHours: "10:00 - 23:00",
    rooms: "5 phòng chiếu",
    capacity: "760 ghế",
    description: "Rạp ven biển với không gian sang trọng và dịch vụ nhanh gọn.",
    image: "/news-carousel-2.jpg",
    highlights: ["Combo ăn uống tiện lợi", "Khu lounge chờ hiện đại", "Bố trí chỗ ngồi thoải mái"],
    movies: [],
  },
  {
    id: "hcm",
    name: "Bloop Cinema TP HCM",
    city: "TP HCM",
    address: "Quận 1, Trung tâm thương mại Sài Gòn",
    openingHours: "09:30 - 22:30",
    rooms: "7 phòng chiếu",
    capacity: "980 ghế",
    description: "Rạp trung tâm sôi động với nhiều suất chiếu đa dạng.",
    image: "/news-carousel-3.jpg",
    highlights: ["Nhiều suất chiếu linh hoạt", "Đặt vé online nhanh chóng", "Khuyến mãi hấp dẫn"],
    movies: [],
  },
];

export default function TheatersPage() {
  const { selectedTheater } = useTheater();
  const theater = useMemo(
    () => FALLBACK_THEATERS.find((item) => item.id === selectedTheater?.id) || FALLBACK_THEATERS[0],
    [selectedTheater?.id],
  );

  return (
    <section className="theaters-page">
      <div className="theaters-panel">
        <div className="theaters-card-layout">
          <div className="theaters-image-panel">
            <img src={theater.image} alt={theater.name} />
          </div>
          <div className="theaters-content-panel">
            <span className="section-eyebrow">Rạp chiếu</span>
            <h1>{theater.name}</h1>
            <p className="theaters-panel-description">{theater.description}</p>

            <div className="theaters-select-box">
              <label htmlFor="theater-select">Rạp hiện tại</label>
              <select id="theater-select" value={theater.id} disabled>
                <option value={theater.id}>{theater.name}</option>
              </select>
            </div>

            <div className="theaters-details-grid">
              <div className="theaters-detail-card">
                <h2>Thông tin rạp</h2>
                <dl>
                  <div><dt>Thành phố</dt><dd>{theater.city}</dd></div>
                  <div><dt>Địa chỉ</dt><dd>{theater.address}</dd></div>
                  <div><dt>Giờ mở cửa</dt><dd>{theater.openingHours}</dd></div>
                  <div><dt>Phòng chiếu</dt><dd>{theater.rooms}</dd></div>
                  <div><dt>Sức chứa</dt><dd>{theater.capacity}</dd></div>
                </dl>
              </div>
              <div className="theaters-detail-card theaters-detail-card--highlight">
                <h2>Điểm nổi bật</h2>
                <ul>
                  {theater.highlights.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
