import { VersionInfo } from '@start9labs/start-sdk'

export const v_1_96_5_9 = VersionInfo.of({
  version: '1.96.5:9',
  releaseNotes: {
    en_US:
      'Initial public release of Tailscale on StartOS. Provides a persistent Tailscale node with Tailscale Serve for publishing installed StartOS service interfaces over your tailnet in HTTPS (managed TLS), HTTP, TLS-terminated TCP, and raw TCP modes, plus optional Tailscale Funnel for publishing on the public internet over 443/8443/10000. Includes Add / Edit / Remove / Show Serves actions, an HTTPS certificate probe that surfaces the Tailscale error if HTTPS is not enabled on your tailnet, a persisted device-name override, and url-v0 plugin integration so served routes appear back in other packages\' URL tables. One device-independent sign-in covers the whole package. Supported arches: x86_64 and aarch64 (upstream Tailscale container does not publish riscv64).',
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
