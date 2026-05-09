FROM golang:1.25-alpine AS build

WORKDIR /app
COPY . .
RUN go build -o /bin/auth-service ./cmd/server

FROM alpine:3.20
COPY --from=build /bin/auth-service /bin/auth-service
EXPOSE 8081
ENTRYPOINT ["/bin/auth-service"]
