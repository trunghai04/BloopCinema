import { useState } from "react";

const THEATERS = [
  {
    id: "hanoi",
    name: "Bloop Cinema Hà Nội",
    city: "Hà Nội",
    address: "Hoàng Gia Plaza, Tây Hồ",
    openingHours: "09:00 - 23:30",
    rooms: "6 phòng chiếu",
    capacity: "900 ghế",
    description:
      "Rạp hiện đại bậc nhất với màn hình IMAX, âm thanh Dolby Atmos và hệ thống ghế đôi VIP. Thiết kế thanh lịch, tiện nghi cao cấp và dịch vụ chu đáo giúp trải nghiệm xem phim trở nên ấn tượng.",
    image: "/news-carousel-1.jpg",
    highlights: [
      "Phòng chiếu chuẩn Hollywood",
      "Âm thanh Dolby Atmos sống động",
      "Ghế VIP êm ái và nội thất sang trọng",
    ],
    movies: [
      { title: "Tạm Biệt Gohan", poster: "/news-carousel-1.jpg" },
      { title: "Thảm Mỹ Viện Ám Phủ", poster: "/news-carousel-4.jpg" },
      { title: "Người Hùng Đêm Đông", poster: "/news-carousel-2.jpg" },
      { title: "Cờ Đỏ Thành Phố", poster: "/news-carousel-1.jpg" },
      { title: "Đêm Hà Nội Sóng Sánh", poster: "/news-carousel-4.jpg" },
      { title: "Hành Trình Về Quá Khứ", poster: "/news-carousel-3.jpg" },
      { title: "Bí Mật Của Rừng Sâu", poster: "/news-carousel-2.jpg" },
      { title: "Chiến Binh Bóng Đêm", poster: "/news-carousel-1.jpg" },
    ],
  },
  {
    id: "danang",
    name: "Bloop Cinema Đà Nẵng",
    city: "Đà Nẵng",
    address: "Sân bay Đà Nẵng, Quận Sơn Trà",
    openingHours: "10:00 - 23:00",
    rooms: "5 phòng chiếu",
    capacity: "760 ghế",
    description:
      "Rạp ven biển với không gian sang trọng, phục vụ combo popcorn + nước và phòng chiếu cao cấp. View rạp thoáng đãng, phù hợp cho gia đình và nhóm bạn.",
    image: "/news-carousel-2.jpg",
    highlights: [
      "Combo ăn uống tiện lợi",
      "Khu lounge chờ hiện đại",
      "Bố trí chỗ ngồi thoải mái, tầm nhìn tốt",
    ],
    movies: [
      { title: "Biển Xanh Bừng Sáng", poster: "/news-carousel-2.jpg" },
      { title: "Ngôi Nhà Trên Cát", poster: "/news-carousel-3.jpg" },
      { title: "Đêm Hội Đảo Ngọc", poster: "/news-carousel-4.jpg" },
      { title: "Sóng Gió Ven Biển", poster: "/news-carousel-1.jpg" },
      { title: "Lưu Lạc Trong Mưa", poster: "/news-carousel-2.jpg" },
      { title: "Dưới Biển Xanh", poster: "/news-carousel-4.jpg" },
      { title: "Hòn Đảo Bí Ẩn", poster: "/news-carousel-1.jpg" },
      { title: "Gió Biển Mạnh Mẽ", poster: "/news-carousel-3.jpg" },
    ],
  },
  {
    id: "hcm",
    name: "Bloop Cinema TP HCM",
    city: "TP HCM",
    address: "Quận 1, Trung tâm thương mại Sài Gòn",
    openingHours: "09:30 - 22:30",
    rooms: "7 phòng chiếu",
    capacity: "980 ghế",
    description:
      "Rạp trung tâm sôi động, nhiều suất chiếu đa dạng và trải nghiệm đặt vé nhanh chóng. Nơi gặp gỡ lý tưởng với phong cách hiện đại và nhiều khuyến mãi hấp dẫn.",
    image: "/news-carousel-3.jpg",
    highlights: [
      "Nhiều suất chiếu linh hoạt",
      "Đặt vé online nhanh chóng",
      "Khuyến mãi hấp dẫn mỗi tuần",
    ],
    movies: [
      { title: "Sài Gòn Đêm Rực Rỡ", poster: "/news-carousel-3.jpg" },
      { title: "Bão Tố Thành Phố", poster: "/news-carousel-1.jpg" },
      { title: "Cà Phê Cuối Tuần", poster: "/news-carousel-4.jpg" },
      { title: "Nhịp Sống Sài Gòn", poster: "/news-carousel-2.jpg" },
      { title: "Ký Ức Phố Xưa", poster: "/news-carousel-3.jpg" },
      { title: "Đường Phố Sài Gòn", poster: "/news-carousel-2.jpg" },
      { title: "Cuộc Sống Đô Thị", poster: "/news-carousel-4.jpg" },
      { title: "Những Ngày Xưa", poster: "/news-carousel-1.jpg" },
    ],
  }
];

export default function TheatersPage() {
  const [selectedTheaterId, setSelectedTheaterId] = useState(THEATERS[0].id);
  const selectedTheater =
    THEATERS.find((theater) => theater.id === selectedTheaterId) || THEATERS[0];

  return (
    <section className="theaters-page">
      <div className="theaters-panel">
        <div className="theaters-card-layout">
          <div className="theaters-image-panel">
            <img src={selectedTheater.image} alt={selectedTheater.name} />
          </div>
          <div className="theaters-content-panel">
            <span className="section-eyebrow">Rạp chiếu</span>
            <h1>{selectedTheater.name}</h1>
            <p className="theaters-panel-description">
              {selectedTheater.description}
            </p>
            <div className="theaters-select-box">
              <label htmlFor="theater-select">Rạp hiện tại</label>
              <select
                id="theater-select"
                value={selectedTheaterId}
                onChange={(event) => setSelectedTheaterId(event.target.value)}
              >
                {THEATERS.map((theater) => (
                  <option key={theater.id} value={theater.id}>
                    {theater.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="theaters-details-grid">
              <div className="theaters-detail-card">
                <h2>Thông tin rạp</h2>
                <dl>
                  <div>
                    <dt>Thành phố</dt>
                    <dd>{selectedTheater.city}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{selectedTheater.address}</dd>
                  </div>
                  <div>
                    <dt>Giờ mở cửa</dt>
                    <dd>{selectedTheater.openingHours}</dd>
                  </div>
                  <div>
                    <dt>Phòng chiếu</dt>
                    <dd>{selectedTheater.rooms}</dd>
                  </div>
                  <div>
                    <dt>Sức chứa</dt>
                    <dd>{selectedTheater.capacity}</dd>
                  </div>
                </dl>
              </div>
              <div className="theaters-detail-card theaters-detail-card--highlight">
                <h2>Điểm nổi bật</h2>
                <ul>
                  {selectedTheater.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="theaters-movie-list">
              <h2>Phim hiện có tại {selectedTheater.city}</h2>
              <div className="theater-movie-cards">
                {selectedTheater.movies.map((movie) => (
                  <article key={movie.title} className="theater-movie-card">
                    <img src={movie.poster} alt={movie.title} />
                    <div>
                      <h3>{movie.title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="theaters-thumbs">
        {THEATERS.map((theater) => (
          <article key={theater.id} className="theater-thumb-card">
            <img src={theater.image} alt={theater.name} />
            <div className="theater-thumb-card-body">
              <h3>{theater.name}</h3>
              <p>{theater.city}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
