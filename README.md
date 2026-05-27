# Bloop Cinema

Bloop Cinema là một hệ thống đặt vé xem phim theo hướng `React + Go microservices`, được thiết kế với tư duy production-first: backend tách domain rõ ràng, có API gateway, hỗ trợ health checks, rate limiting, retry, circuit breaker, logging, và các baseline cho deploy Docker/Kubernetes.

## Backend architecture

```text
Frontend (React + Vite)
        ↓
API Gateway
        ↓
Auth Service
User Service
Catalog Service
Booking Service
Seat Inventory Service
Payment Service
Notification Service
        ↓
Kafka / RabbitMQ
        ↓
PostgreSQL riêng cho từng domain + Redis
```

Mục tiêu của backend architecture này là:

- tách trách nhiệm theo domain
- giảm coupling giữa các module
- dễ scale từng phần độc lập
- dễ quan sát, debug và vận hành ở môi trường thật

## Backend services

### 1. API Gateway

Gateway là entry point cho frontend/mobile app và chịu trách nhiệm:

- routing request tới service phù hợp
- auth / request forwarding
- request timeout
- request-id correlation
- JSON access log
- rate limit theo client IP
- retry cho request idempotent
- circuit breaker cho upstream

### 2. Auth Service

Service chuyên cho authentication và token management:

- login
- JWT auth
- OAuth
- refresh token
- verify/rotate token

### 3. User Service

Service riêng để quản lý người dùng và hồ sơ cá nhân:

- đăng ký
- profile
- membership
- điểm thưởng
- user info
- account settings

### 4. Catalog Service

Service phụ trách dữ liệu nội dung:

- phim
- thể loại
- lịch chiếu
- thông tin hiển thị cho trang catalog

### 5. Booking Service

Service xử lý luồng đặt vé và lưu trạng thái booking trong PostgreSQL.

Đây là một trong những domain quan trọng nhất của hệ thống vì liên quan đến:

- trạng thái booking
- concurrency
- consistency
- luồng confirm/cancel

### 6. Seat Inventory Service

Service chuyên quản lý trạng thái ghế và cơ chế giữ ghế:

- available
- reserved
- booked
- seat hold timeout
- distributed lock
- chống double booking

Đây là domain khó nhất của hệ thống vì phải xử lý concurrent booking ở traffic cao.

### 7. Payment Service

Service riêng để xử lý thanh toán:

- momo / vnpay / stripe
- payment callback / webhook
- refund
- đối soát giao dịch
- idempotency cho giao dịch thanh toán
- xử lý webhook duplication
- eventual consistency / saga compensation

Tách riêng payment giúp hệ thống dễ mở rộng và an toàn hơn khi tích hợp nhiều cổng thanh toán.

### 8. Notification Service

Service dùng cho các tác vụ bất đồng bộ:

- email
- SMS
- push notification
- gửi thông báo đặt vé thành công
- consume event từ Kafka/RabbitMQ

## Production baseline đã có

Dự án đã bật một số baseline production quan trọng ở backend:

- graceful shutdown cho toàn bộ Go services
- `/health` và `/ready` cho probe
- Docker Compose có restart policy và healthcheck
- API gateway có request timeout và cơ chế bảo vệ upstream
- có thể mở rộng theo hướng event-driven architecture

## Data layer

Mỗi domain service có PostgreSQL riêng:

- `postgres-user`
- `postgres-catalog`
- `postgres-booking`
- `postgres-payment`
- Redis cho cache / rate limit / seat hold / distributed lock

Thiết kế này giúp:

- tách dữ liệu theo bounded context
- tránh một DB trung tâm quá lớn
- giảm phụ thuộc chéo giữa service

## Event-driven flow

Ví dụ flow backend theo hướng event-driven:

```text
BookingCreated
→ SeatReserved
→ PaymentProcessed
→ TicketGenerated
→ NotificationSent
```

Luồng này giúp:

- giảm coupling giữa các service
- dễ retry khi một bước thất bại
- tách tác vụ đồng bộ và bất đồng bộ rõ ràng hơn

