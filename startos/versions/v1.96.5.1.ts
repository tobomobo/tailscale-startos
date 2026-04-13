import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_1 = VersionInfo.of({
  version: '1.96.5:1',
  releaseNotes: {
    en_US:
      'Updates the package to Tailscale v1.96.5 and adds device-independent login link actions alongside the gateway exposure workflow.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
