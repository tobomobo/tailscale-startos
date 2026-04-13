import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_8 = VersionInfo.of({
  version: '1.96.5:8',
  releaseNotes: {
    en_US:
      'Renames package UX to match Tailscale terminology: "Serve" replaces "Exposure" everywhere, action group is now "Serve". Adds explicit HTTPS, HTTP, TLS-terminated TCP, and raw TCP serve modes, plus a periodic Tailscale HTTPS certificate probe that surfaces admin-console configuration errors directly in the Show Device Info and Add Serve actions.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
