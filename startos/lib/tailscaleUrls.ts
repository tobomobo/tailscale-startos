import { sdk } from '../sdk'
import type { ExposureRoute } from './gatewayConfig'
import { readGatewayConfig } from './gatewayConfig'
import type { StatusInfo } from './loginInfo'
import { readStatusInfo } from './loginInfo'

type PackageEffects = Parameters<typeof sdk.getServiceManifest>[0]

type AddressInfoLike = {
  hostId: string
  internalPort: number
  scheme: string | null
  sslScheme: string | null
}

export type UrlPluginTableMetadata = {
  packageId: string
  interfaceId: string
  hostId: string
  internalPort: number
}

export type UrlPluginRowMetadata = UrlPluginTableMetadata & {
  hostname: string
  port: number | null
  ssl: boolean
  public: boolean
  info: unknown
}

export function normalizeDnsName(dnsName: string | null | undefined): string | null {
  const trimmed = dnsName?.trim().replace(/\.+$/, '') ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function readTailnetHostname(): Promise<string | null> {
  const status = await readStatusInfo()
  return normalizeDnsName(status?.Self?.DNSName)
}

export function routeUsesTailnetHttps(route: ExposureRoute): boolean {
  return route.mode === 'http' && route.targetScheme === 'https+insecure'
}

export function buildTailnetUrl(route: ExposureRoute, dnsName: string): string {
  if (route.mode === 'tcp') {
    const host =
      dnsName.includes(':') && !dnsName.startsWith('[') ? `[${dnsName}]` : dnsName
    return `${host}:${route.externalPort}`
  }

  const scheme = routeUsesTailnetHttps(route) ? 'https' : 'http'
  const defaultPort = scheme === 'https' ? 443 : 80
  const portSuffix =
    route.externalPort === defaultPort ? '' : `:${route.externalPort}`

  return `${scheme}://${dnsName}${portSuffix}`
}

export function defaultExternalPortForInterface(addressInfo: AddressInfoLike): number {
  if (
    addressInfo.sslScheme?.startsWith('http') ||
    addressInfo.scheme?.startsWith('http')
  ) {
    return addressInfo.sslScheme?.startsWith('http') ? 443 : 80
  }

  return addressInfo.internalPort
}

export function chooseSuggestedExternalPort(
  existingRoutes: ExposureRoute[],
  preferredPort: number,
): number {
  const usedPorts = new Set(existingRoutes.map((route) => route.externalPort))

  if (!usedPorts.has(preferredPort)) {
    return preferredPort
  }

  for (let port = 3000; port <= 65535; port += 1) {
    if (!usedPorts.has(port)) {
      return port
    }
  }

  throw new Error('No free published ports remain for new Tailscale exposures.')
}

export async function findRouteByBinding(
  effects: PackageEffects,
  metadata: UrlPluginTableMetadata,
): Promise<ExposureRoute | null> {
  const config = await readGatewayConfig()
  const candidates = config.routes.filter(
    (route) => route.packageId === metadata.packageId,
  )

  for (const route of candidates) {
    const serviceInterface = await sdk.serviceInterface
      .get(effects, {
        packageId: route.packageId,
        id: route.interfaceId,
      })
      .once()

    if (
      serviceInterface?.addressInfo &&
      serviceInterface.addressInfo.hostId === metadata.hostId &&
      serviceInterface.addressInfo.internalPort === metadata.internalPort
    ) {
      return route
    }
  }

  return null
}

export async function routeDetailsForPlugin(
  effects: PackageEffects,
  route: ExposureRoute,
): Promise<{
  dnsName: string
  serviceInterface: {
    id: string
    addressInfo: AddressInfoLike
  }
  url: string
  ssl: boolean
  port: number | null
} | null> {
  const dnsName = await readTailnetHostname()
  if (!dnsName) {
    return null
  }

  const serviceInterface = await sdk.serviceInterface
    .get(effects, {
      packageId: route.packageId,
      id: route.interfaceId,
    })
    .once()

  if (!serviceInterface?.addressInfo) {
    return null
  }

  const ssl =
    routeUsesTailnetHttps(route) &&
    Boolean(serviceInterface.addressInfo.sslScheme?.startsWith('http'))

  const port =
    route.mode === 'tcp'
      ? route.externalPort
      : ssl
        ? route.externalPort === 443
          ? null
          : route.externalPort
        : route.externalPort === 80
          ? null
          : route.externalPort

  return {
    dnsName,
    serviceInterface: {
      id: serviceInterface.id,
      addressInfo: serviceInterface.addressInfo,
    },
    url: buildTailnetUrl(route, dnsName),
    ssl,
    port,
  }
}

export function tailnetUrlResult(
  route: ExposureRoute,
  url: string | null,
): {
  name: string
  description: string | null
  type: 'single'
  value: string
  copyable: boolean
  qr: boolean
  masked: false
} {
  return {
    name: 'Tailnet Address',
    description:
      url === null
        ? 'This will appear after the gateway is connected and MagicDNS is available.'
        : 'How this exposure is reached from other Tailscale devices.',
    type: 'single',
    value: url ?? 'Available after Tailscale login completes',
    copyable: url !== null,
    qr: false,
    masked: false,
  }
}

export async function readTailnetStatus(): Promise<{
  status: StatusInfo | null
  dnsName: string | null
}> {
  const status = await readStatusInfo()
  return {
    status,
    dnsName: normalizeDnsName(status?.Self?.DNSName),
  }
}
