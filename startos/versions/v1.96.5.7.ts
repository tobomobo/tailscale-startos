import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_7 = VersionInfo.of({
  version: '1.96.5:7',
  releaseNotes: {
    en_US:
      'Adds a saved Tailscale device-name override, publishes exposed service URLs through the StartOS url-v0 plugin, and uses Tailscale HTTPS for web interfaces that already advertise SSL so 443-based MagicDNS URLs work cleanly.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
