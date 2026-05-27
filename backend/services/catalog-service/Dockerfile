FROM golang:1.25-alpine AS build

WORKDIR /app
COPY . .
RUN go build -o /bin/catalog-service ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=build /bin/catalog-service /bin/catalog-service
EXPOSE 8082
ENTRYPOINT ["/bin/catalog-service"]
