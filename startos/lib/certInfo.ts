import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'

export const CERT_OK_PATH = sdk.volumes.main.subpath('tailscale-cert.ok')
export const CERT_ERROR_PATH = sdk.volumes.main.subpath('tailscale-cert.stderr')

export type CertStatus = {
  /** True when a probe succeeded at least once since the last failure. */
  ready: boolean
  /** The most recent probe error output, if the last probe failed. */
  error: string | null
  /** Timestamp of the last successful probe, ISO string. Null if never. */
  lastOkAt: string | null
}

export async function readCertStatus(): Promise<CertStatus> {
  const [ok, err] = await Promise.all([
    readFileOrNull(CERT_OK_PATH),
    readFileOrNull(CERT_ERROR_PATH),
  ])

  return {
    ready: ok !== null && (err === null || err.trim().length === 0),
    error: err && err.trim().length > 0 ? err.trim() : null,
    lastOkAt: ok ? ok.trim() || null : null,
  }
}

export function explainCertError(error: string): string {
  const lower = error.toLowerCase()
  if (lower.includes('https is not enabled') || lower.includes('enable https')) {
    return 'HTTPS certificates are not enabled on this tailnet. Open the Tailscale admin console → DNS, enable MagicDNS and HTTPS Certificates, then try again.'
  }
  if (lower.includes('not logged in') || lower.includes('need to log in')) {
    return 'This Tailscale node is not signed in yet. Complete login first, then HTTPS certificates will be requested automatically.'
  }
  return 'Tailscale could not provision an HTTPS certificate. See the error output below and confirm HTTPS is enabled for this tailnet in the admin console.'
}

async function readFileOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}
