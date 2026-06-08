package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Movie struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Genre            string `json:"genre"`
	DurationMin      int    `json:"durationMin"`
	AgeRating        string `json:"ageRating,omitempty"`
	Description      string `json:"description"`
	Synopsis         string `json:"synopsis"`
	PosterURL        string `json:"posterUrl"`
	BackdropURL      string `json:"backdropUrl"`
	TrailerYoutubeID string `json:"trailerYoutubeId"`
	Director         string `json:"director,omitempty"`
	Cast             string `json:"cast,omitempty"`
	Language         string `json:"language,omitempty"`
	PremiereDate     string `json:"premiereDate,omitempty"`
}

type Showtime struct {
	ID        string `json:"id"`
	MovieID   string `json:"movieId"`
	StartAt   string `json:"startAt"`
	Hall      string `json:"hall"`
	TheaterID string `json:"theaterId,omitempty"`
}

type Theater struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	City  string `json:"city,omitempty"`
	Code  string `json:"code,omitempty"`
	Active bool  `json:"active,omitempty"`
}

type SeatLayout struct {
	ID           string     `json:"id,omitempty"`
	TheaterID    string     `json:"theaterId,omitempty"`
	Hall         string     `json:"hall"`
	Rows         []string   `json:"rows,omitempty"`
	Cols         int        `json:"cols,omitempty"`
	Capacity     int        `json:"capacity,omitempty"`
	BlockedSeats []string   `json:"blockedSeats,omitempty"`
	Seats        []SeatNode `json:"seats,omitempty"`
	SeatPrices   SeatPrices `json:"seatPrices,omitempty"`
}

type Banner struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	ImageURL    string `json:"imageUrl"`
	Link        string `json:"link,omitempty"`
	SortOrder   int    `json:"sortOrder,omitempty"`
	Active      bool   `json:"active"`
}

type SeatPrices struct {
	Standard int `json:"standard"`
	VIP      int `json:"vip"`
	Couple   int `json:"couple"`
}

type SeatNode struct {
	Code    string `json:"code"`
	X       int    `json:"x"`
	Y       int    `json:"y"`
	Type    string `json:"type,omitempty"`
	Enabled *bool  `json:"enabled,omitempty"`
}

