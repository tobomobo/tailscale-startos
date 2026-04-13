import { sdk } from '../sdk'
import {
  assertFunnelPort,
  describeRoute,
  isFunnelMode,
  readGatewayConfig,
  resolveExposureRoute,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk

export const editExposure = sdk.Action.withInput(
  'edit-serve',
  async () => ({
    name: 'Edit Serve',
    description:
      'Change the published port on a saved Tailscale serve. To change the mode, remove the serve and add it again.',
    warning:
      'The serve will briefly stop while the Tailscale node re-publishes it on the new port.',
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
    const defaultPort = config.routes[0]?.externalPort ?? 443

    return InputSpec.of({
      routeId: Value.dynamicSelect(async () => ({
        name: 'Serve',
        description: 'Choose the saved serve you want to edit.',
        default: defaultRoute,
        values,
        disabled:
          config.routes.length > 0
            ? false
            : 'There are no saved Tailscale serves to edit.',
      })),
      externalPort: Value.number({
        name: 'New Published Port',
        description:
          'The port other Tailscale devices should use to reach this serve.',
        default: defaultPort,
        required: true,
        integer: true,
        min: 1,
        max: 65535,
      }),
    })
  },
  async () => null,
  async ({ effects, input }) => {
    const config = await readGatewayConfig()

    if (config.routes.length === 0) {
      throw new Error(
        'There are no saved Tailscale serves yet. Add one with the Add Serve action first.',
      )
    }

    const existing = config.routes.find((route) => route.id === input.routeId)
    if (!existing) {
      throw new Error('That serve no longer exists.')
    }

    if (isFunnelMode(existing.mode)) {
      assertFunnelPort(input.externalPort)
    }

    if (existing.externalPort === input.externalPort) {
      return {
        version: '1' as const,
        title: 'No Change',
        message: 'That serve is already published on the selected port.',
        result: null,
      }
    }

    if (
      config.routes.some(
        (route) =>
          route.id !== existing.id && route.externalPort === input.externalPort,
      )
    ) {
      throw new Error(
        `Port ${input.externalPort} is already in use by another Tailscale serve.`,
      )
    }

    const otherRoutes = config.routes.filter((route) => route.id !== existing.id)
    const updated = await resolveExposureRoute(effects, {
      packageId: existing.packageId,
      interfaceId: existing.interfaceId,
      mode: existing.mode,
      externalPort: input.externalPort,
      existingRoutes: otherRoutes,
      localPort: existing.localPort,
    })

    await writeGatewayConfig({
      version: 1,
      routes: [...otherRoutes, updated],
    })
    await syncExportedUrls(effects)

    return {
      version: '1' as const,
      title: 'Serve Updated',
      message:
        'The Tailscale node will re-publish this serve on the new port within a few seconds.',
      result: {
        type: 'single' as const,
        value: describeRoute(updated),
        copyable: false,
        qr: false,
        masked: false,
      },
    }
  },
)
