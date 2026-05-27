FROM golang:1.25-alpine AS build

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/user-service ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=build /bin/user-service /bin/user-service

EXPOSE 8084
ENTRYPOINT ["/bin/user-service"]
