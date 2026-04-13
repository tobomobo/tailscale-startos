import type { HealthCheckResult } from '@start9labs/start-sdk/package/lib/health/checkFns'
import { i18n } from './i18n'
import { readDeviceName } from './lib/deviceName'
import { refreshGatewayConfig } from './lib/gatewayConfig'
import { sdk } from './sdk'

export const main = sdk.setupMain(async ({ effects }) => {
  const refresh = await refreshGatewayConfig(effects)
  const deviceName = await readDeviceName()
  const tailscaleSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'tailscale' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/var/lib/tailscale',
      readonly: false,
    }),
    'tailscale-sub',
  )

  console.info(i18n('Starting Tailscale'))
  if (refresh.changed > 0) {
    console.info(
      `Refreshed ${refresh.changed} saved Tailscale exposure target${
        refresh.changed === 1 ? '' : 's'
      }.`,
    )
  }
  for (const failure of refresh.failed) {
    console.warn(failure)
  }

  const checkTailscaleHealth = async (): Promise<HealthCheckResult> => {
    const res = await tailscaleSub.exec(
      [
        'tailscale',
        '--socket=/var/run/tailscale/tailscaled.sock',
        'status',
        '--json',
      ],
      {},
      5000,
    )

    if (res.exitCode !== 0) {
      return {
        result: 'failure',
        message: i18n('Tailscaled is not ready'),
      }
    }

    try {
      const status = JSON.parse(String(res.stdout)) as {
        BackendState?: string
      }

      switch (status.BackendState) {
        case 'Running':
          return {
            result: 'success',
            message: i18n('Tailscaled is running'),
          }
        case 'NeedsLogin':
        case 'NeedsMachineAuth':
          return {
            result: 'success',
            message: i18n('Tailscale is waiting for login'),
          }
        case 'Starting':
        case 'NoState':
          return {
            result: 'loading',
            message: i18n('Tailscaled is starting'),
          }
        default:
          return {
            result: 'loading',
            message: status.BackendState
              ? `Tailscale state: ${status.BackendState}`
              : i18n('Tailscaled is starting'),
          }
      }
    } catch {
      return {
        result: 'failure',
        message: i18n('Tailscaled is not ready'),
      }
    }
  }

  return sdk.Daemons.of(effects).addDaemon('primary', {
    subcontainer: tailscaleSub,
    exec: {
      command: ['/usr/local/bin/docker_entrypoint.sh'],
      env: deviceName ? { TAILSCALE_DEVICE_NAME: deviceName } : {},
    },
    ready: {
      display: i18n('Tailscale Daemon'),
      fn: checkTailscaleHealth,
    },
    requires: [],
  })
})
