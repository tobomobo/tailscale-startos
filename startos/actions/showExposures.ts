import { sdk } from '../sdk'
import {
  describeRoute,
  readGatewayConfig,
  routeResultMembers,
} from '../lib/gatewayConfig'
import { routeDetailsForPlugin } from '../lib/tailscaleUrls'

export const showExposures = sdk.Action.withoutInput(
  'show-exposures',
  async () => ({
    name: 'Show Exposures',
    description:
      'Display the StartOS services currently being published through this Tailscale node.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Gateway',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const config = await readGatewayConfig()

    if (config.routes.length === 0) {
      return {
        version: '1' as const,
        title: 'No Exposures',
        message:
          'No StartOS services are currently being published through this Tailscale gateway.',
        result: null,
      }
    }

    return {
      version: '1' as const,
      title: 'Current Exposures',
      message:
        'These routes are served from this single Tailscale node after you sign the package into your tailnet.',
      result: {
        type: 'group' as const,
        value: await Promise.all(
          config.routes.map(async (route) => {
            const details = await routeDetailsForPlugin(effects, route)

            return {
              name: describeRoute(route),
              description: null,
              type: 'group' as const,
              value: [
                ...routeResultMembers(route),
                {
                  name: 'Tailnet Address',
                  description:
                    details?.url
                      ? 'How this exposure is reached from other Tailscale devices.'
                      : 'This will appear after the gateway is connected and MagicDNS is available.',
                  type: 'single' as const,
                  value:
                    details?.url ?? 'Available after Tailscale login completes',
                  copyable: Boolean(details?.url),
                  qr: false,
                  masked: false,
                },
              ],
            }
          }),
        ),
      },
    }
  },
)
