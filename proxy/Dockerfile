FROM golang:1.21-alpine@sha256:2414035b086e3c42b99654c8b26e6f5b1b1598080d65fd03c7f499552ff4dc94 AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o proxy .

FROM alpine:3.23@sha256:25109184c71bdad752c8312a8623239686a9a2071e8825f20acb8f2198c3f659
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/proxy ./proxy
EXPOSE 8080
ENTRYPOINT ["./proxy"]
