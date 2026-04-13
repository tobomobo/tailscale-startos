import { sdk } from '../sdk'
import {
  describeRoute,
  refreshGatewayConfig,
} from '../lib/gatewayConfig'

export const refreshExposures = sdk.Action.withoutInput(
  'refresh-serves',
  async () => ({
    name: 'Refresh Targets',
    description:
      'Re-resolve the current container IP and interface details for every saved Tailscale serve.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Serve',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const { config, changed, failed } = await refreshGatewayConfig(effects)

    return {
      version: '1' as const,
      title: 'Targets Refreshed',
      message:
        config.routes.length === 0
          ? 'There are no saved serves yet.'
          : `Refreshed ${changed} saved serve${changed === 1 ? '' : 's'}.`,
      result:
        config.routes.length === 0 && failed.length === 0
          ? null
          : {
              type: 'group' as const,
              value: [
                ...config.routes.map((route) => ({
                  name: describeRoute(route),
                  description: 'Current saved route',
                  type: 'single' as const,
                  value: `${route.targetHost}:${route.targetPort}`,
                  copyable: false,
                  qr: false,
                  masked: false,
                })),
                ...failed.map((failure) => ({
                  name: 'Refresh Warning',
                  description: null,
                  type: 'single' as const,
                  value: failure,
                  copyable: false,
                  qr: false,
                  masked: false,
                })),
              ],
            },
    }
  },
)
