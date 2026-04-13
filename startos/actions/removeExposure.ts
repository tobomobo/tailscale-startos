import { sdk } from '../sdk'
import {
  describeRoute,
  readGatewayConfig,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk

export const removeExposure = sdk.Action.withInput(
  'remove-serve',
  async () => ({
    name: 'Remove Serve',
    description:
      'Stop publishing one of the currently served StartOS services through Tailscale.',
    warning: 'This removes the selected Tailscale serve from this node.',
    allowedStatuses: 'any',
    group: 'Serve',
    visibility: 'enabled',
  }),
  async () => {
    const config = await readGatewayConfig()
    const values = Object.fromEntries(
      config.routes.map((route) => [route.id, describeRoute(route)]),
    )
    const defaultRoute = config.routes[0]?.id ?? 'no-routes'

    return InputSpec.of({
      routeId: Value.dynamicSelect(async () => ({
        name: 'Serve',
        description: 'Choose the saved serve you want to remove.',
        default: defaultRoute,
        values,
        disabled:
          config.routes.length > 0
            ? false
            : 'There are no saved Tailscale serves to remove.',
      })),
    })
  },
  async () => null,
  async ({ effects, input }) => {
    const config = await readGatewayConfig()
    const removedRoute = config.routes.find((route) => route.id === input.routeId)

    if (config.routes.length === 0) {
      throw new Error(
        'There are no saved Tailscale serves yet. Add one with the Add Serve action first.',
      )
    }

    if (!removedRoute) {
      throw new Error('That serve no longer exists.')
    }

    await writeGatewayConfig({
      version: 1,
      routes: config.routes.filter((route) => route.id !== input.routeId),
    })
    await syncExportedUrls(effects)

    return {
      version: '1' as const,
      title: 'Serve Removed',
      message:
        'This Tailscale node will stop serving that route within a few seconds.',
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
