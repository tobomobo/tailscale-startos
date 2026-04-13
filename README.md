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

This package gives StartOS a persistent Tailscale gateway node. The sign-in flow is a device-independent login link exposed through StartOS actions.

## Current Scope

- Builds a small wrapper image on top of the official `ghcr.io/tailscale/tailscale` base image
- Persists Tailscale state in the `main` volume
- Automatically requests a device-independent Tailscale login link on startup when the gateway is not signed in
- Lets one signed-in Tailscale node publish selected installed StartOS service interfaces
- Registers as a `url-v0` plugin so exposed services can appear in StartOS interface tables like Tor-managed onion addresses
- Backs up and restores the persistent state volume

## Important Limitation

This package runs Tailscale inside a normal StartOS service container in userspace mode. That means it creates a Tailscale node for the package itself, and uses that node as a gateway for selected StartOS services. It does **not** automatically turn the whole StartOS host into a subnet router or publish every installed service over Tailscale.

That limitation matters if your goal is something closer to StartTunnel-style host or network ingress. A standard service package can get you a Tailscale-connected container and UI today, but a true host-level Tailscale integration would likely need platform-level networking support beyond a normal package.

The same SDK limitation applies to the StartOS system dashboard itself: this package can add Tailscale addresses to normal package interface tables, but the system UI is not exposed as a normal package interface in the public SDK, so there is no stable way for this package to inject a `Plugin: Tailscale` section into System Settings the same way Tor can for package services.

## Build

```bash
npm install
make
```

This creates a `.s9pk` in the project root.

## Install

You can sideload the built `.s9pk` from the StartOS UI, or use:

```bash
make install
```

## First Run

1. Install and start the service.
2. Wait a few seconds for the gateway to request its initial login link automatically.
3. Run `Show Login Link` from the `Access` action group.
4. Open or scan that link on any trusted device and complete the Tailscale login flow.
5. Use the `Gateway` actions to add one or more StartOS service exposures.
6. Reach those services through this single Tailscale node.

If `Show Login Link` still says the link is being generated, wait a few seconds or run `Refresh Login Link` to force a fresh request. If the request fails, the action now shows the captured error output directly.

## Access Actions

- `Set Device Name`: choose the Tailscale machine name and MagicDNS prefix this gateway should use
- `Show Device Info`: display the current backend state, MagicDNS name, Tailscale IPs, and tailnet details for this node
- `Show Login Link`: display the current device-independent Tailscale login link as copyable text and QR, or show the latest request error
- `Refresh Login Link`: force a fresh login-link request if the previous link expired, was missed, or failed to generate

## Gateway Actions

- `Add Exposure`: publish one installed StartOS interface through this Tailscale node
- `Remove Exposure`: stop publishing a saved route
- `Show Exposures`: inspect the routes this gateway is currently managing
- `Refresh Targets`: re-resolve target container IPs if a destination service has restarted

The StartOS interface URL table also gains a quick Tailscale action when this package is installed. That path adds a default exposure directly from the target service's URL table, and the resulting `Plugin: Tailscale` entries point back at the gateway node's MagicDNS hostname.

## Notes

- One Tailscale sign-in covers the whole gateway package.
- Exposed services are explicit, not automatic.
- The package intentionally pins a specific upstream Tailscale container version so builds stay reproducible.
- Web interfaces that already advertise SSL in StartOS are published through Tailscale's HTTPS path, so port `443` on the MagicDNS hostname works cleanly for those routes.
- HTTP mode is intended for web apps and APIs.
- TCP mode is intended for raw TCP services such as RPC ports or databases.
- If Tailscale Serve is not yet enabled for your tailnet, check the Tailscale package logs after adding an exposure.

## Upstream References

- [Start9 Packaging Guide](https://docs.start9.com/packaging/)
- [Tailscale Docker docs](https://tailscale.com/docs/features/containers/docker/how-to/connect-docker-standalone)
- [Tailscale quickstart](https://tailscale.com/kb/1346/start)
- [Tailscale favicon asset](https://tailscale.com/favicon.svg)
