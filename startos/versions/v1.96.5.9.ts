import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_9 = VersionInfo.of({
  version: '1.96.5:9',
  releaseNotes: {
    en_US:
      'Adds Tailscale Funnel as an Add Serve mode for publishing services on the public internet (ports 443/8443/10000 only, with prominent warnings). Adds Edit Serve for changing the published port on a saved serve without remove+add. Fixes Remove Serve always reporting "no saved serves to remove" even when serves existed. Fixes the url-v0 plugin buttons ("Serve On Tailscale" / "Stop Tailscale Serve") which referenced stale action IDs and returned 404 after the rename. Funnel routes are now correctly flagged as public in the exported URL metadata. Apply loop now resets funnel state in addition to serve state, collects per-route errors instead of aborting on the first failure, surfaces apply failures in the package logs with backoff, and cleans up SIGTERM handling. Release workflow now uses the correct start-cli binary for registry publishing.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