var movies = []Movie{
	{
		ID:               "mv001",
		Title:            "Shadow Protocol",
		Genre:            "Action",
		DurationMin:      125,
		AgeRating:        "T16",
		Description:      "Missions under a cyber-attack timeline.",
		Synopsis:         "Đội tác chiến tình báo phải xuyên qua mạng lưới hacker quốc tế để ngăn một cuộc tấn công mạng quy mô toàn cầu. Hành động dồn dập, twist kỹ thuật và truy đuổi trên không gian mạng.",
		PosterURL:        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "M7lc1UVf-VE",
		Director:         "James Chen",
		Cast:             "Alex Rider, Minh Anh, Chris Lee",
		Language:         "Tiếng Anh — phụ đề Tiếng Việt",
		PremiereDate:     "28/04/2026",
	},
	{
		ID:               "mv002",
		Title:            "Midnight Laugh",
		Genre:            "Comedy",
		DurationMin:      102,
		AgeRating:        "T13",
		Description:      "A stand-up tour gone out of control.",
		Synopsis:         "Chuyến lưu diễn hài độc thoại biến thành chuỗi sự cố không thể đoán trước khiến khán giả cười nghiêng ngả. Nhẹ nhàng, ấm áp và đầy tình người.",
		PosterURL:        "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "dQw4w9WgXcQ",
		Director:         "Quang Dũng",
		Cast:             "Thái Hòa, Võ Tấn Phát, Khả Như",
		Language:         "Tiếng Việt",
		PremiereDate:     "24/04/2026",
	},
	{
		ID:               "mv003",
		Title:            "Echoes of Summer",
		Genre:            "Romance",
		DurationMin:      115,
		AgeRating:        "T13",
		Description:      "A reunion that redefines old promises.",
		Synopsis:         "Hai người bạn thuở nhỏ tái ngộ sau nhiều năm, những ký ức mùa hè ùa về và họ phải đối diện với lời hứa cũ. Phim tình cảm nhẹ nhàng, nhịp chậm, nhiều cảnh đẹp.",
		PosterURL:        "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "L_jWHffIx5E",
		Director:         "Lê Hà Nguyên",
		Cast:             "Lan Ngọc, Trần Nghĩa",
		Language:         "Tiếng Việt — phụ đề Anh",
		PremiereDate:     "30/04/2026",
	},
	{
		ID:               "mv004",
		Title:            "Neon Circuit",
		Genre:            "Sci-Fi",
		DurationMin:      128,
		AgeRating:        "T16",
		Description:      "A rogue engineer fights an AI-controlled metropolis.",
		Synopsis:         "Kỹ sư lập trình đối đầu hệ thống AI đang kiểm soát thành phố tương lai. Pha trộn cyberpunk, phục kích và những pha rượt đuổi ánh neon.",
		PosterURL:        "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1542204625-de293a6b4178?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "9bZkp7q19f0",
		Director:         "Neo Park",
		Cast:             "Ryan Blake, Eve Ko",
		Language:         "Tiếng Anh — phụ đề Tiếng Việt",
		PremiereDate:     "02/05/2026",
	},
	{
		ID:               "mv005",
		Title:            "The Last Manor",
		Genre:            "Horror",
		DurationMin:      109,
		AgeRating:        "T18",
		Description:      "A family moves into a manor where time does not flow.",
		Synopsis:         "Gia đình chuyển vào dinh thự cổ, nơi thời gian và tiếng bước chân lạ lùng không khớp thực tại. Không khí u ám, jump-scare có chừng mực.",
		PosterURL:        "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "eOrNdBpGMv8",
		Director:         "Vân Anh Nguyễn",
		Cast:             "Kiều Minh Tuấn, Ninh Dương Lan Ngọc",
		Language:         "Tiếng Việt",
		PremiereDate:     "15/05/2026",
	},
	{
		ID:               "mv006",
		Title:            "Pixel Quest",
		Genre:            "Animation",
		DurationMin:      97,
		AgeRating:        "K",
		Description:      "Young coders travel inside a game world to save their city.",
		Synopsis:         "Nhóm thiếu niên lạc vào thế giới game để cứu thành phố khỏi virus kỹ thuật số. Màu sắc tươi, nhịp nhanh, phù hợp gia đình.",
		PosterURL:        "https://images.unsplash.com/photo-1518671782959-3ef6a9f6f4f0?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "y6120QOlsfU",
		Director:         "Kid Studio",
		Cast:             "Thu Trang, BB Trần",
		Language:         "Tiếng Việt — phụ đề Anh",
		PremiereDate:     "08/05/2026",
	},
	{
		ID:               "mv007",
		Title:            "Laugh Station",
		Genre:            "Comedy",
		DurationMin:      104,
		AgeRating:        "T13",
		Description:      "A failing radio host accidentally becomes a viral sensation.",
		Synopsis:         "MC radio sắp đóng cửa vô tình viral nhờ một pha lỡ lời. Từ đó, anh phải cân bằng danh tiếng và cuộc sống riêng.",
		PosterURL:        "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "OPf0YbXqDm0",
		Director:         "Hùng Đặng",
		Cast:             "Hoài Linh, Xuân Nghị",
		Language:         "Tiếng Việt",
		PremiereDate:     "01/05/2026",
	},
	{
		ID:               "mv008",
		Title:            "Crimson Horizon",
		Genre:            "Action",
		DurationMin:      132,
		AgeRating:        "T16",
		Description:      "Elite pilots race to stop an attack above the red horizon.",
		Synopsis:         "Phi đội tinh nhuệ chặn đợt tấn công trên bầu trời đỏ rực hoàng hôn. Dogfight, kỹ xảo và kịch bản căng thẳng từng giây.",
		PosterURL:        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=700&q=80",
		BackdropURL:      "https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=1400&q=80",
		TrailerYoutubeID: "tg00YEETPFs",
		Director:         "Tony Vũ",
		Cast:             "Võ Cảnh, Thuỳ Anh",
		Language:         "Tiếng Việt — phụ đề Anh",
		PremiereDate:     "10/05/2026",
	},
}

