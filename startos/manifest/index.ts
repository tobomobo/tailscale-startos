import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'tailscale',
  title: 'Tailscale',
  license: 'MIT',
  packageRepo: 'https://github.com/tobomobo/tailscale-startos',
  upstreamRepo: 'https://github.com/tailscale/tailscale',
  marketingUrl: 'https://tailscale.com/',
  donationUrl: null,
  docsUrls: [
    'https://tailscale.com/docs/features/containers/docker/how-to/connect-docker-standalone',
    'https://tailscale.com/docs/reference/tailscale-cli',
    'https://tailscale.com/docs/features/client/device-web-interface',
    'https://tailscale.com/kb/1346/start',
  ],
  description: { short, long },
  volumes: ['main'],
  images: {
    tailscale: {
      source: {
        dockerBuild: {
          dockerfile: './Dockerfile',
        },
      },
      arch: ['x86_64', 'aarch64', 'riscv64'],
    },
  },
  alerts: {
    install: null,
    update: null,
    uninstall: null,
    restore: null,
    start: null,
    stop: null,
  },
  plugins: ['url-v0'],
  dependencies: {},
})
