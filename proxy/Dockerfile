FROM golang:1.26-alpine3.23@sha256:9dfeab91d05d576e6102400be6596b381cb659608a561bcd98bde2048b13a9a2 AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o proxy .

FROM alpine:3.22@sha256:8a1f59f88cfe431f5e2bba620cf0cb7607fae0b4e67e07a18bd58f5bbe6cad9c
RUN apk --no-cache add ca-certificates
RUN adduser -D -g "" appuser
WORKDIR /app
COPY --from=builder /app/proxy ./proxy
EXPOSE 8080
USER appuser
ENTRYPOINT ["./proxy"]
