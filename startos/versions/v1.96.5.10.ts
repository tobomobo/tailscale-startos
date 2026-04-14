import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_10 = VersionInfo.of({
  version: '1.96.5:10',
  releaseNotes: {
    en_US:
      'Fixes the url-v0 "Serve On Tailscale" quick action so normal package interface tables pass their metadata correctly, adds an editable published-port field to that quick flow, and replaces the raw missing-metadata error for unsupported System Settings targets with a clearer explanation of the current StartOS SDK limitation.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
