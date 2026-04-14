import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_12 = VersionInfo.of({
  version: '1.96.5:12',
  releaseNotes: {
    en_US: [
      '- For normal serves, suggested ports now follow the StartOS host-facing local port assignment when available.',
      '- If that exact port is already taken, the nearest free port is suggested instead.',
      '- Funnel suggestions remain constrained to Tailscale\'s allowed ports (443, 8443, 10000).',
      '- README wording is updated to match the new default-port behavior.',
    ].join('\n'),
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
