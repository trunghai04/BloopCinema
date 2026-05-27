import { useMemo, useState } from "react";

const TABS = [
  "Câu hỏi thường gặp",
  "Thông báo",
  "Liên hệ CSKH",
  "Mua vé nhóm",
  "Hướng dẫn về tài sản bị mất",
];

const CATEGORIES = [
  { label: "Tất cả", count: 5 },
  { label: "Rạp chiếu phim", count: 4 },
  { label: "Điểm", count: 0 },
  { label: "Tư cách thành viên", count: 1 },
  { label: "Trực tuyến", count: 0 },
  { label: "Liên kết thẻ", count: 0 },
];

const FAQ_ITEMS = [
  {
    category: "Rạp chiếu phim",
    title: "Làm thế nào để chọn ghế khi mua vé?",
    description:
      "Bạn có thể chọn ghế ngay trên trang đặt vé. Chọn ghế có màu xanh dương và xác nhận đặt chỗ.",
  },
  {
    category: "Rạp chiếu phim",
    title: "Thời gian mở cửa của rạp là bao nhiêu?",
    description:
      "Thông tin giờ chiếu hiển thị trên trang chi tiết phim và trang rạp. Vui lòng đến trước 15 phút.",
  },
  {
    category: "Tư cách thành viên",
    title: "Làm sao để nâng cấp thành viên VIP?",
    description:
      "Bạn có thể nâng cấp thành viên trong trang cá nhân nếu đủ điểm tích lũy.",
  },
  {
    category: "Thông báo",
    title: "Có chương trình khuyến mãi vào cuối tuần không?",
    description:
      "Xin vui lòng kiểm tra trang Khuyến mãi hoặc thông báo mới nhất trên ứng dụng.",
  },
  {
    category: "Liên hệ CSKH",
    title: "Làm thế nào để liên hệ bộ phận chăm sóc khách hàng?",
    description:
      "Bạn có thể liên hệ qua hotline 1900-2026 hoặc gửi email đến support@bloopcinema.vn.",
  },
];

const QUICK_ACTIONS = [
  {
    title: "Chat với CSKH",
    description: "Nhận trợ giúp nhanh trong vòng 5 phút.",
  },
  {
    title: "Gửi yêu cầu",
    description: "Gửi yêu cầu xử lý về vé, thanh toán hoặc hoàn tiền.",
  },
  {
    title: "Trang khuyến mãi",
    description: "Xem ưu đãi mới nhất và mã giảm giá.",
  },
];

const TAB_DESCRIPTIONS = {
  "Câu hỏi thường gặp":
    "Tìm câu trả lời nhanh cho những vấn đề phổ biến nhất khi đặt vé và sử dụng tài khoản.",
  "Thông báo":
    "Nhận diện các cập nhật hệ thống, khuyến mãi và thay đổi thời gian chiếu.",
  "Liên hệ CSKH":
    "Chúng tôi luôn sẵn sàng hỗ trợ qua hotline, email và chat trực tuyến.",
  "Mua vé nhóm":
    "Tìm hiểu ưu đãi mua vé nhóm, đặt chỗ số lượng lớn và quy trình thanh toán.",
  "Hướng dẫn về tài sản bị mất":
    "Hướng dẫn bước xử lý khi bạn mất vé, phiếu quà tặng hoặc vật dụng trong rạp.",
};

