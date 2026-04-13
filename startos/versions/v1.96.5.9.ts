import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_9 = VersionInfo.of({
  version: '1.96.5:9',
  releaseNotes: {
    en_US:
      'Adds Tailscale Funnel as an Add Serve mode for publishing services on the public internet, restricted to ports 443/8443/10000 with prominent warnings. Adds Edit Serve for changing the published port on a saved serve without remove+add. Fixes Remove Serve always reporting "no saved serves to remove" even when serves existed.',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
