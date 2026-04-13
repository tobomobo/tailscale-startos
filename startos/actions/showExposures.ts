import { sdk } from '../sdk'
import {
  describeRoute,
  readGatewayConfig,
  routeResultMembers,
} from '../lib/gatewayConfig'
import { readCertStatus, explainCertError } from '../lib/certInfo'
import { readTailnetHostname, tailnetUrlResult, buildTailnetUrl } from '../lib/tailscaleUrls'

export const showExposures = sdk.Action.withoutInput(
  'show-serves',
  async () => ({
    name: 'Show Serves',
    description:
      'Display the StartOS services currently being served through this Tailscale node.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Serve',
    visibility: 'enabled',
  }),
  async () => {
    const config = await readGatewayConfig()
    const dnsName = await readTailnetHostname()
    const cert = await readCertStatus()

    const headerMembers: Array<{
      name: string
      description: string | null
      type: 'single'
      value: string
      copyable: boolean
      qr: boolean
      masked: false
    }> = []

    if (cert.error) {
      headerMembers.push({
        name: 'HTTPS Certificate Warning',
        description: explainCertError(cert.error),
        type: 'single',
        value: cert.error,
        copyable: true,
        qr: false,
        masked: false,
      })
    }

    if (config.routes.length === 0) {
      return {
        version: '1' as const,
        title: 'No Serves',
        message:
          'No StartOS services are currently being served through this Tailscale node.',
        result:
          headerMembers.length > 0
            ? { type: 'group' as const, value: headerMembers }
            : null,
      }
    }

    return {
      version: '1' as const,
      title: 'Current Serves',
      message:
        'These routes are served from this Tailscale node after the package is signed into your tailnet, using its MagicDNS name when available.',
      result: {
        type: 'group' as const,
        value: [
          ...headerMembers,
          ...config.routes.map((route) => ({
            name: describeRoute(route),
            description: null,
            type: 'group' as const,
            value: [
              ...routeResultMembers(route),
              tailnetUrlResult(
                route,
                dnsName ? buildTailnetUrl(route, dnsName) : null,
              ),
            ],
          })),
        ],
      },
    }
  },
)
