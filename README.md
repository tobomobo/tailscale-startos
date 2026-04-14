<p align="center">
  <img src="icon.svg" alt="Tailscale for StartOS" width="21%">
</p>

# Tailscale on StartOS

> Upstream repo: <https://github.com/tailscale/tailscale>

This repository packages Tailscale for StartOS using the current `startos/` SDK layout documented in the Start9 packaging guide.
It is an independent StartOS packaging project and is not affiliated with or endorsed by Tailscale Inc.

## Branding And License

- The packaging code in this repository is licensed under the MIT license in `LICENSE`.
- The packaged upstream Tailscale software is separate third-party software licensed by its authors.
- See `THIRD_PARTY_NOTICES.md` and `licenses/tailscale-BSD-3-Clause.txt` for upstream attribution and license text.
- `icon.svg` is derived from Tailscale's published favicon asset and is used only to identify the upstream project.
- Tailscale is a registered trademark of Tailscale Inc. No endorsement is implied.

## What This Package Does

This package gives StartOS a persistent Tailscale node that uses Tailscale Serve to publish selected StartOS services. The sign-in flow is a device-independent login link surfaced through StartOS actions.

## Current Scope

- Builds a small wrapper image on top of the official `ghcr.io/tailscale/tailscale` base image
- Persists Tailscale state in the `main` volume
- Automatically requests a device-independent Tailscale login link on startup when the node is not signed in
- Lets one signed-in Tailscale node serve selected installed StartOS service interfaces
- Registers as a `url-v0` plugin so served services can appear in StartOS interface tables like Tor-managed onion addresses
- Probes Tailscale HTTPS certificate issuance after login and surfaces any error verbatim
- Backs up and restores the persistent state volume

## Important Limitation

This package runs Tailscale inside a normal StartOS service container in userspace mode. That means it creates a Tailscale node for the package itself, and uses Tailscale Serve from that node to publish selected StartOS services. It does **not** automatically turn the whole StartOS host into a subnet router or publish every installed service over Tailscale.

That limitation matters if your goal is something closer to StartTunnel-style host or network ingress. A standard service package can get you a Tailscale-connected container and UI today, but a true host-level Tailscale integration would likely need platform-level networking support beyond a normal package.

The same SDK limitation applies to the StartOS system dashboard itself: this package can add Tailscale addresses to normal package interface tables, but the system UI is not exposed as a normal package interface in the public SDK, so there is no stable way for this package to inject a working `Plugin: Tailscale` serve flow into System Settings the same way Tor can for package services.

## Build

```bash
make
```

This creates x86_64 and aarch64 `.s9pk` files in the project root. (`make` invokes `npm ci` on its own via the `node_modules` rule, so no separate `npm install` step is needed.)

## Install

Download a prebuilt `.s9pk` for your arch from the [Releases page](https://github.com/tobomobo/tailscale-startos/releases) and sideload it from the StartOS UI. Supported arches are **x86_64** and **aarch64** (upstream Tailscale does not publish a riscv64 container).

Or build locally and install with:

```bash
make install
```

## First Run

1. Install and start the service.
2. Wait a few seconds for the node to request its initial login link automatically.
3. Run `Show Login Link` from the `Access` action group.
4. Open or scan that link on any trusted device and complete the Tailscale login flow.
5. Enable **HTTPS Certificates** for your tailnet in the Tailscale admin console (DNS → HTTPS). Without this, HTTPS serves cannot get a TLS cert.
6. Use the `Serve` actions to add one or more StartOS service serves.
7. Reach those services through this single Tailscale node's MagicDNS name.

If `Show Login Link` still says the link is being generated, wait a few seconds or run `Refresh Login Link` to force a fresh request. If the request fails, the action shows the captured error output directly. If HTTPS certificate issuance is failing, `Show Device Info` shows the exact error from `tailscale cert`.

## Access Actions

- `Set Device Name`: choose the Tailscale machine name and MagicDNS prefix this node should use
- `Show Device Info`: display the current backend state, MagicDNS name, Tailscale IPs, tailnet details, and HTTPS certificate status for this node
- `Show Login Link`: display the current device-independent Tailscale login link as copyable text and QR, or show the latest request error
- `Refresh Login Link`: force a fresh login-link request if the previous link expired, was missed, or failed to generate

## Serve Actions

- `Add Serve`: publish one installed StartOS interface through this Tailscale node (HTTPS, Funnel, HTTP, TCP, or TLS-terminated TCP)
- `Edit Serve`: change the published port on a saved serve
- `Remove Serve`: stop publishing a saved route
- `Show Serves`: inspect the serves this node is currently managing, and surface any HTTPS certificate warnings
- `Refresh Targets`: re-resolve target container IPs if a destination service has restarted

The StartOS interface URL table also gains a quick **Serve On Tailscale** action when this package is installed. That path opens a lightweight form directly from the target service's URL table with an editable published port and an automatic serve mode, and the resulting `Plugin: Tailscale` entries point back at this node's MagicDNS hostname. If a service exposes multiple interfaces, use the quick action from the specific interface row you want to publish.

## Serve Modes

- **HTTPS** — Tailscale Serve publishes the interface at `https://<magicdns>:<port>` with a Tailscale-managed TLS certificate, visible only to your tailnet. Requires HTTPS Certificates enabled in the admin console.
- **Funnel** — Tailscale Funnel publishes the interface at `https://<magicdns>:<port>` on the **public internet**. Only ports 443, 8443, and 10000 are allowed. Requires Funnel enabled for your tailnet in the admin console (Access Controls → nodeAttrs). Only use this when you actually want the service reachable by anyone on the open web.
- **HTTP** — plain HTTP without TLS. Fine for trusted tailnets where you do not need HTTPS.
- **TLS-terminated TCP** — Tailscale terminates TLS and forwards the raw stream. Use this for services whose clients can speak TLS natively (e.g. TLS-capable RPC or database clients).
- **Raw TCP** — pass-through TCP forwarder without TLS.

## Notes

- One Tailscale sign-in covers the whole package.
- Served services are explicit, not automatic.
- The package intentionally pins a specific upstream Tailscale container version so builds stay reproducible.
- HTTPS mode requires HTTPS Certificates enabled on the tailnet. The node probes issuance periodically and surfaces the Tailscale error verbatim if HTTPS is not enabled.
- If Tailscale Serve is not yet enabled for your tailnet, check the Tailscale package logs after adding a serve.

## Upstream References

- [Start9 Packaging Guide](https://docs.start9.com/packaging/)
- [Tailscale Docker docs](https://tailscale.com/docs/features/containers/docker/how-to/connect-docker-standalone)
- [Tailscale quickstart](https://tailscale.com/kb/1346/start)
- [Tailscale Serve docs](https://tailscale.com/kb/1242/tailscale-serve)
- [Tailscale HTTPS Certificates](https://tailscale.com/kb/1153/enabling-https)
- [Tailscale favicon asset](https://tailscale.com/favicon.svg)