export default function ContactPage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].label);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory =
        activeCategory === "Tất cả" || item.category === activeCategory;
      const matchesTab =
        activeTab === "Câu hỏi thường gặp" ||
        item.category === activeTab ||
        (activeTab === "Liên hệ CSKH" && item.category === "Liên hệ CSKH") ||
        (activeTab === "Thông báo" && item.category === "Thông báo") ||
        (activeTab === "Mua vé nhóm" && item.category === "Rạp chiếu phim") ||
        (activeTab === "Hướng dẫn về tài sản bị mất" &&
          item.category === "Rạp chiếu phim");
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);
      return matchesCategory && matchesTab && matchesQuery;
    });
  }, [activeCategory, activeTab, searchQuery]);

  const displayedTopics = useMemo(
    () =>
      FAQ_ITEMS.filter(
        (item) =>
          item.category === activeTab || activeTab === "Câu hỏi thường gặp",
      ).slice(0, 3),
    [activeTab],
  );

  return (
    <section className="support-page">
      <h2 className="section-title">Hỗ trợ khách hàng</h2>

      <div className="support-content">
        <div className="support-banner">
          <div className="support-banner-main">
            <div className="support-banner-label">HOTLINE &amp; HỖ TRỢ</div>
            <h3>Hãy để chúng tôi xử lý mọi thắc mắc của bạn ngay hôm nay</h3>
            <p>
              Tìm trang hướng dẫn, yêu cầu hỗ trợ, thanh toán và cập nhật khuyến
              mãi nhanh chóng với dịch vụ chăm sóc khách hàng của Lotte Cinema.
            </p>
            <div className="support-banner-actions">
              <button type="button">Liên hệ ngay</button>
              <a href="#support-search" className="support-banner-link">
                Tìm câu trả lời
              </a>
            </div>
          </div>
          <div className="support-banner-side">
            <div className="support-banner-stat">
              <strong>1900-2026</strong>
              <span>Hotline hỗ trợ 24/7</span>
            </div>
            <div className="support-banner-stat">
              <strong>5 phút</strong>
              <span>Thời gian phản hồi trung bình</span>
            </div>
          </div>
        </div>

        <div className="support-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <div key={action.title} className="support-action-card">
              <h4>{action.title}</h4>
              <p>{action.description}</p>
            </div>
          ))}
        </div>

        <div className="support-panel">
          <div className="support-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`support-tab ${tab === activeTab ? "support-tab--active" : ""}`}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchSubmitted(false);
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="support-tab-description">
            {TAB_DESCRIPTIONS[activeTab]}
          </div>

          <div className="support-category-row">
            {CATEGORIES.map((category) => (
              <span
                key={category.label}
                className={`support-category ${category.label === activeCategory ? "support-category--active" : ""}`}
                onClick={() => setActiveCategory(category.label)}
              >
                {category.label} ({category.count})
              </span>
            ))}
          </div>

          <div className="support-search-row" id="support-search">
            <div className="support-search-label">Tìm kiếm</div>
            <div className="support-search-input-row">
              <input
                type="text"
                className="support-search-input"
                placeholder="Vui lòng nhập cụm từ tìm kiếm."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSearchSubmitted(true);
                  }
                }}
              />
              <button
                type="button"
                className="support-search-button"
                onClick={() => setSearchSubmitted(true)}
              >
                Tìm kiếm
              </button>
            </div>
          </div>

          <div className="support-topics">
            <h4>Gợi ý nhanh</h4>
            <div className="support-topic-cards">
              {displayedTopics.map((item) => (
                <div key={item.title} className="support-topic-card">
                  <span>{item.category}</span>
                  <h5>{item.title}</h5>
                </div>
              ))}
            </div>
          </div>

          {activeTab === "Hướng dẫn về tài sản bị mất" && (
            <div className="support-lost-guide">
              <div className="support-lost-header">
                <h4>Hướng dẫn xử lý tài sản bị mất</h4>
                <p>
                  Nếu bạn làm mất vé, phiếu quà tặng hoặc vật dụng trong rạp,
                  hãy làm theo các bước sau để chúng tôi hỗ trợ nhanh nhất.
                </p>
              </div>
              <ol className="support-lost-steps">
                <li>
                  Xác định loại tài sản bị mất: vé giấy, mã QR, phiếu quà tặng
                  hoặc vật dụng cá nhân.
                </li>
                <li>
                  Ghi lại thông tin: tên phim, suất chiếu, số ghế, thời gian và
                  rạp bạn đã đến.
                </li>
                <li>
                  Liên hệ CSKH ngay qua hotline 1900-2026 hoặc email
                  support@bloopcinema.vn.
                </li>
                <li>
                  Cung cấp mã đặt vé, số điện thoại, email và ảnh màn hình nếu
                  có để dễ kiểm tra.
                </li>
                <li>
                  Nhân viên sẽ hỗ trợ xác minh và hướng dẫn bạn nhận lại vé hoặc
                  đề xuất phương án hoàn tiền.
                </li>
              </ol>
              <div className="support-lost-note">
                Lưu ý: Nếu vật dụng đã bị mất trong khu vực rạp, hãy báo ngay
                cho nhân viên quầy vé để kiểm tra kho đồ thất lạc.
              </div>
            </div>
          )}

          <div className="support-results">
            {searchSubmitted ? (
              filteredItems.length ? (
                filteredItems.map((item) => (
                  <article key={item.title} className="support-result-card">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                ))
              ) : (
                <div className="support-no-results">
                  Không tìm thấy kết quả phù hợp. Vui lòng thử lại với từ khóa
                  khác.
                </div>
              )
            ) : (
              <div className="support-intro-text">
                Chọn tab hoặc danh mục để lọc nội dung, sau đó nhấp "Tìm kiếm"
                để xem câu trả lời nhanh.
              </div>
            )}
          </div>

          <div className="support-footer">
            <p>
              Nếu bạn có bất kỳ câu hỏi nào khác, hoặc muốn xem những gì bạn đã
              hỏi và câu trả lời?
            </p>
            <div className="support-footer-links">
              <a href="/contact">Liên hệ CSKH</a>
              <a href="#">Chi tiết lịch sử yêu cầu của tôi</a>
            </div>
          </div>
        </div>

        <div className="support-image-section">
          <img src="/support-banner.jpg" alt="Bloop Cinema Support" />
        </div>

        <footer className="support-page-footer">
          <div className="support-contact-card support-contact-card--footer">
            <p>Hotline: 1900-2026</p>
            <p>Email: support@bloopcinema.vn</p>
            <p>Địa chỉ: 120 Trần Duy Hưng, Cầu Giấy, Hà Nội</p>
          </div>
        </footer>
      </div>
    </section>
  );
}