## Planned observability stack

- OpenTelemetry
- Jaeger
- Prometheus
- Grafana
- Loki / ELK

## Hướng phát triển backend tiếp theo

Nếu muốn đưa hệ thống tiến gần hơn production thật, các bước tiếp theo nên là:

- hoàn thiện seat inventory service
- thêm message broker như Kafka/RabbitMQ
- thêm Redis cho cache, rate limit, seat hold, distributed lock
- bổ sung notification service
- bổ sung tracing bằng OpenTelemetry
- gom log tập trung bằng ELK hoặc Loki
- áp dụng saga/idempotency cho payment và booking

## Tư duy thiết kế backend

Hệ thống này không chỉ là CRUD movie booking. Các bài toán cốt lõi là:

- seat locking
- booking consistency
- payment consistency
- concurrent booking
- observability
- resiliency
- scalability
- distributed system design

Đây là những phần quyết định hệ thống có chạy ổn ở traffic cao hay không.

## Current limitations

- chưa có distributed tracing end-to-end
- chưa có async event bus hoàn chỉnh
- chưa xử lý distributed transaction hoàn chỉnh
- chưa có autoscaling cho toàn bộ domain services
- chưa có multi-region deployment

## Frontend

Thư mục `frontend` chứa ứng dụng ReactJS (Vite) với 11 trang:

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

Frontend được cấu hình để gọi API qua gateway.

## Chạy toàn stack bằng Docker

```bash
docker compose up --build
```

### Các cổng mặc định

- Frontend (Nginx): `http://localhost:5173`
- Gateway: `http://localhost:8080`
- Auth service: `http://localhost:8081`
- Catalog service: `http://localhost:8082`
- Booking service: `http://localhost:8083`
- PostgreSQL auth: `localhost:5436`
- PostgreSQL catalog: `localhost:5434`
- PostgreSQL booking: `localhost:5435`

Frontend Nginx đã proxy `/api/*` sang gateway.

## Chạy frontend ở local mode

```bash
cd frontend
npm install
npm run dev
```

Frontend dev mode sẽ gọi API qua `http://localhost:8080`.

## Domain production

Domain mục tiêu:

- `https://cinema.bloop.io.vn`

### DNS

Cấu hình Cloudflare:

- Type: `A`
- Name: `cinema`
- Content: `<public-ip-server>`

### CORS

Gateway đã cho phép:

- `https://cinema.bloop.io.vn`
- `http://localhost:5173`

## Deploy Nginx + SSL nhanh

Đã chuẩn bị sẵn:

- `deploy/nginx/cinema.bloop.io.vn.conf`
- `deploy/scripts/deploy-cinema-ssl.sh`

### Cách chạy trên Ubuntu server

```bash
sudo mkdir -p /opt
sudo cp -R . /opt/soa-BloopCinema
cd /opt/soa-BloopCinema
sudo bash deploy/scripts/deploy-cinema-ssl.sh admin@bloop.io.vn
```

Script sẽ:

- cài `nginx` và `certbot`
- bật site `cinema.bloop.io.vn`
- xin SSL Let's Encrypt
- reload nginx

## Deploy production bằng Kubernetes

Manifest nằm trong `deploy/k8s` và bao gồm:

- namespace + configmap
- 3 PostgreSQL deployment/service tách riêng cho auth, catalog, booking
- deployment/service cho 4 microservice
- readiness/liveness probe
- HPA cho gateway
- PodDisruptionBudget cho 4 service chính
- network policy
- kustomization để apply nhanh

### Apply

```bash
kubectl apply -k deploy/k8s
```

### Lưu ý trước khi deploy

- image hiện đang để placeholder `ghcr.io/your-org/...`
- cần cập nhật `deploy/k8s/app-secrets.yaml` với:
  - 3 `DATABASE_URL`
  - `JWT_SECRET`
- cấu hình CORS production nằm ở `deploy/k8s/configmap.yaml`
