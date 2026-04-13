import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { sdk } from '../sdk'

export const DEVICE_NAME_PATH = sdk.volumes.main.subpath(
  'tailscale-device-name.txt',
)

const DEVICE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export async function readDeviceName(): Promise<string | null> {
  try {
    const raw = await fs.readFile(DEVICE_NAME_PATH, 'utf8')
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeDeviceName(deviceName: string): Promise<void> {
  validateDeviceName(deviceName)
  await fs.mkdir(path.dirname(DEVICE_NAME_PATH), { recursive: true })
  await fs.writeFile(DEVICE_NAME_PATH, `${deviceName.trim()}\n`, 'utf8')
}

export function validateDeviceName(deviceName: string): void {
  const trimmed = deviceName.trim()

  if (!DEVICE_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      'Device names must be 1-63 characters long and use only letters, numbers, or hyphens.',
    )
  }
}
