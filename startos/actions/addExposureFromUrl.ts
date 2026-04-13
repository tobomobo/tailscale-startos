import { sdk } from '../sdk'
import {
  readGatewayConfig,
  resolveExposureRoute,
  routeResultMembers,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
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
  'add-serve-from-url',
  async () => ({
    name: 'Serve On Tailscale',
    description:
      'Quickly serve this interface through the Tailscale node using a sensible default port.',
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
        title: 'Already Serving',
        message:
          'This service already has a Tailscale serve managed by the gateway package.',
        result: {
          type: 'group' as const,
          value: [
            {
              name: 'Existing Serve',
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
    const supportsHttp =
      serviceInterface.addressInfo.scheme?.startsWith('http') ||
      serviceInterface.addressInfo.sslScheme?.startsWith('http')
    const mode = supportsHttp ? 'https' : 'tcp'

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
      title: 'Tailscale Serve Added',
      message:
        'The gateway saved a default Tailscale serve for this interface. Use the main Serve actions if you want a custom port or mode instead.',
      result: {
        type: 'group' as const,
        value: [
          {
            name: 'New Serve',
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
