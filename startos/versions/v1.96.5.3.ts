import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_3 = VersionInfo.of({
  version: '1.96.5:3',
  releaseNotes: {
    en_US:
      'Adds a device-info action that shows the gateway node state, MagicDNS name, tailnet details, and assigned Tailscale IPs in the StartOS UI.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
