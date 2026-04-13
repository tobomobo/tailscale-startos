import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_5 = VersionInfo.of({
  version: '1.96.5:5',
  releaseNotes: {
    en_US:
      'Fixes the startup readiness gate so automatic login-link generation actually runs, and surfaces the auth URL from live Tailscale status as soon as it becomes available.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
