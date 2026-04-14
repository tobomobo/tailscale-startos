import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_11 = VersionInfo.of({
  version: '1.96.5:11',
  releaseNotes: {
    en_US:
      'Fixes the url-v0 "Serve On Tailscale" quick action so normal package interface tables pass their metadata correctly, adds an editable published-port field to that quick flow, replaces the raw missing-metadata error for unsupported System Settings targets with a clearer explanation of the current StartOS SDK limitation, and improves suggested serve ports by defaulting to each interface\'s own advertised local service port with the nearest free port used only when that exact port is already taken.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
