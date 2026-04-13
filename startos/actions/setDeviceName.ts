import { sdk } from '../sdk'
import { readDeviceName, validateDeviceName, writeDeviceName } from '../lib/deviceName'

const { InputSpec, Value } = sdk

export const setDeviceName = sdk.Action.withInput(
  'set-device-name',
  async () => ({
    name: 'Set Device Name',
    description:
      'Choose the Tailscale device name this gateway should use for MagicDNS and the node list.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Access',
    visibility: 'enabled',
  }),
  async () =>
    InputSpec.of({
      deviceName: Value.text({
        name: 'Device Name',
        description:
          'This becomes the Tailscale machine name and the first part of the MagicDNS hostname for this gateway.',
        required: true,
        default: null,
        placeholder: 'startos-gateway',
        minLength: 1,
        maxLength: 63,
        patterns: [
          {
            regex: '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$',
            description:
              'Use 1-63 letters, numbers, or hyphens, and do not start or end with a hyphen.',
          },
        ],
      }),
    }),
  async () => ({
    deviceName: (await readDeviceName()) ?? undefined,
  }),
  async ({ input }) => {
    validateDeviceName(input.deviceName)
    await writeDeviceName(input.deviceName)

    return {
      version: '1' as const,
      title: 'Device Name Saved',
      message:
        'The preferred Tailscale device name has been saved. If the node is already connected, the running daemon will update it shortly.',
      result: {
        type: 'single' as const,
        value: input.deviceName.trim(),
        copyable: true,
        qr: false,
        masked: false,
      },
    }
  },
)
