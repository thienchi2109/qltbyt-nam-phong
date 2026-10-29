# syntax=docker/dockerfile:1

FROM golang:1.26-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -ldflags='-s -w' -o /out/web-push ./cmd/web-push

FROM scratch

ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/thienchi2109/qltbyt-nam-phong" \
      org.opencontainers.image.revision="${SOURCE_REVISION}"

COPY --from=build /out/web-push /usr/local/bin/web-push
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
USER 65532:65532
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/web-push"]
