FROM golang:1.25-alpine AS build

WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o /bin/booking-service ./cmd/server

FROM alpine:3.20
COPY --from=build /bin/booking-service /bin/booking-service
EXPOSE 8083
ENTRYPOINT ["/bin/booking-service"]
