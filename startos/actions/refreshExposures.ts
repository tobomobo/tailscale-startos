import { sdk } from '../sdk'
import {
  describeRoute,
  refreshGatewayConfig,
} from '../lib/gatewayConfig'
import { routeDetailsForPlugin } from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

export const refreshExposures = sdk.Action.withoutInput(
  'refresh-exposures',
  async () => ({
    name: 'Refresh Targets',
    description:
      'Re-resolve the current container IP and interface details for every saved Tailscale exposure.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Gateway',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const { config, changed, failed } = await refreshGatewayConfig(effects)
    await syncExportedUrls(effects)

    const routeDetails = await Promise.all(
      config.routes.map(async (route) => ({
        route,
        details: await routeDetailsForPlugin(effects, route),
      })),
    )

    return {
      version: '1' as const,
      title: 'Targets Refreshed',
      message:
        config.routes.length === 0
          ? 'There are no saved exposures yet.'
          : `Refreshed ${changed} saved exposure${changed === 1 ? '' : 's'}.`,
      result:
        config.routes.length === 0 && failed.length === 0
          ? null
          : {
              type: 'group' as const,
              value: [
                ...routeDetails.map(({ route, details }) => ({
                  name: describeRoute(route),
                  description: 'Current saved route',
                  type: 'group' as const,
                  value: [
                    {
                      name: 'Current Target',
                      description: null,
                      type: 'single' as const,
                      value: `${route.targetHost}:${route.targetPort}`,
                      copyable: false,
                      qr: false,
                      masked: false,
                    },
                    {
                      name: 'Tailnet Address',
                      description:
                        details?.url
                          ? 'How this exposure is reached from other Tailscale devices.'
                          : 'This will appear after the gateway is connected and MagicDNS is available.',
                      type: 'single' as const,
                      value:
                        details?.url ??
                        'Available after Tailscale login completes',
                      copyable: Boolean(details?.url),
                      qr: false,
                      masked: false,
                    },
                  ],
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
