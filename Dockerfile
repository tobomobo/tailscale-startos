ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS gateway-build

ARG TARGETOS=linux
ARG TARGETARCH=amd64

WORKDIR /src

COPY gateway/go.mod ./go.mod
COPY gateway/main.go ./main.go

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o /out/tailscale-gateway .

FROM ghcr.io/tailscale/tailscale:v1.96.5

COPY --from=gateway-build /out/tailscale-gateway /usr/local/bin/tailscale-gateway
COPY docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh

RUN chmod 0755 /usr/local/bin/tailscale-gateway /usr/local/bin/docker_entrypoint.sh
