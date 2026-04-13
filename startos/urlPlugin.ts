import { sdk } from './sdk'
import { readGatewayConfig } from './lib/gatewayConfig'
import { routeDetailsForPlugin } from './lib/tailscaleUrls'

const addExposureFromUrlAction = { id: 'add-exposure-from-url' } as any
const removeExposureFromUrlAction = { id: 'remove-exposure-from-url' } as any

export const registerUrlPlugin = sdk.setupOnInit(async (effects) => {
  await sdk.plugin.url.register(effects, {
    tableAction: addExposureFromUrlAction,
  })
})

export const syncExportedUrls = sdk.plugin.url.setupExportedUrls(
  async ({ effects }) => {
    const config = await readGatewayConfig()

    for (const route of config.routes) {
      const details = await routeDetailsForPlugin(effects, route)

      if (!details) {
        continue
      }

      await sdk.plugin.url.exportUrl(effects, {
        hostnameInfo: {
          packageId: route.packageId,
          hostId: details.serviceInterface.addressInfo.hostId,
          internalPort: details.serviceInterface.addressInfo.internalPort,
          ssl: details.ssl,
          public: false,
          hostname: details.dnsName,
          port: details.port,
          info: {
            routeId: route.id,
            mode: route.mode,
            externalPort: route.externalPort,
          },
        },
        removeAction: removeExposureFromUrlAction,
        overflowActions: [],
      })
    }
  },
)
