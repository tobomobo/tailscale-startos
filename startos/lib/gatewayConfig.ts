import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const exposureModeSchema = z.enum([
  'https',
  'http',
  'tcp',
  'tls-terminated-tcp',
  'funnel',
])
const exposureTargetSchemeSchema = z.enum(['http', 'https+insecure', 'tcp'])
const serviceInterfaceTypeSchema = z.enum(['ui', 'api', 'p2p'])

export const exposureRouteSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  packageTitle: z.string(),
  interfaceId: z.string(),
  interfaceName: z.string(),
  interfaceType: serviceInterfaceTypeSchema,
  mode: exposureModeSchema,
  externalPort: z.number().int().min(1).max(65535),
  localPort: z.number().int().min(1024).max(65535),
  targetHost: z.string(),
  targetPort: z.number().int().min(1).max(65535),
  targetScheme: exposureTargetSchemeSchema,
})

export const gatewayConfigSchema = z.object({
  version: z.literal(1),
  routes: z.array(exposureRouteSchema),
})

export type ExposureMode = z.infer<typeof exposureModeSchema>
export type ExposureRoute = z.infer<typeof exposureRouteSchema>
export type GatewayConfig = z.infer<typeof gatewayConfigSchema>

export type CandidateInterface = {
  key: string
  packageId: string
  packageTitle: string
  interfaceId: string
  interfaceName: string
  interfaceType: ExposureRoute['interfaceType']
  description: string
  supportsHttp: boolean
  hostId: string
  internalPort: number
}

const CONFIG_PATH = sdk.volumes.main.subpath('gateway-routes.json')
const LOCAL_PORT_START = 20_000
const LOCAL_PORT_END = 39_999

export function serveModeLabel(mode: ExposureMode): string {
  switch (mode) {
    case 'https':
      return 'HTTPS'
    case 'http':
      return 'HTTP'
    case 'tcp':
      return 'TCP'
    case 'tls-terminated-tcp':
      return 'TLS-TCP'
    case 'funnel':
      return 'Funnel'
  }
}

export function isHttpServeMode(mode: ExposureMode): boolean {
  return mode === 'https' || mode === 'http' || mode === 'funnel'
}

export function serveUsesTailnetTls(mode: ExposureMode): boolean {
  return (
    mode === 'https' || mode === 'tls-terminated-tcp' || mode === 'funnel'
  )
}

export function isFunnelMode(mode: ExposureMode): boolean {
  return mode === 'funnel'
}

/** Tailscale only accepts these external ports for Funnel. */
export const FUNNEL_ALLOWED_PORTS = [443, 8443, 10000] as const

export function assertFunnelPort(port: number): void {
  if (!FUNNEL_ALLOWED_PORTS.includes(port as 443 | 8443 | 10000)) {
    throw new Error(
      `Funnel only accepts ports ${FUNNEL_ALLOWED_PORTS.join(', ')}. Pick one of those for a Funnel serve.`,
    )
  }
}

export async function readGatewayConfig(): Promise<GatewayConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    return gatewayConfigSchema.parse(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyGatewayConfig()
    }
    throw error
  }
}

export async function writeGatewayConfig(config: GatewayConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
  await fs.writeFile(
    CONFIG_PATH,
    `${JSON.stringify(gatewayConfigSchema.parse(config), null, 2)}\n`,
    'utf8',
  )
}

export function emptyGatewayConfig(): GatewayConfig {
  return { version: 1, routes: [] }
}

export function encodeInterfaceKey(packageId: string, interfaceId: string): string {
  return `${packageId}::${interfaceId}`
}

export function decodeInterfaceKey(
  value: string,
): { packageId: string; interfaceId: string } {
  const [packageId, interfaceId, ...rest] = value.split('::')
  if (!packageId || !interfaceId || rest.length > 0) {
    throw new Error(`Invalid interface selection: ${value}`)
  }
  return { packageId, interfaceId }
}

export function describeRoute(route: ExposureRoute): string {
  return `${route.packageTitle} -> ${route.interfaceName} (${serveModeLabel(route.mode)} on port ${route.externalPort})`
}

function resolveHttpTargetScheme(addressInfo: {
  scheme?: string | null
  sslScheme?: string | null
}): ExposureRoute['targetScheme'] {
  if (addressInfo.scheme?.startsWith('http')) {
    return 'http'
  }
  if (addressInfo.sslScheme?.startsWith('http')) {
    return 'https+insecure'
  }
  throw new Error('The selected interface does not advertise HTTP.')
}

export async function listCandidateInterfaces(
  effects: Parameters<typeof sdk.getServiceManifest>[0],
): Promise<CandidateInterface[]> {
  const installedPackages = (await effects.getInstalledPackages()).filter(
    (packageId) => packageId !== sdk.manifest.id,
  )

  const candidates: CandidateInterface[] = []

  for (const packageId of installedPackages.sort((a, b) => a.localeCompare(b))) {
    const manifest = await sdk.getServiceManifest(effects, packageId).once()
    if (!manifest) continue
    const interfaces = await sdk.serviceInterface
      .getAll(effects, { packageId })
      .once()

    for (const serviceInterface of interfaces) {
      if (!serviceInterface.addressInfo) continue

      const supportsHttp = Boolean(
        serviceInterface.addressInfo.scheme?.startsWith('http') ||
          serviceInterface.addressInfo.sslScheme?.startsWith('http'),
      )

      candidates.push({
        key: encodeInterfaceKey(packageId, serviceInterface.id),
        packageId,
        packageTitle: manifest.title,
        interfaceId: serviceInterface.id,
        interfaceName: serviceInterface.name,
        interfaceType: serviceInterface.type,
        description: serviceInterface.description,
        supportsHttp,
        hostId: serviceInterface.addressInfo.hostId,
        internalPort: serviceInterface.addressInfo.internalPort,
      })
    }
  }

  return candidates.sort((a, b) =>
    `${a.packageTitle} ${a.interfaceName}`.localeCompare(
      `${b.packageTitle} ${b.interfaceName}`,
    ),
  )
}

