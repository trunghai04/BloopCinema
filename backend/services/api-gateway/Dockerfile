FROM golang:1.25-alpine AS build

WORKDIR /app
COPY . .
RUN go build -o /bin/api-gateway ./cmd/server

FROM alpine:3.20
COPY --from=build /bin/api-gateway /bin/api-gateway
EXPOSE 8080
ENTRYPOINT ["/bin/api-gateway"]
