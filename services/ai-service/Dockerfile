# syntax=docker/dockerfile:1.10@sha256:865e5dd094beca432e8c0a1d5e1c465db5f998dca4e439981029b3b81fb39ed5

FROM golang:1.26.5-bookworm@sha256:53eeac89074db483fdf0ab3be1df32bf6e47562263d2d0d6baa7f26acb4957dd AS build

ARG TARGETARCH=amd64
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# Keep the module toolchain and the image builder on the same pinned release.
RUN test "$(go env GOVERSION)" = "go1.26.5" \
  && CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH \
    go build -trimpath -buildvcs=false \
      -ldflags='-s -w' -o /out/ai-service ./cmd/ai-service

FROM busybox:1.37.0-musl@sha256:5cec3fc171c87218698e85a52af7087de727372aae264a787b8112901a5b0092 AS probe

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab

ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="qltbyt shared AI service" \
  org.opencontainers.image.revision="$VCS_REF" \
  org.opencontainers.image.description="Digest-addressed shared Go AI service"

COPY --from=build /out/ai-service /usr/local/bin/ai-service
COPY --from=probe /bin/busybox /busybox

USER 65532:65532
WORKDIR /
ENTRYPOINT ["/usr/local/bin/ai-service"]
