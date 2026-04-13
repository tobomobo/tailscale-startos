import { sdk } from '../sdk'
import { describeRoute, readGatewayConfig, writeGatewayConfig } from '../lib/gatewayConfig'
import type { UrlPluginRowMetadata } from '../lib/tailscaleUrls'
import { findRouteByBinding } from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

function pluginMetadataFromInput(input: unknown): UrlPluginRowMetadata {
  const metadata = (input as { urlPluginMetadata?: UrlPluginRowMetadata })
    .urlPluginMetadata

  if (
    !metadata?.packageId ||
    !metadata.interfaceId ||
    !metadata.hostId ||
    typeof metadata.internalPort !== 'number'
  ) {
    throw new Error('This Tailscale URL-plugin action is missing its route metadata.')
  }

  return metadata
}

export const removeExposureFromUrl = sdk.Action.withoutInput(
  'remove-exposure-from-url',
  async () => ({
    name: 'Remove Tailscale Address',
    description:
      'Stop publishing this interface through the Tailscale gateway package.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'hidden',
  }),
  async ({ effects, input }) => {
    const metadata = pluginMetadataFromInput(input)
    const config = await readGatewayConfig()
    const routeId = (metadata.info as { routeId?: string } | null)?.routeId
    const route =
      config.routes.find((candidate) => candidate.id === routeId) ??
      (await findRouteByBinding(effects, metadata))

    if (!route) {
      throw new Error('That Tailscale exposure no longer exists.')
    }

    await writeGatewayConfig({
      version: 1,
      routes: config.routes.filter((candidate) => candidate.id !== route.id),
    })
    await syncExportedUrls(effects)

    return {
      version: '1' as const,
      title: 'Tailscale Exposure Removed',
      message:
        'The gateway will stop publishing this interface over Tailscale within a few seconds.',
      result: {
        type: 'single' as const,
        value: describeRoute(route),
        copyable: false,
        qr: false,
        masked: false,
      },
    }
  },
)
