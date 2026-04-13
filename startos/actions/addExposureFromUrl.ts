import { sdk } from '../sdk'
import {
  routeResultMembers,
} from '../lib/gatewayConfig'
import { readGatewayConfig, resolveExposureRoute, writeGatewayConfig } from '../lib/gatewayConfig'
import {
  chooseSuggestedExternalPort,
  defaultExternalPortForInterface as defaultTailnetPort,
  findRouteByBinding,
  routeDetailsForPlugin,
  type UrlPluginTableMetadata,
} from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

function pluginMetadataFromInput(input: unknown): UrlPluginTableMetadata {
  const metadata = (input as { urlPluginMetadata?: UrlPluginTableMetadata })
    .urlPluginMetadata

  if (
    !metadata?.packageId ||
    !metadata.interfaceId ||
    !metadata.hostId ||
    typeof metadata.internalPort !== 'number'
  ) {
    throw new Error('This Tailscale URL-plugin action is missing its target metadata.')
  }

  return metadata
}

export const addExposureFromUrl = sdk.Action.withoutInput(
  'add-exposure-from-url',
  async () => ({
    name: 'Add Tailscale Address',
    description:
      'Quickly publish this interface through the Tailscale gateway using a sensible default port.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'hidden',
  }),
  async ({ effects, input }) => {
    const metadata = pluginMetadataFromInput(input)
    const existingRoute = await findRouteByBinding(effects, metadata)

    if (existingRoute) {
      const existingDetails = await routeDetailsForPlugin(effects, existingRoute)

      return {
        version: '1' as const,
        title: 'Already Published',
        message:
          'This service already has a Tailscale exposure managed by the gateway package.',
        result: {
          type: 'group' as const,
          value: [
            {
              name: 'Existing Exposure',
              description: null,
              type: 'group' as const,
              value: [
                ...routeResultMembers(existingRoute),
                {
                  name: 'Tailnet Address',
                  description:
                    existingDetails?.url
                      ? 'How this service is reached from other Tailscale devices.'
                      : 'This will appear after the gateway is connected and MagicDNS is available.',
                  type: 'single' as const,
                  value:
                    existingDetails?.url ??
                    'Available after Tailscale login completes',
                  copyable: Boolean(existingDetails?.url),
                  qr: false,
                  masked: false,
                },
              ],
            },
          ],
        },
      }
    }

    const serviceInterface = await sdk.serviceInterface
      .get(effects, {
        packageId: metadata.packageId,
        id: metadata.interfaceId,
      })
      .once()

    if (!serviceInterface?.addressInfo) {
      throw new Error('That service interface is not available right now.')
    }

    const config = await readGatewayConfig()
    const mode =
      serviceInterface.addressInfo.scheme?.startsWith('http') ||
      serviceInterface.addressInfo.sslScheme?.startsWith('http')
        ? 'http'
        : 'tcp'

    const suggestedPort = chooseSuggestedExternalPort(
      config.routes,
      defaultTailnetPort(serviceInterface.addressInfo),
    )

    const route = await resolveExposureRoute(effects, {
      packageId: metadata.packageId,
      interfaceId: metadata.interfaceId,
      mode,
      externalPort: suggestedPort,
      existingRoutes: config.routes,
    })

    await writeGatewayConfig({
      version: 1,
      routes: [...config.routes, route],
    })
    await syncExportedUrls(effects)

    const details = await routeDetailsForPlugin(effects, route)

    return {
      version: '1' as const,
      title: 'Tailscale Exposure Added',
      message:
        'The gateway saved a default Tailscale exposure for this interface. Use the main Gateway actions if you want a custom port or mode instead.',
      result: {
        type: 'group' as const,
        value: [
          {
            name: 'New Exposure',
            description: null,
            type: 'group' as const,
            value: [
              ...routeResultMembers(route),
              {
                name: 'Tailnet Address',
                description:
                  details?.url
                    ? 'How this service is reached from other Tailscale devices.'
                    : 'This will appear after the gateway is connected and MagicDNS is available.',
                type: 'single' as const,
                value:
                  details?.url ?? 'Available after Tailscale login completes',
                copyable: Boolean(details?.url),
                qr: false,
                masked: false,
              },
            ],
          },
        ],
      },
    }
  },
)
