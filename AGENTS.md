# AGENTS

This repository packages Tailscale for StartOS.

## Goal

- Ship a StartOS package that runs a single persistent Tailscale gateway node.
- Sign in once, then serve selected StartOS service interfaces through that node using Tailscale Serve.
- Surface served service URLs back into StartOS with the `url-v0` plugin path where supported.

## Stack

- StartOS SDK: `@start9labs/start-sdk@1.0.0`
- Package manager: `npm`
- TypeScript bundle output: `javascript/`
- Package build: `make`, `make x86`, `make arm`, `make riscv`
- Container runtime: custom wrapper image on top of `ghcr.io/tailscale/tailscale`
- Helper binary: Go code in `gateway/`

## Important Commands

- Install deps: `npm ci`
- Typecheck: `npm run check`
- Build JS bundle: `npm run build`
- Build x86 package: `make -B x86`
- Build all arches: `make`

Prefer `make -B x86` for the quickest full packaging check on macOS.

## Repo Layout

- [startos/main.ts](/Users/dev/Github/tailscale-startos/startos/main.ts): daemon setup and health checks
- [startos/actions](/Users/dev/Github/tailscale-startos/startos/actions): StartOS actions
- [startos/lib/gatewayConfig.ts](/Users/dev/Github/tailscale-startos/startos/lib/gatewayConfig.ts): saved serve model
- [startos/lib/certInfo.ts](/Users/dev/Github/tailscale-startos/startos/lib/certInfo.ts): HTTPS cert probe status
- [startos/lib/loginInfo.ts](/Users/dev/Github/tailscale-startos/startos/lib/loginInfo.ts): status/login sidecar files
- [startos/lib/deviceName.ts](/Users/dev/Github/tailscale-startos/startos/lib/deviceName.ts): persisted Tailscale device-name override
- [startos/lib/tailscaleUrls.ts](/Users/dev/Github/tailscale-startos/startos/lib/tailscaleUrls.ts): MagicDNS/plugin URL helpers
- [startos/urlPlugin.ts](/Users/dev/Github/tailscale-startos/startos/urlPlugin.ts): `url-v0` plugin registration/export sync
- [docker_entrypoint.sh](/Users/dev/Github/tailscale-startos/docker_entrypoint.sh): login/bootstrap loop and route apply loop
- [gateway/main.go](/Users/dev/Github/tailscale-startos/gateway/main.go): local proxy listeners and `tailscale serve` application
- [startos/manifest/index.ts](/Users/dev/Github/tailscale-startos/startos/manifest/index.ts): package manifest
- [startos/versions](/Users/dev/Github/tailscale-startos/startos/versions): version graph and release notes

## Conventions

- Use `npm`, not `pnpm`.
- Use `apply_patch` for edits.
- Keep TypeScript style aligned with the repo:
  - 2-space indent
  - single quotes
  - no semicolons
- Prefer explicit, reproducible version pins. Do not switch the Tailscale image to a floating `latest` tag.

## Runtime Notes

- Tailscale state is persisted in the `main` volume at `/var/lib/tailscale`.
- Normal package updates should preserve login state as long as the package id and state path stay the same.
- Login links are requested automatically on startup when the node is not signed in.
- Logged-out startup must gate on `tailscale status --json`, not plain `tailscale status`, because plain status exits nonzero while logged out.
- HTTPS serves rely on the tailnet having HTTPS Certificates enabled in the Tailscale admin console. The entrypoint probes `tailscale cert` periodically and writes either `tailscale-cert.ok` or `tailscale-cert.stderr` in the state dir; the `add-serve` and `show-device-info` actions surface that error verbatim so users know what to fix.

## StartOS SDK Boundaries

- The package supports StartOS `url-v0` plugin URLs for normal package service interfaces.
- The package can add `Plugin: Tailscale` rows to other package interface tables.
- The StartOS system UI itself is not exposed through the normal package API in a stable way.
- Do not pretend the package can reliably inject a Tor-style plugin section into System Settings unless the public SDK actually grows that surface.

## Current UX Model

- `Access` actions:
  - show device info
  - show/refresh login link
  - set preferred device name
- `Serve` actions:
  - add/remove/show serves
  - refresh targets
- Interface-table integration:
  - quick add/remove path through the `url-v0` plugin

## Before You Finish A Change

- Run `npm run check`
- Run `npm run build`
- Run `make -B x86` if the change can affect packaging/runtime behavior
- Update [README.md](/Users/dev/Github/tailscale-startos/README.md) when behavior or setup changes
- Add a new entry in [startos/versions](/Users/dev/Github/tailscale-startos/startos/versions) for user-visible package changes

## Licensing

- Repo-owned packaging code is MIT.
- Upstream Tailscale remains third-party software under BSD-3-Clause.
- Keep [THIRD_PARTY_NOTICES.md](/Users/dev/Github/tailscale-startos/THIRD_PARTY_NOTICES.md) and [licenses/tailscale-BSD-3-Clause.txt](/Users/dev/Github/tailscale-startos/licenses/tailscale-BSD-3-Clause.txt) in sync with packaging/distribution changes.
