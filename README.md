# Bloop Cinema - React + Go Microservices

Project chia theo 3 phần:

- `frontend`: ReactJS (Vite) với 11 trang web.
- `backend`: Go microservices (`api-gateway`, `auth-service`,
  `catalog-service`, `booking-service`).
- `database`: PostgreSQL với migration khởi tạo bảng booking.

## Architecture (Microservice)

- `api-gateway` nhận request từ frontend, route sang service phù hợp.
- `auth-service` xử lý login.
- `catalog-service` trả dữ liệu phim, thể loại, lịch chiếu.
- `booking-service` xử lý đặt vé và lưu PostgreSQL.
- Mỗi domain service có PostgreSQL riêng (`postgres-auth`, `postgres-catalog`, `postgres-booking`).

### Production baseline đã bật

- graceful shutdown cho toàn bộ Go services.
- `/health` + `/ready` endpoint cho probe.
- API gateway có request timeout, request-id, JSON access log.
- API gateway có basic rate limit theo client IP.
- API gateway có retry cho request idempotent + circuit breaker cho upstream.
- Docker compose thêm restart policy + healthcheck.

## 11 Frontend Pages

1. Trang chủ
2. Giới thiệu
3. Phim đang chiếu
4. Chi tiết phim
5. Thể loại
6. Lịch chiếu
7. Đặt chỗ
8. Khuyến mãi
9. Tin tức
10. Liên hệ
11. Hồ sơ người dùng

## Run nhanh bằng Docker (full stack)

```bash
docker compose up --build
```

Các cổng:

- Frontend (Nginx): `http://localhost:5173`
- Gateway: `http://localhost:8080`
- Auth service: `http://localhost:8081`
- Catalog service: `http://localhost:8082`
- Booking service: `http://localhost:8083`
- PostgreSQL auth: `localhost:5436`
- PostgreSQL catalog: `localhost:5434`
- PostgreSQL booking: `localhost:5435`

Frontend Nginx đã proxy `/api/*` sang gateway.

## Run frontend local (dev mode)

```bash
cd frontend
npm install
npm run dev
```

Frontend gọi API qua `http://localhost:8080`.

## Domain production

Domain mục tiêu: `https://cinema.bloop.io.vn`

- Cloudflare DNS:
  - Type: `A`
  - Name: `cinema`
  - Content: `<public-ip-server>`
- Gateway CORS đã cho phép:
  - `https://cinema.bloop.io.vn`
  - `http://localhost:5173`

## Deploy Nginx + SSL nhanh

Đã có sẵn:

- `deploy/nginx/cinema.bloop.io.vn.conf`
- `deploy/scripts/deploy-cinema-ssl.sh`

Server Ubuntu chạy nhanh:

```bash
sudo mkdir -p /opt
sudo cp -R . /opt/soa-BloopCinema
cd /opt/soa-BloopCinema
sudo bash deploy/scripts/deploy-cinema-ssl.sh admin@bloop.io.vn
```

Script sẽ:

- install `nginx + certbot`
- bật site `cinema.bloop.io.vn`
- xin SSL Let's Encrypt
- reload nginx

## Production deploy bằng Kubernetes

Manifest nằm ở `deploy/k8s`:

- namespace + configmap
- 3 PostgreSQL deployment/service tách riêng cho auth, catalog, booking
- deployment/service cho 4 microservice
- readiness/liveness probe
- HPA cho gateway
- PodDisruptionBudget cho 4 service chính
- network policy
- kustomization để apply nhanh

Apply:

```bash
kubectl apply -k deploy/k8s
```

Lưu ý:

- image đang để placeholder `ghcr.io/your-org/...`
- cần cập nhật `deploy/k8s/app-secrets.yaml` (3 DATABASE_URL + `JWT_SECRET`) trước khi apply
- domain CORS production cấu hình ở `deploy/k8s/configmap.yaml`
