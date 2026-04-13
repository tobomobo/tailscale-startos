import { readDeviceName } from '../lib/deviceName'
import { readCertStatus, explainCertError } from '../lib/certInfo'
import { readStatusInfo } from '../lib/loginInfo'
import { sdk } from '../sdk'
import { syncExportedUrls } from '../urlPlugin'

export const showDeviceInfo = sdk.Action.withoutInput(
  'show-device-info',
  async () => ({
    name: 'Show Device Info',
    description:
      'Display the current Tailscale node details for this StartOS gateway, including MagicDNS and assigned Tailscale IPs.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Access',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const [status, preferredDeviceName, cert] = await Promise.all([
      readStatusInfo(),
      readDeviceName(),
      readCertStatus(),
    ])

    if (!status) {
      return {
        version: '1' as const,
        title: 'Device Info Not Ready',
        message:
          'The Tailscale daemon has not published node details yet. Try again in a few seconds.',
        result: null,
      }
    }

    if (status.BackendState === 'Running' || status.Self?.DNSName) {
      await syncExportedUrls(effects)
    }

    const tailscaleIps = status.Self?.TailscaleIPs?.filter(Boolean) ?? []
    const members = [
      {
        name: 'Backend State',
        description: 'The current Tailscale daemon state for this gateway node',
        type: 'single' as const,
        value: status.BackendState ?? 'Unknown',
        copyable: false,
        qr: false,
        masked: false,
      },
      {
        name: 'Preferred Device Name',
        description:
          'The saved Tailscale device name this gateway will try to use for future connections',
        type: 'single' as const,
        value: preferredDeviceName || 'Using Tailscale default naming',
        copyable: Boolean(preferredDeviceName),
        qr: false,
        masked: false,
      },
      {
        name: 'Device Name',
        description:
          'The current device name registered for this Tailscale node',
        type: 'single' as const,
        value: status.Self?.HostName || 'Not available yet',
        copyable: true,
        qr: false,
        masked: false,
      },
      {
        name: 'MagicDNS Name',
        description:
          'The DNS name assigned to this device inside your tailnet once it is connected',
        type: 'single' as const,
        value: status.Self?.DNSName || 'Not available until login completes',
        copyable: Boolean(status.Self?.DNSName),
        qr: false,
        masked: false,
      },
      {
        name: 'Tailnet',
        description: 'The connected tailnet for this node',
        type: 'single' as const,
        value:
          status.CurrentTailnet?.Name ||
          status.MagicDNSSuffix ||
          'Not available until login completes',
        copyable: false,
        qr: false,
        masked: false,
      },
      {
        name: 'Tailscale IPs',
        description:
          'The IP addresses assigned to this node inside your tailnet',
        type: 'single' as const,
        value:
          tailscaleIps.length > 0
            ? tailscaleIps.join(', ')
            : 'Not available until login completes',
        copyable: tailscaleIps.length > 0,
        qr: false,
        masked: false,
      },
      {
        name: 'HTTPS Certificates',
        description:
          cert.ready
            ? 'Tailscale can issue HTTPS certs for this node. HTTPS serves will work automatically.'
            : cert.error
              ? explainCertError(cert.error)
              : 'HTTPS certificate status is not known yet. Sign in and wait a few seconds, then check again.',
        type: 'single' as const,
        value: cert.ready
          ? `Ready${cert.lastOkAt ? ` (last verified ${cert.lastOkAt})` : ''}`
          : cert.error
            ? cert.error
            : 'Not verified yet',
        copyable: Boolean(cert.error),
        qr: false,
        masked: false,
      },
      {
        name: 'Client Version',
        description: 'The Tailscale client version currently running in the package',
        type: 'single' as const,
        value: status.Version || 'Unknown',
        copyable: false,
        qr: false,
        masked: false,
      },
    ]

    const healthWarnings =
      status.Health?.filter(Boolean).map((warning) => ({
        name: 'Health Warning',
        description: null,
        type: 'single' as const,
        value: warning,
        copyable: false,
        qr: false,
        masked: false,
      })) ?? []

    return {
      version: '1' as const,
      title: 'Tailscale Device Info',
      message:
        'These values come from the current Tailscale daemon status for this gateway node.',
      result: {
        type: 'group' as const,
        value: [...members, ...healthWarnings],
      },
    }
  },
)
