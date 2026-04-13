import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_4 = VersionInfo.of({
  version: '1.96.5:4',
  releaseNotes: {
    en_US:
      'Makes login-link generation reliable on startup, surfaces auth-link failures directly in the UI, fixes HTTPS exposure target detection, and repairs the GitHub packaging workflows for arch-specific .s9pk artifacts.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
