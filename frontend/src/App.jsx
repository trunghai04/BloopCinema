
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getProfile, getUserOrders } from "./api/client";
import {
  AboutPage,
  BookingPage,
  ContactPage,
  GenresPage,
  HomePage,
  LoginPage,
  MovieDetailPage,
  RegisterPage,
  MoviesPage,
  NewsDetailPage,
  NewsPage,
  PaymentPage,
  PaymentReturnPage,
  ProfilePage,
  ProfileOrdersPage,
  PromotionsPage,
  SeatSelectPage,
  ShowtimesPage,
  TicketPage,
} from "./pages/users";
import {
  AdminMovieFormPage,
  AdminPage,
  AdminSeatLayoutEditorPage,
  AdminShowtimeFormPage,
  AdminLoginPage,
} from "./pages/admin";
import { useAuth } from "./context/AuthContext";
import RouteTitleSync from "./components/RouteTitleSync";
import logo from "./assets/logo_rounded.png";
import { TheaterProvider, useTheater } from "./context/TheaterContext";

const navLinks = [
  ["/showtimes", "LỊCH CHIẾU"],
  ["/movies", "PHIM"],
  ["/genres", "THỂ LOẠI"],
  ["/promotions", "KHUYẾN MÃI"],
  ["/news", "TIN TỨC"],
  ["/contact", "HỖ TRỢ KHÁCH HÀNG"],
  ["/about", "GIỚI THIỆU"],
];


function BetaUtilityBar() {
  const { user, isLoggedIn, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const seed = encodeURIComponent(user?.email || "guest");

  useEffect(() => {
    if (!isLoggedIn) {
      setOpen(false);
      setProfile(null);
      setOrders([]);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn || !user?.email) return undefined;
    getProfile(user.email)
      .then((data) => {
        if (alive) setProfile(data);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, user?.email]);

  useEffect(() => {
    let alive = true;
    if (!isLoggedIn || !user?.email) return undefined;
    getUserOrders(user.email)
      .then((data) => {
        if (alive) setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setOrders([]);
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, user?.email]);

  const displayName = profile?.name || user?.name || user?.email?.split("@")[0] || "Khách";
  const bcoins = useMemo(() => profile?.bcoins ?? user?.bcoins ?? 0, [profile?.bcoins, user?.bcoins]);
  const latestOrders = useMemo(() => orders.slice(0, 3), [orders]);

  return (
    <div className="beta-utility-bar">
      <div className="beta-utility-inner">
        <div className="beta-utility-auth beta-utility-auth--profile">
          {!isLoggedIn ? (
            <>
              <NavLink to="/login">Đăng nhập</NavLink>
              <span className="beta-util-sep">|</span>
              <NavLink to="/register">Đăng ký</NavLink>
            </>
          ) : (
            <div className="beta-profile-trigger" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
              <NavLink to="/profile" className="beta-profile-trigger__email">
                Xin Chào: {displayName}
              </NavLink>
              <div className={open ? "beta-profile-popover beta-profile-popover--open" : "beta-profile-popover"} role="dialog" aria-label="Thông tin tài khoản">
                <div className="beta-profile-popover__header">
                  <img
                    className="beta-profile-popover__avatar"
                    src={`https://api.dicebear.com/9.x/glass/svg?seed=${seed}`}
                    alt=""
                  />
                  <div>
                  <strong>{displayName}</strong>
                  <div className="beta-profile-popover__email">{profile?.email || user.email}</div>
                  </div>
                </div>
                <div className="beta-profile-popover__links beta-profile-popover__links--simple">
                  <NavLink to="/profile">Thông tin cá nhân</NavLink>
                  <NavLink to="/profile/orders">Lịch sử đơn mua</NavLink>
                </div>
                <button type="button" className="beta-profile-popover__logout" onClick={logout}>
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
        <span className="beta-utility-lang">VI</span>
      </div>
    </div>
  );
}

function BetaMainNav() {
  const { selectedTheater, setSelectedTheaterId, theaters } = useTheater();
  return (
    <header className="beta-main-header">
      <div className="beta-header-inner">
        <NavLink to="/" className="beta-brand">
          <img src={logo} alt="" className="beta-brand-logo" />
          <span className="beta-brand-text">
            Bloop <strong>Cinemas</strong>
          </span>
        </NavLink>

        <div className="beta-location" title={selectedTheater?.name || "Rạp chọn"}>
          <div className="beta-location-title">Chọn rạp</div>
          <select
            className="beta-location-select"
            value={selectedTheater?.id || ""}
            onChange={(event) => setSelectedTheaterId(event.target.value)}
          >
            {theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.name}
              </option>
            ))}
          </select>
          <div className="beta-location-desc">
            {selectedTheater?.city ? `${selectedTheater.city}` : selectedTheater?.description || ""}
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
  const { user, isLoggedIn } = useAuth();
  const isAdmin = isLoggedIn && user?.role === "admin";

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isAdminHost =
    host === "admin.cinema.bloop.io.vn" ||
    host.startsWith("admin.") ||
    path.startsWith("/admin");

  if (isAdminHost) {
    if (!isAdmin) {
      return (
        <div className="admin-app-shell">
          <RouteTitleSync />
          <Routes>
            <Route path="*" element={<AdminLoginPage />} />
          </Routes>
        </div>
      );
    }

    return (
      <div className="admin-app-shell">
        <RouteTitleSync />
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
      </div>
    );
  }

  return (
    <TheaterProvider>
      <div className="app-shell">
        <RouteTitleSync />
        <BetaUtilityBar />
        <BetaMainNav />
        <main className="page-card">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/movies/:movieId" element={<MovieDetailPage />} />
            <Route path="/genres" element={<GenresPage />} />
            <Route path="/showtimes" element={<ShowtimesPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:newsId" element={<NewsDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/orders" element={<ProfileOrdersPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/book/seats" element={<SeatSelectPage />} />
            <Route path="/book/payment" element={<PaymentPage />} />
            <Route
              path="/payment/checkout"
              element={<Navigate to="/book/payment" replace />}
            />
            <Route
              path="/payment/checkout/:rest"
              element={<Navigate to="/book/payment" replace />}
            />
            <Route path="/book/payment/return" element={<PaymentReturnPage />} />
            <Route path="/book/ticket" element={<TicketPage />} />
          </Routes>
        </main>
      </div>
    </TheaterProvider>
  );
}
