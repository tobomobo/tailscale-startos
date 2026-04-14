import { sdk } from '../sdk'
import {
  assertFunnelPort,
  decodeInterfaceKey,
  describeRoute,
  isFunnelMode,
  listCandidateInterfaces,
  readGatewayConfig,
  resolveExposureRoute,
  routeResultMembers,
  writeGatewayConfig,
} from '../lib/gatewayConfig'
import { explainCertError, readCertStatus } from '../lib/certInfo'
import { suggestedPublishedPortForBinding, routeDetailsForPlugin } from '../lib/tailscaleUrls'
import { syncExportedUrls } from '../urlPlugin'

const { InputSpec, Value } = sdk
const SERVE_MODES = [
  'https',
  'funnel',
  'http',
  'tls-terminated-tcp',
  'tcp',
] as const

async function suggestedPortForSelection(
  effects: Parameters<typeof sdk.getServiceManifest>[0],
  options: {
    target: string | null | undefined
    mode: (typeof SERVE_MODES)[number] | null | undefined
  },
): Promise<number> {
  const candidates = await listCandidateInterfaces(effects)
  const selectedCandidate =
    candidates.find((candidate) => candidate.key === options.target) ??
    candidates[0]
  const selectedMode =
    options.mode ??
    (selectedCandidate?.supportsHttp ? 'https' : 'tcp')

  if (!selectedCandidate) {
    return selectedMode === 'funnel' ? 443 : 80
  }

  const config = await readGatewayConfig()

  return suggestedPublishedPortForBinding(effects, {
    packageId: selectedCandidate.packageId,
    hostId: selectedCandidate.hostId,
    internalPort: selectedCandidate.internalPort,
    mode: selectedMode,
    existingRoutes: config.routes,
  })
}

export const addExposure = sdk.Action.withInput(
  'add-serve',
  async ({ effects }) => {
    const candidates = await listCandidateInterfaces(effects)

    return {
      name: 'Add Serve',
      description:
        'Publish one installed StartOS service interface through this Tailscale node using Tailscale Serve.',
      warning: null,
      allowedStatuses: 'any',
      group: 'Serve',
      visibility:
        candidates.length > 0
          ? 'enabled'
          : {
              disabled:
                'No installed StartOS service interfaces are currently available to serve.',
            },
    }
  },
  async ({ effects, prefill }) => {
    const value = prefill as
      | {
          target?: string
          mode?: (typeof SERVE_MODES)[number]
        }
      | null
    const candidates = await listCandidateInterfaces(effects)
    const values = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.key,
        `${candidate.packageTitle} - ${candidate.interfaceName}`,
      ]),
    )
    const defaultTarget =
      candidates.find((candidate) => candidate.key === value?.target)?.key ??
      candidates[0]?.key ??
      'no-targets-available'
    const defaultMode =
      SERVE_MODES.find((mode) => mode === value?.mode) ??
      (
        candidates.find((candidate) => candidate.key === defaultTarget)
          ?.supportsHttp
          ? 'https'
          : 'tcp'
      )
    const defaultExternalPort = await suggestedPortForSelection(effects, {
      target: defaultTarget,
      mode: defaultMode,
    })

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
        name: 'Serve Mode',
        description:
          "HTTPS serves web apps on this node's MagicDNS name with a Tailscale-managed TLS cert, visible only to your tailnet. Funnel publishes the same HTTPS endpoint on the PUBLIC INTERNET — only use it when you actually want anyone on the internet to be able to reach this service. Funnel is restricted to ports 443, 8443, and 10000.",
        default: defaultMode,
        values: {
          https: 'HTTPS (Tailscale Serve + managed TLS, tailnet-only)',
          funnel: 'Funnel (PUBLIC HTTPS on the open internet)',
          http: 'HTTP (Tailscale Serve, no TLS)',
          'tls-terminated-tcp': 'TLS-terminated TCP (Tailscale terminates TLS)',
          tcp: 'Raw TCP forwarder',
        },
      }),
      externalPort: Value.number({
        name: 'Published Port',
        description:
          'This is the port other Tailscale devices will use when they connect to this node.',
        default: defaultExternalPort,
        required: true,
        integer: true,
        min: 1,
        max: 65535,
      }),
    })
  },
  async ({ effects, prefill }) => {
    const value = prefill as
      | {
          target?: string
          mode?: (typeof SERVE_MODES)[number]
        }
      | null
    const candidates = await listCandidateInterfaces(effects)
    const target =
      candidates.find((candidate) => candidate.key === value?.target)?.key ??
      candidates[0]?.key ??
      null
    const mode =
      SERVE_MODES.find((candidateMode) => candidateMode === value?.mode) ??
      (
        candidates.find((candidate) => candidate.key === target)?.supportsHttp
          ? 'https'
          : 'tcp'
      )

    return {
      target,
      mode,
      externalPort: await suggestedPortForSelection(effects, { target, mode }),
    }
  },
  async ({ effects, input }) => {
    const config = await readGatewayConfig()
    const { packageId, interfaceId } = decodeInterfaceKey(input.target)

    if (isFunnelMode(input.mode)) {
      assertFunnelPort(input.externalPort)
    }

    if (
      config.routes.some((route) => route.externalPort === input.externalPort)
    ) {
      throw new Error(
        `Port ${input.externalPort} is already in use by another Tailscale serve.`,
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
        'That interface is already served with the selected mode. Remove it first if you want to change the published port.',
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

    const resultMembers = [
      ...routeResultMembers(route),
      {
        name: 'Tailnet Address',
        description:
          details?.url
            ? 'How this serve is reached from other Tailscale devices.'
            : 'This will appear after the gateway is connected and MagicDNS is available.',
        type: 'single' as const,
        value:
          details?.url ?? 'Available after Tailscale login completes',
        copyable: Boolean(details?.url),
        qr: false,
        masked: false,
      },
    ]

    let message =
      'If this Tailscale node is signed in and Tailscale Serve is enabled for your tailnet, the new serve should become available within a few seconds.'

    if (isFunnelMode(input.mode)) {
      message =
        'Saved. Funnel publishes this service on the PUBLIC INTERNET under this node\'s MagicDNS name. If Funnel is not enabled for your tailnet in the Tailscale admin console, the serve will fail to come up — check the Tailscale package logs for the exact error.'
    }

    if (input.mode === 'https' || input.mode === 'funnel') {
      const cert = await readCertStatus()
      if (cert.error) {
        resultMembers.push({
          name: 'HTTPS Certificate Warning',
          description: explainCertError(cert.error),
          type: 'single' as const,
          value: cert.error,
          copyable: true,
          qr: false,
          masked: false,
        })
        message = `Saved, but HTTPS certificate provisioning is currently failing for this node. ${explainCertError(cert.error)}`
      }
    }

    return {
      version: '1' as const,
      title: 'Serve Saved',
      message,
      result: {
        type: 'group' as const,
        value: [
          {
            name: describeRoute(route),
            description: null,
            type: 'group' as const,
            value: resultMembers,
          },
        ],
      },
    }
  },
)
