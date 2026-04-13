import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_6 = VersionInfo.of({
  version: '1.96.5:6',
  releaseNotes: {
    en_US:
      'Makes the connected state take precedence over stale login QR links and adds the required MIT plus third-party Tailscale licensing notices for this packaging repository.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