var showtimes = []Showtime{
	{ID: "st001", MovieID: "mv001", StartAt: "2026-05-05T14:00:00Z", Hall: "Hall A", TheaterID: "hanoi"},
	{ID: "st002", MovieID: "mv001", StartAt: "2026-05-05T19:00:00Z", Hall: "Hall C", TheaterID: "hanoi"},
	{ID: "st003", MovieID: "mv002", StartAt: "2026-05-05T16:30:00Z", Hall: "Hall B", TheaterID: "hanoi"},
	{ID: "st004", MovieID: "mv003", StartAt: "2026-05-05T20:15:00Z", Hall: "Hall D", TheaterID: "hanoi"},
	{ID: "st005", MovieID: "mv004", StartAt: "2026-05-05T13:30:00Z", Hall: "Hall A", TheaterID: "danang"},
	{ID: "st006", MovieID: "mv004", StartAt: "2026-05-05T21:00:00Z", Hall: "Hall B", TheaterID: "danang"},
	{ID: "st007", MovieID: "mv005", StartAt: "2026-05-05T18:00:00Z", Hall: "Hall C", TheaterID: "danang"},
	{ID: "st008", MovieID: "mv006", StartAt: "2026-05-05T10:00:00Z", Hall: "Hall D", TheaterID: "danang"},
	{ID: "st009", MovieID: "mv006", StartAt: "2026-05-05T15:45:00Z", Hall: "Hall A", TheaterID: "hcm"},
	{ID: "st010", MovieID: "mv007", StartAt: "2026-05-05T17:00:00Z", Hall: "Hall B", TheaterID: "hcm"},
	{ID: "st011", MovieID: "mv008", StartAt: "2026-05-05T12:00:00Z", Hall: "Hall C", TheaterID: "hcm"},
	{ID: "st012", MovieID: "mv008", StartAt: "2026-05-05T22:30:00Z", Hall: "Hall D", TheaterID: "hcm"},
	{ID: "st013", MovieID: "mv001", StartAt: "2026-05-06T05:40:00Z", Hall: "Hall A", TheaterID: "hanoi"},
	{ID: "st014", MovieID: "mv001", StartAt: "2026-05-06T10:00:00Z", Hall: "Hall A", TheaterID: "hanoi"},
	{ID: "st015", MovieID: "mv001", StartAt: "2026-05-07T04:00:00Z", Hall: "Hall C", TheaterID: "hanoi"},
	{ID: "st016", MovieID: "mv002", StartAt: "2026-05-06T13:00:00Z", Hall: "Hall B", TheaterID: "danang"},
	{ID: "st017", MovieID: "mv002", StartAt: "2026-05-07T11:30:00Z", Hall: "Hall B", TheaterID: "danang"},
}

var theaters = []Theater{
	{ID: "hanoi", Name: "BloopCinema Hà Nội", City: "Hà Nội", Code: "HN", Active: true},
	{ID: "hcm", Name: "BloopCinema Hồ Chí Minh", City: "TP.HCM", Code: "HCM", Active: true},
	{ID: "danang", Name: "BloopCinema Đà Nẵng", City: "Đà Nẵng", Code: "DN", Active: true},
}

var seatLayouts = []SeatLayout{
	{ID: "layout-hn-a", TheaterID: "hanoi", Hall: "Hall A", Rows: []string{"A", "B", "C", "D", "E", "F"}, Cols: 10, Capacity: 60, SeatPrices: defaultSeatPrices()},
	{ID: "layout-hn-b", TheaterID: "hanoi", Hall: "Hall B", Rows: []string{"A", "B", "C", "D", "E", "F"}, Cols: 10, Capacity: 60, SeatPrices: defaultSeatPrices()},
	{ID: "layout-hcm-a", TheaterID: "hcm", Hall: "Hall A", Rows: []string{"A", "B", "C", "D", "E", "F"}, Cols: 10, Capacity: 60, SeatPrices: defaultSeatPrices()},
	{ID: "layout-dn-a", TheaterID: "danang", Hall: "Hall A", Rows: []string{"A", "B", "C", "D", "E", "F"}, Cols: 10, Capacity: 60, SeatPrices: defaultSeatPrices()},
}

