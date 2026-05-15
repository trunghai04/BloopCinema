import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  AboutPage,
  BookingPage,
  ContactPage,
  GenresPage,
  HomePage,
  LoginPage,
  MovieDetailPage,
  MoviesPage,
  NewsDetailPage,
  NewsPage,
  PaymentPage,
  PaymentReturnPage,
  ProfilePage,
  PromotionsPage,
  SeatSelectPage,
  ShowtimesPage,
  TicketPage,
  TheatersPage,
} from "./pages/users";
import {
  AdminMovieFormPage,
  AdminPage,
  AdminSeatLayoutEditorPage,
  AdminShowtimeFormPage,
} from "./pages/admin";
import { useAuth } from "./context/AuthContext";
import RouteTitleSync from "./components/RouteTitleSync";
import logo from "./assets/logo_rounded.png";

const navLinks = [
  ["/showtimes", "LỊCH CHIẾU"],
  ["/theaters", "RẠP"],
  ["/movies", "PHIM"],
  ["/genres", "THỂ LOẠI"],
  ["/promotions", "KHUYẾN MÃI"],
  ["/news", "TIN TỨC"],
  ["/contact", "HỖ TRỢ KHÁCH HÀNG"],
  ["/about", "GIỚI THIỆU"],
];

const THEATERS = [
  {
    id: "hanoi",
    name: "Bloop Cinema Hà Nội",
    city: "Hà Nội",
    description:
      "Rạp hiện đại bậc nhất với màn hình IMAX, âm thanh Dolby Atmos và ghế VIP.",
  },
  {
    id: "danang",
    name: "Bloop Cinema Đà Nẵng",
    city: "Đà Nẵng",
    description:
      "Rạp ven biển với không gian sang trọng, chất lượng phục vụ cao cấp.",
  },
  {
    id: "hcm",
    name: "Bloop Cinema TP HCM",
    city: "TP HCM",
    description:
      "Rạp trung tâm sôi động, nhiều suất chiếu đa dạng và tiện ích nhanh gọn.",
  },
];

function BetaUtilityBar() {
  const { user, isLoggedIn, logout } = useAuth();

  return (
    <div className="beta-utility-bar">
      <div className="beta-utility-inner">
        <div className="beta-utility-auth">
          {!isLoggedIn ? (
            <>
              <NavLink to="/login">Đăng nhập</NavLink>
              <span className="beta-util-sep">|</span>
              <NavLink to="/login">Đăng ký</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/profile">{user.email}</NavLink>
              <span className="beta-util-sep">|</span>
              <button type="button" className="beta-link-btn" onClick={logout}>
                Thoát
              </button>
            </>
          )}
        </div>
        <span className="beta-utility-lang">VI</span>
      </div>
    </div>
  );
}

function BetaMainNav({ selectedTheater, onSelectTheater }) {
  return (
    <header className="beta-main-header">
      <div className="beta-header-inner">
        <NavLink to="/" className="beta-brand">
          <img src={logo} alt="" className="beta-brand-logo" />
          <span className="beta-brand-text">
            Bloop <strong>Cinemas</strong>
          </span>
        </NavLink>

        <div className="beta-location" title={selectedTheater.name}>
          <div className="beta-location-title">Rạp chọn</div>
          <select
            className="beta-location-select"
            value={selectedTheater.id}
            onChange={(event) => onSelectTheater(event.target.value)}
          >
            {THEATERS.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.name}
              </option>
            ))}
          </select>
          <div className="beta-location-desc">
            {selectedTheater.description}
          </div>
        </div>

        <nav className="beta-nav" aria-label="Chính">
          {navLinks.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? "beta-nav-link beta-nav-link--active"
                  : "beta-nav-link"
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isAdminHost =
    host === "admin.cinema.bloop.io.vn" ||
    host.startsWith("admin.") ||
    path.startsWith("/admin");

  if (isAdminHost) {
    return (
      <div className="app-shell">
        <RouteTitleSync />
        <main className="page-card">
          <Routes>
            <Route path="/" element={<AdminPage />} />
            <Route path="/movies/new" element={<AdminMovieFormPage />} />
            <Route path="/movies/:movieId" element={<AdminMovieFormPage />} />
            <Route path="/showtimes/new" element={<AdminShowtimeFormPage />} />
            <Route
              path="/showtimes/:showtimeId"
              element={<AdminShowtimeFormPage />}
            />
            <Route
              path="/layouts/:hall"
              element={<AdminSeatLayoutEditorPage />}
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/movies/new" element={<AdminMovieFormPage />} />
            <Route
              path="/admin/movies/:movieId"
              element={<AdminMovieFormPage />}
            />
            <Route
              path="/admin/showtimes/new"
              element={<AdminShowtimeFormPage />}
            />
            <Route
              path="/admin/showtimes/:showtimeId"
              element={<AdminShowtimeFormPage />}
            />
            <Route
              path="/admin/layouts/:hall"
              element={<AdminSeatLayoutEditorPage />}
            />
            <Route path="*" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    );
  }

  const [selectedTheaterId, setSelectedTheaterId] = useState(THEATERS[0].id);
  const selectedTheater =
    THEATERS.find((theater) => theater.id === selectedTheaterId) || THEATERS[0];

  return (
    <div className="app-shell">
      <RouteTitleSync />
      <BetaUtilityBar />
      <BetaMainNav
        selectedTheater={selectedTheater}
        onSelectTheater={setSelectedTheaterId}
      />
      <main className="page-card">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/movies/:movieId" element={<MovieDetailPage />} />
          <Route path="/genres" element={<GenresPage />} />
          <Route path="/showtimes" element={<ShowtimesPage />} />
          <Route path="/theaters" element={<TheatersPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:newsId" element={<NewsDetailPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book/seats" element={<SeatSelectPage />} />
          <Route path="/book/payment" element={<PaymentPage />} />
          <Route path="/book/payment/return" element={<PaymentReturnPage />} />
          <Route path="/book/ticket" element={<TicketPage />} />
        </Routes>
      </main>
    </div>
  );
}
