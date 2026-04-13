import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_92_5_2 = VersionInfo.of({
  version: '1.92.5:2',
  releaseNotes: {
    en_US:
      'Adds StartOS service gateway actions so one Tailscale sign-in can publish selected installed services through this package.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