var catalogDB *sql.DB

func RegisterRoutes(mux *http.ServeMux, db *sql.DB) {
	catalogDB = db
	_ = ensureCatalogSchema(muxBaseContext(), catalogDB)
	_ = seedCatalogIfEmpty(muxBaseContext(), catalogDB)
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/ready", ready)
	mux.HandleFunc("/api/v1/movies", getMovies)
	mux.HandleFunc("/api/v1/genres", getGenres)
	mux.HandleFunc("/api/v1/showtimes", getShowtimes)
	mux.HandleFunc("/api/v1/theaters", theatersHandler)
	mux.HandleFunc("/api/v1/admin/movies", adminMovies)
	mux.HandleFunc("/api/v1/admin/showtimes", adminShowtimes)
	mux.HandleFunc("/api/v1/admin/theaters", adminTheaters)
	mux.HandleFunc("/api/v1/admin/seat-layouts", adminSeatLayouts)
	mux.HandleFunc("/api/v1/admin/banners", adminBanners)
	mux.HandleFunc("/api/v1/banners", publicBanners)
}

func health(w http.ResponseWriter, _ *http.Request) {
	status := "ok"
	if catalogDB != nil {
		if err := pingDB(muxBaseContext(), catalogDB); err != nil {
			status = "degraded"
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"service": "catalog-service",
		"status":  status,
	})
}

func ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"ready": true,
	})
}

