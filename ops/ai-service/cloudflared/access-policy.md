# Cloudflare Access boundary

Create one Access application for the Tunnel hostname in `config.yml` and protect
`/v1/chat` with a service-token policy. Store the client ID and client secret only
in the trusted Next.js BFF environment (`AI_SERVICE_BFF_CF_ACCESS_CLIENT_ID` and
`AI_SERVICE_BFF_CF_ACCESS_CLIENT_SECRET`). They do not belong in this repository,
the Go image, the Tunnel credentials file, or the Oracle service environment.

The Access policy must deny requests without the BFF service token. The Tunnel
route is path-scoped to `/v1/chat`; `/healthz`, `/readyz`, and arbitrary paths are
not published through the hostname. Probe those paths from the Oracle host only.

Record the application ID, hostname, policy revision, and redacted configuration
hash in the deployment record. Never record token values.
