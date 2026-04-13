import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_2 = VersionInfo.of({
  version: '1.96.5:2',
  releaseNotes: {
    en_US:
      'Removes the broken Open UI surface and makes the login-link actions re-request authentication links automatically when needed.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
