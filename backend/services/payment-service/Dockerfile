FROM golang:1.25-alpine AS build

WORKDIR /app

RUN apk add --no-cache ca-certificates git

COPY go.mod ./
RUN go mod download

COPY . .
RUN go build -o /bin/payment-service ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=build /bin/payment-service /bin/payment-service

EXPOSE 8085
ENTRYPOINT ["/bin/payment-service"]
