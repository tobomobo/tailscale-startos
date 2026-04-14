import { sdk } from '../sdk'
import { describeRoute, readGatewayConfig, writeGatewayConfig } from '../lib/gatewayConfig'
import type { UrlPluginRowMetadata } from '../lib/tailscaleUrls'
import { findRouteByBinding } from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  urlPluginMetadata: Value.hidden(),
})

function unsupportedTargetResult() {
  return {
    version: '1' as const,
    title: 'Unsupported Target',
    message:
      'This Tailscale URL entry did not come from a normal package service interface exposed through the StartOS SDK, so it cannot be removed through the url-v0 quick action.',
    result: null,
  }
}

function pluginMetadataFromInput(metadata: unknown): UrlPluginRowMetadata {
  const value = metadata as UrlPluginRowMetadata | null | undefined

  if (
    !value?.packageId ||
    !value.interfaceId ||
    !value.hostId ||
    typeof value.internalPort !== 'number'
  ) {
    throw new Error('This Tailscale URL-plugin action is missing its route metadata.')
  }

  return value
}

export const removeExposureFromUrl = sdk.Action.withInput(
  'remove-serve-from-url',
  async () => ({
    name: 'Stop Tailscale Serve',
    description:
      'Stop serving this interface through the Tailscale gateway package.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'hidden',
  }),
  inputSpec,
  async () => ({
    urlPluginMetadata: null,
  }),
  async ({ effects, input }) => {
    if (!input.urlPluginMetadata) {
      return unsupportedTargetResult()
    }

    const metadata = pluginMetadataFromInput(input.urlPluginMetadata)
    const config = await readGatewayConfig()
    const routeId = (metadata.info as { routeId?: string } | null)?.routeId
    const route =
      config.routes.find((candidate) => candidate.id === routeId) ??
      (await findRouteByBinding(effects, metadata))

    if (!route) {
      throw new Error('That Tailscale serve no longer exists.')
    }

    await writeGatewayConfig({
      version: 1,
      routes: config.routes.filter((candidate) => candidate.id !== route.id),
    })
    await syncExportedUrls(effects)

    return {
      version: '1' as const,
      title: 'Tailscale Serve Removed',
      message:
        'This node will stop serving that interface over Tailscale within a few seconds.',
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
