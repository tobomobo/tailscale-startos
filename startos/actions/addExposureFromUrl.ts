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

const { InputSpec, Value } = sdk

function optionalPluginMetadataFromInput(
  metadata: unknown,
): UrlPluginTableMetadata | null {
  const value = metadata as UrlPluginTableMetadata | null | undefined

  if (
    !value?.packageId ||
    !value.interfaceId ||
    !value.hostId ||
    typeof value.internalPort !== 'number'
  ) {
    return null
  }

  return value
}

async function suggestedPortForMetadata(
  effects: Parameters<typeof sdk.getServiceManifest>[0],
  metadata: UrlPluginTableMetadata | null,
): Promise<number> {
  const config = await readGatewayConfig()

  if (!metadata) {
    return chooseSuggestedExternalPort(config.routes, 443)
  }

  const serviceInterface = await sdk.serviceInterface
    .get(effects, {
      packageId: metadata.packageId,
      id: metadata.interfaceId,
    })
    .once()

  const preferredPort =
    serviceInterface?.addressInfo
      ? defaultTailnetPort(serviceInterface.addressInfo)
      : metadata.internalPort

  return chooseSuggestedExternalPort(config.routes, preferredPort)
}

function unsupportedTargetResult() {
  return {
    version: '1' as const,
    title: 'Unsupported Target',
    message:
      'StartOS currently only exposes enough url-v0 metadata for normal package service interfaces. The System Settings / StartOS UI screen is not exposed through the public SDK in a stable way yet, so this package cannot reliably add a Tailscale serve from there.',
    result: null,
  }
}

function pluginMetadataFromInput(metadata: unknown): UrlPluginTableMetadata {
  const value = optionalPluginMetadataFromInput(metadata)

  if (!value) {
    throw new Error(
      'This Tailscale URL-plugin action was called without a supported package-interface target.',
    )
  }

  return value
}

export const addExposureFromUrl = sdk.Action.withInput(
  'add-serve-from-url',
  async () => ({
    name: 'Serve On Tailscale',
    description:
      'Quickly serve this interface through the Tailscale node with an editable published port and an automatic serve mode.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'hidden',
  }),
  async ({ effects, prefill }) => {
    const metadata = optionalPluginMetadataFromInput(
      (prefill as { urlPluginMetadata?: unknown } | null)?.urlPluginMetadata,
    )
    const suggestedPort = await suggestedPortForMetadata(effects, metadata)

    return InputSpec.of({
      urlPluginMetadata: Value.hidden(),
      externalPort: Value.number({
        name: 'Published Port',
        description:
          'Other Tailscale devices will connect to this node on this port.',
        default: suggestedPort,
        required: true,
        integer: true,
        min: 1,
        max: 65535,
      }),
    })
  },
  async ({ effects, prefill }) => {
    const metadata = optionalPluginMetadataFromInput(
      (prefill as { urlPluginMetadata?: unknown } | null)?.urlPluginMetadata,
    )

    return {
      urlPluginMetadata: metadata,
      externalPort: await suggestedPortForMetadata(effects, metadata),
    }
  },
  async ({ effects, input }) => {
    if (!optionalPluginMetadataFromInput(input.urlPluginMetadata)) {
      return unsupportedTargetResult()
    }

    const metadata = pluginMetadataFromInput(input.urlPluginMetadata)
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

    if (
      config.routes.some((route) => route.externalPort === input.externalPort)
    ) {
      throw new Error(
        `Port ${input.externalPort} is already in use by another Tailscale serve.`,
      )
    }

    const route = await resolveExposureRoute(effects, {
      packageId: metadata.packageId,
      interfaceId: metadata.interfaceId,
      mode,
      externalPort: input.externalPort,
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
        'The gateway saved a Tailscale serve for this interface with the selected published port. Use the main Serve actions if you want a different mode instead.',
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
