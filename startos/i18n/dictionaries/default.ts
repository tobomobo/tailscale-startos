export const DEFAULT_LANG = 'en_US'

const dict = {
  'Starting Tailscale': 0,
  'Tailscale Daemon': 1,
  'Tailscaled is running': 2,
  'Tailscaled is not ready': 3,
  'Tailscale is waiting for login': 4,
  'Tailscaled is starting': 5,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
