import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setDocumentTitle } from "../utils/documentTitle";

/** Ánh xạ pathname → tiêu đề tab (trừ `/movies/:id` do MovieDetailPage gán theo tên phim). */
const STATIC_TITLES = {
  "/": "Trang chủ",
  "/about": "Giới thiệu",
  "/movies": "Phim đang chiếu",
  "/genres": "Thể loại",
  "/showtimes": "Lịch chiếu",
  "/booking": "Đặt chỗ",
  "/promotions": "Khuyến mãi",
  "/news": "Tin tức",
  "/contact": "Hỗ trợ khách hàng",
  "/profile": "Hồ sơ",
  "/login": "Đăng nhập",
  "/book/seats": "Chọn ghế",
  "/book/payment": "Thanh toán",
  "/book/payment/return": "Hoàn tất thanh toán",
  "/book/ticket": "Vé điện tử",
};

export default function RouteTitleSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (/^\/movies\/[^/]+$/.test(pathname)) {
      setDocumentTitle("Chi tiết phim");
      return;
    }
    const key = pathname.split("?")[0];
    setDocumentTitle(STATIC_TITLES[key] || "Đặt vé online");
  }, [pathname]);

  return null;
}
