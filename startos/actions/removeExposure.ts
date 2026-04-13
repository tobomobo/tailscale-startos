import { sdk } from '../sdk'
import {
  describeRoute,
  readGatewayConfig,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk

export const removeExposure = sdk.Action.withInput(
  'remove-exposure',
  async () => {
    const config = await readGatewayConfig()

    return {
      name: 'Remove Exposure',
      description:
        'Stop publishing one of the currently exposed StartOS services through Tailscale.',
      warning:
        config.routes.length > 0
          ? 'This removes the selected Tailscale exposure from this gateway node.'
          : null,
      allowedStatuses: 'any',
      group: 'Gateway',
      visibility:
        config.routes.length > 0
          ? 'enabled'
          : { disabled: 'There are no saved Tailscale exposures to remove.' },
    }
  },
  async () => {
    const config = await readGatewayConfig()
    const values = Object.fromEntries(
      config.routes.map((route) => [route.id, describeRoute(route)]),
    )
    const defaultRoute = config.routes[0]?.id ?? 'no-routes'

    return InputSpec.of({
      routeId: Value.dynamicSelect(async () => ({
        name: 'Exposure',
        description: 'Choose the saved exposure you want to remove.',
        default: defaultRoute,
        values,
        disabled:
          config.routes.length > 0
            ? false
            : 'There are no saved Tailscale exposures to remove.',
      })),
    })
  },
  async () => null,
  async ({ effects, input }) => {
    const config = await readGatewayConfig()
    const removedRoute = config.routes.find((route) => route.id === input.routeId)

    if (!removedRoute) {
      throw new Error('That exposure no longer exists.')
    }

    await writeGatewayConfig({
      version: 1,
      routes: config.routes.filter((route) => route.id !== input.routeId),
    })
    await syncExportedUrls(effects)

    return {
      version: '1' as const,
      title: 'Exposure Removed',
      message:
        'The Tailscale gateway will stop serving that route within a few seconds.',
      result: {
        type: 'single' as const,
        value: describeRoute(removedRoute),
        copyable: false,
        qr: false,
        masked: false,
      },
    }
  },
)