export async function resolveExposureRoute(
  effects: Parameters<typeof sdk.getServiceManifest>[0],
  options: {
    packageId: string
    interfaceId: string
    mode: ExposureMode
    externalPort: number
    existingRoutes: ExposureRoute[]
    localPort?: number
  },
): Promise<ExposureRoute> {
  const manifest = await sdk
    .getServiceManifest(effects, options.packageId)
    .once()
  if (!manifest) {
    throw new Error(`The selected package ${options.packageId} is unavailable.`)
  }
  const serviceInterface = await sdk.serviceInterface
    .get(effects, {
      packageId: options.packageId,
      id: options.interfaceId,
    })
    .once()
  const containerIp = await sdk
    .getContainerIp(effects, { packageId: options.packageId })
    .once()

  if (!serviceInterface?.addressInfo) {
    throw new Error(
      `The selected interface ${options.packageId}/${options.interfaceId} is unavailable right now.`,
    )
  }

  if (isHttpServeMode(options.mode)) {
    const supportsHttp =
      serviceInterface.addressInfo.scheme?.startsWith('http') ||
      serviceInterface.addressInfo.sslScheme?.startsWith('http')

    if (!supportsHttp) {
      throw new Error(
        `The selected interface does not advertise HTTP. Use a TCP-based serve mode instead.`,
      )
    }
  }

  const preservedLocalPort =
    options.localPort &&
    !options.existingRoutes.some(
      (route) =>
        route.localPort === options.localPort &&
        route.id !== buildRouteId(
          options.packageId,
          options.interfaceId,
          options.mode,
          options.externalPort,
        ),
    )
      ? options.localPort
      : undefined

  return {
    id: buildRouteId(
      options.packageId,
      options.interfaceId,
      options.mode,
      options.externalPort,
    ),
    packageId: options.packageId,
    packageTitle: manifest.title,
    interfaceId: serviceInterface.id,
    interfaceName: serviceInterface.name,
    interfaceType: serviceInterface.type,
    mode: options.mode,
    externalPort: options.externalPort,
    localPort:
      preservedLocalPort ?? allocateLocalPort(options.existingRoutes),
    targetHost: containerIp,
    targetPort: serviceInterface.addressInfo.internalPort,
    targetScheme: isHttpServeMode(options.mode)
      ? resolveHttpTargetScheme(serviceInterface.addressInfo)
      : 'tcp',
  }
}

export async function refreshGatewayConfig(
  effects: Parameters<typeof sdk.getServiceManifest>[0],
): Promise<{ config: GatewayConfig; changed: number; failed: string[] }> {
  const current = await readGatewayConfig()
  const refreshed: ExposureRoute[] = []
  let changed = 0
  const failed: string[] = []

  for (const route of current.routes) {
    try {
      const nextRoute = await resolveExposureRoute(effects, {
        packageId: route.packageId,
        interfaceId: route.interfaceId,
        mode: route.mode,
        externalPort: route.externalPort,
        existingRoutes: refreshed,
        localPort: route.localPort,
      })

      if (JSON.stringify(nextRoute) !== JSON.stringify(route)) {
        changed += 1
      }

      refreshed.push(nextRoute)
    } catch (error) {
      failed.push(
        `${describeRoute(route)}: ${(error as Error).message}`,
      )
      refreshed.push(route)
    }
  }

  const nextConfig = gatewayConfigSchema.parse({
    version: 1,
    routes: refreshed,
  })

  if (changed > 0) {
    await writeGatewayConfig(nextConfig)
  }

  return { config: nextConfig, changed, failed }
}

export function routeResultMembers(route: ExposureRoute) {
  return [
    {
      name: 'Published Port',
      description: 'The port served on this Tailscale node',
      type: 'single' as const,
      value: String(route.externalPort),
      copyable: true,
      qr: false,
      masked: false,
    },
    {
      name: 'Serve Mode',
      description: null,
      type: 'single' as const,
      value: serveModeLabel(route.mode),
      copyable: false,
      qr: false,
      masked: false,
    },
    {
      name: 'Target',
      description: 'The StartOS service interface currently being forwarded',
      type: 'single' as const,
      value: `${route.packageTitle} / ${route.interfaceName}`,
      copyable: false,
      qr: false,
      masked: false,
    },
  ]
}

function buildRouteId(
  packageId: string,
  interfaceId: string,
  mode: ExposureMode,
  externalPort: number,
): string {
  return `${packageId}:${interfaceId}:${mode}:${externalPort}`
}

function allocateLocalPort(existingRoutes: ExposureRoute[]): number {
  const usedPorts = new Set(existingRoutes.map((route) => route.localPort))

  for (let port = LOCAL_PORT_START; port <= LOCAL_PORT_END; port += 1) {
    if (!usedPorts.has(port)) {
      return port
    }
  }

  throw new Error('No free local ports remain for proxy listeners.')
}
