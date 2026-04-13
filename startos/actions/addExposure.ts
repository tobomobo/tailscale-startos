import { sdk } from '../sdk'
import {
  decodeInterfaceKey,
  describeRoute,
  listCandidateInterfaces,
  readGatewayConfig,
  resolveExposureRoute,
  routeResultMembers,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
import { routeDetailsForPlugin } from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk

export const addExposure = sdk.Action.withInput(
  'add-exposure',
  async ({ effects }) => {
    const candidates = await listCandidateInterfaces(effects)

    return {
      name: 'Add Exposure',
      description:
        'Publish one installed StartOS service interface through this Tailscale node.',
      warning: null,
      allowedStatuses: 'any',
      group: 'Gateway',
      visibility:
        candidates.length > 0
          ? 'enabled'
          : {
              disabled:
                'No installed StartOS service interfaces are currently available to expose.',
            },
    }
  },
  async ({ effects }) => {
    const candidates = await listCandidateInterfaces(effects)
    const values = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.key,
        `${candidate.packageTitle} - ${candidate.interfaceName}`,
      ]),
    )
    const defaultTarget =
      candidates[0]?.key ?? 'no-targets-available'

    return InputSpec.of({
      target: Value.dynamicSelect(async () => ({
        name: 'Target Interface',
        description:
          'Pick the StartOS service interface that should be reachable over Tailscale.',
        default: defaultTarget,
        values,
        disabled:
          candidates.length > 0
            ? false
            : 'No target interfaces are available right now.',
      })),
      mode: Value.select({
        name: 'Exposure Mode',
        description:
          'HTTP is best for web apps. TCP is best for databases, RPC ports, and non-HTTP services.',
        default: 'http',
        values: {
          http: 'HTTP reverse proxy',
          tcp: 'Raw TCP forwarder',
        },
      }),
      externalPort: Value.number({
        name: 'Published Port',
        description:
          'This is the port other Tailscale devices will use when they connect to this gateway node.',
        default: 3000,
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
    const { packageId, interfaceId } = decodeInterfaceKey(input.target)

    if (
      config.routes.some((route) => route.externalPort === input.externalPort)
    ) {
      throw new Error(
        `Port ${input.externalPort} is already in use by another Tailscale exposure.`,
      )
    }

    if (
      config.routes.some(
        (route) =>
          route.packageId === packageId &&
          route.interfaceId === interfaceId &&
          route.mode === input.mode,
      )
    ) {
      throw new Error(
        'That interface is already exposed with the selected mode. Remove it first if you want to change the published port.',
      )
    }

    const route = await resolveExposureRoute(effects, {
      packageId,
      interfaceId,
      mode: input.mode,
      externalPort: input.externalPort,
      existingRoutes: config.routes,
    })

    const nextConfig = {
      version: 1 as const,
      routes: [...config.routes, route],
    }

    await writeGatewayConfig(nextConfig)
    await syncExportedUrls(effects)
    const details = await routeDetailsForPlugin(effects, route)

    return {
      version: '1' as const,
      title: 'Exposure Saved',
      message:
        'If this Tailscale node is signed in and Tailscale Serve is enabled for your tailnet, the new route should become available within a few seconds.',
      result: {
        type: 'group' as const,
        value: [
          {
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
          },
        ],
      },
    }
  },
)
