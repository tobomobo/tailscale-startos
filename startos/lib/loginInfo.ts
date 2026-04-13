import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const statusInfoSchema = z
  .object({
    Version: z.string().optional(),
    BackendState: z.string().optional(),
    AuthURL: z.string().optional(),
    MagicDNSSuffix: z.string().optional(),
    Health: z.array(z.string()).optional(),
    Self: z
      .object({
        HostName: z.string().optional(),
        DNSName: z.string().optional(),
        TailscaleIPs: z.array(z.string()).nullable().optional(),
      })
      .optional(),
    CurrentTailnet: z
      .object({
        Name: z.string().optional(),
        MagicDNSSuffix: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough()

const loginInfoSchema = z
  .object({
    AuthURL: z.string().url().optional(),
    BackendState: z.string().optional(),
  })
  .passthrough()

export const STATUS_INFO_PATH = sdk.volumes.main.subpath('tailscale-status.json')
export const LOGIN_INFO_PATH = sdk.volumes.main.subpath('tailscale-login.json')
export const LOGIN_REQUEST_PATH = sdk.volumes.main.subpath(
  'tailscale-login-request',
)
export const LOGIN_ERROR_PATH = sdk.volumes.main.subpath(
  'tailscale-login.stderr',
)

export type StatusInfo = z.infer<typeof statusInfoSchema>
export type LoginInfo = z.infer<typeof loginInfoSchema>
export type LoginLinkState = {
  login: LoginInfo | null
  error: string | null
  pending: boolean
  status: StatusInfo | null
}

export function getAuthUrlFromState(state: LoginLinkState): string | null {
  const candidates = [state.login?.AuthURL, state.status?.AuthURL]

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate
    }
  }

  return null
}

export async function readStatusInfo(): Promise<StatusInfo | null> {
  try {
    const raw = await fs.readFile(STATUS_INFO_PATH, 'utf8')
    return statusInfoSchema.parse(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function readLoginInfo(): Promise<LoginInfo | null> {
  try {
    const raw = await fs.readFile(LOGIN_INFO_PATH, 'utf8')
    return loginInfoSchema.parse(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function readLoginError(): Promise<string | null> {
  try {
    const raw = await fs.readFile(LOGIN_ERROR_PATH, 'utf8')
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function isLoginRequestPending(): Promise<boolean> {
  try {
    await fs.access(LOGIN_REQUEST_PATH)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export async function getLoginLinkState(): Promise<LoginLinkState> {
  const [login, error, pending, status] = await Promise.all([
    readLoginInfo(),
    readLoginError(),
    isLoginRequestPending(),
    readStatusInfo(),
  ])

  return { login, error, pending, status }
}

export async function waitForLoginLinkState(
  timeoutMs = 15_000,
  intervalMs = 1_000,
): Promise<LoginLinkState> {
  const deadline = Date.now() + timeoutMs
  let state = await getLoginLinkState()

  while (
    Date.now() < deadline &&
    !getAuthUrlFromState(state) &&
    !state.error &&
    state.status?.BackendState !== 'Running' &&
    state.status?.BackendState !== 'NeedsMachineAuth'
  ) {
    await delay(intervalMs)
    state = await getLoginLinkState()
  }

  return state
}

export async function requestFreshLoginLink(): Promise<void> {
  await fs.mkdir(path.dirname(LOGIN_REQUEST_PATH), { recursive: true })
  await fs.rm(LOGIN_INFO_PATH, { force: true })
  await fs.rm(LOGIN_ERROR_PATH, { force: true })
  await fs.writeFile(LOGIN_REQUEST_PATH, `${new Date().toISOString()}\n`, 'utf8')
}