func getMovies(w http.ResponseWriter, _ *http.Request) {
	items, err := listMoviesDB(muxBaseContext(), catalogDB)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func getGenres(w http.ResponseWriter, _ *http.Request) {
	items, err := listMoviesDB(muxBaseContext(), catalogDB)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	seen := map[string]struct{}{}
	genres := make([]string, 0, 8)
	for _, m := range items {
		g := strings.TrimSpace(m.Genre)
		if g == "" {
			continue
		}
		if _, ok := seen[g]; ok {
			continue
		}
		seen[g] = struct{}{}
		genres = append(genres, g)
	}
	sort.Strings(genres)
	writeJSON(w, http.StatusOK, genres)
}

func getShowtimes(w http.ResponseWriter, _ *http.Request) {
	items, err := listShowtimesDB(muxBaseContext(), catalogDB)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func theatersHandler(w http.ResponseWriter, r *http.Request) {
	items, err := listTheatersDB(r.Context(), catalogDB)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func adminTheaters(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := listTheatersDB(r.Context(), catalogDB)
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var in Theater
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		in.ID = strings.TrimSpace(in.ID)
		in.Name = strings.TrimSpace(in.Name)
		in.City = strings.TrimSpace(in.City)
		in.Code = strings.TrimSpace(in.Code)
		if in.ID == "" || in.Name == "" {
			http.Error(w, "id and name required", http.StatusBadRequest)
			return
		}
		if err := upsertTheaterDB(r.Context(), catalogDB, in); err != nil {
			http.Error(w, "upsert failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, in)
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		_, err := catalogDB.ExecContext(r.Context(), `DELETE FROM catalog_theaters WHERE id = $1`, id)
		if err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func adminMovies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := listMoviesDB(r.Context(), catalogDB)
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var in Movie
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		in.ID = strings.TrimSpace(in.ID)
		in.Title = strings.TrimSpace(in.Title)
		if in.ID == "" || in.Title == "" {
			http.Error(w, "id and title required", http.StatusBadRequest)
			return
		}
		if err := upsertMovieDB(r.Context(), catalogDB, in); err != nil {
			http.Error(w, "upsert failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, in)
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		if err := deleteMovieDB(r.Context(), catalogDB, id); err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func adminShowtimes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := listShowtimesDB(r.Context(), catalogDB)
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var in Showtime
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		in.ID = strings.TrimSpace(in.ID)
		in.MovieID = strings.TrimSpace(in.MovieID)
		in.TheaterID = strings.TrimSpace(in.TheaterID)
		in.Hall = strings.TrimSpace(in.Hall)
		in.StartAt = strings.TrimSpace(in.StartAt)
		if in.ID == "" || in.MovieID == "" || in.TheaterID == "" || in.StartAt == "" || in.Hall == "" {
			http.Error(w, "id movieId theaterId startAt hall required", http.StatusBadRequest)
			return
		}
		if err := upsertShowtimeDB(r.Context(), catalogDB, in); err != nil {
			http.Error(w, "upsert failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, in)
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		if err := deleteShowtimeDB(r.Context(), catalogDB, id); err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func computeSeatLayoutCapacity(l SeatLayout) int {
	if l.Capacity > 0 {
		return l.Capacity
	}
	if len(l.Seats) > 0 {
		return len(l.Seats)
	}
	if len(l.Rows) > 0 && l.Cols > 0 {
		return len(l.Rows) * l.Cols
	}
	return 0
}


func normalizeSeatLayout(item SeatLayout) SeatLayout {
	item.Hall = strings.TrimSpace(item.Hall)
	item.TheaterID = strings.TrimSpace(item.TheaterID)
	item.Rows = normalizeRows(item.Rows)
	item.BlockedSeats = normalizeSeatCodes(item.BlockedSeats)
	item.Seats = normalizeSeatNodes(item.Seats)
	item.SeatPrices = normalizeSeatPrices(item.SeatPrices)
	if item.Capacity < 0 {
		item.Capacity = 0
	}
	if item.Capacity == 0 {
		if len(item.Seats) > 0 {
			item.Capacity = len(item.Seats)
		} else if item.Cols > 0 && len(item.Rows) > 0 {
			item.Capacity = len(item.Rows) * item.Cols
		}
	}
	return item
}

func publicBanners(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	items, err := listBannersDB(r.Context(), catalogDB)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	out := make([]Banner, 0, len(items))
	for _, b := range items {
		if b.Active {
			out = append(out, b)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func adminBanners(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := listBannersDB(r.Context(), catalogDB)
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		if strings.Contains(strings.ToLower(r.Header.Get("Content-Type")), "multipart/form-data") {
			if err := r.ParseMultipartForm(20 << 20); err != nil {
				http.Error(w, "invalid multipart form", http.StatusBadRequest)
				return
			}
			item := Banner{
				ID:          strings.TrimSpace(r.FormValue("id")),
				Title:       strings.TrimSpace(r.FormValue("title")),
				Description: strings.TrimSpace(r.FormValue("description")),
				Link:        strings.TrimSpace(r.FormValue("link")),
				Active:      true,
			}
			if item.Title == "" {
				item.Title = "Banner"
			}
			if active := strings.TrimSpace(r.FormValue("active")); active != "" {
				item.Active = active == "true" || active == "1" || strings.EqualFold(active, "on")
			}
			if sortOrder := strings.TrimSpace(r.FormValue("sortOrder")); sortOrder != "" {
				fmt.Sscanf(sortOrder, "%d", &item.SortOrder)
			}
			file, header, err := r.FormFile("image")
			if err != nil {
				item.ImageURL = ""
			} else {
				defer file.Close()
				if item.ID == "" {
					item.ID = fmt.Sprintf("banner-%d", time.Now().UnixNano())
				}
				uploadDir := filepath.Join("uploads", "banners")
				if err := os.MkdirAll(uploadDir, 0o755); err != nil {
					http.Error(w, "upload dir failed", http.StatusInternalServerError)
					return
				}
				ext := filepath.Ext(header.Filename)
				if ext == "" {
					ext = ".jpg"
				}
				filename := item.ID + ext
				path := filepath.Join(uploadDir, filename)
				out, err := os.Create(path)
				if err != nil {
					http.Error(w, "save image failed", http.StatusInternalServerError)
					return
				}
				defer out.Close()
				if _, err := io.Copy(out, file); err != nil {
					http.Error(w, "save image failed", http.StatusInternalServerError)
					return
				}
				item.ImageURL = "/uploads/banners/" + filename
				if err := upsertBannerDB(r.Context(), catalogDB, item); err != nil {
					http.Error(w, "upsert failed", http.StatusInternalServerError)
					return
				}
				writeJSON(w, http.StatusOK, item)
				return
			}
		}
		var in Banner
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		in.ID = strings.TrimSpace(in.ID)
		in.Title = strings.TrimSpace(in.Title)
		in.ImageURL = strings.TrimSpace(in.ImageURL)
		if in.ID == "" || in.Title == "" || in.ImageURL == "" {
			http.Error(w, "id title imageUrl required", http.StatusBadRequest)
			return
		}
		if err := upsertBannerDB(r.Context(), catalogDB, in); err != nil {
			http.Error(w, "upsert failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, in)
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		if err := deleteBannerDB(r.Context(), catalogDB, id); err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func adminSeatLayouts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := listSeatLayoutsDB(r.Context(), catalogDB)
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		out := make([]SeatLayout, 0, len(items))
		for _, l := range items {
			clone := normalizeSeatLayout(l)
			out = append(out, clone)
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var in SeatLayout
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		in = normalizeSeatLayout(in)
		if in.Hall == "" {
			http.Error(w, "hall required", http.StatusBadRequest)
			return
		}
		if in.TheaterID == "" {
			http.Error(w, "theaterId required", http.StatusBadRequest)
			return
		}
		if len(in.Seats) == 0 && (in.Cols <= 0 || len(in.Rows) == 0) && in.Capacity <= 0 {
			http.Error(w, "provide seats[] or rows+cols or capacity", http.StatusBadRequest)
			return
		}
		if err := upsertSeatLayoutDB(r.Context(), catalogDB, in); err != nil {
			http.Error(w, "upsert failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, in)
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		hall := strings.TrimSpace(r.URL.Query().Get("hall"))
		key := id
		if key == "" {
			key = hall
		}
		if key == "" {
			http.Error(w, "id or hall required", http.StatusBadRequest)
			return
		}
		if err := deleteSeatLayoutDB(r.Context(), catalogDB, key); err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func normalizeRows(rows []string) []string {
	out := make([]string, 0, len(rows))
	seen := make(map[string]struct{})
	for _, r := range rows {
		t := strings.TrimSpace(strings.ToUpper(r))
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

func normalizeSeatCodes(seats []string) []string {
	out := make([]string, 0, len(seats))
	seen := make(map[string]struct{})
	for _, s := range seats {
		t := strings.TrimSpace(strings.ToUpper(s))
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

func normalizeSeatNodes(seats []SeatNode) []SeatNode {
	out := make([]SeatNode, 0, len(seats))
	seen := make(map[string]struct{})
	for _, s := range seats {
		code := strings.TrimSpace(strings.ToUpper(s.Code))
		if code == "" {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		typ := strings.TrimSpace(strings.ToLower(s.Type))
		if typ == "" {
			typ = "standard"
		}
		enabled := true
		if s.Enabled != nil {
			enabled = *s.Enabled
		}
		out = append(out, SeatNode{
			Code:    code,
			X:       s.X,
			Y:       s.Y,
			Type:    typ,
			Enabled: &enabled,
		})
	}
	return out
}

func defaultSeatPrices() SeatPrices {
	return SeatPrices{
		Standard: 50000,
		VIP:      75000,
		Couple:   100000,
	}
}

func normalizeSeatPrices(prices SeatPrices) SeatPrices {
	def := defaultSeatPrices()
	if prices.Standard <= 0 {
		prices.Standard = def.Standard
	}
	if prices.VIP <= 0 {
		prices.VIP = def.VIP
	}
	if prices.Couple <= 0 {
		prices.Couple = def.Couple
	}
	return prices
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func muxBaseContext() context.Context {
	return context.Background()
}
