import {
  getAuthUrlFromState,
  requestFreshLoginLink,
  readStatusInfo,
  waitForLoginLinkState,
} from '../lib/loginInfo'
import { sdk } from '../sdk'
import { syncExportedUrls } from '../urlPlugin'

export const refreshLoginLink = sdk.Action.withoutInput(
  'refresh-login-link',
  async () => ({
    name: 'Refresh Login Link',
    description:
      'Request a fresh device-independent Tailscale login link for this gateway node. No-op if this node is already signed in.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Access',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const status = await readStatusInfo()

    if (status?.BackendState === 'Running') {
      await syncExportedUrls(effects)
      return {
        version: '1' as const,
        title: 'Already Connected',
        message:
          'This Tailscale gateway is already authenticated and connected to your tailnet.',
        result: null,
      }
    }

    await requestFreshLoginLink()
    const state = await waitForLoginLinkState()

    if (state.status?.BackendState === 'Running') {
      await syncExportedUrls(effects)
      return {
        version: '1' as const,
        title: 'Already Connected',
        message:
          'This Tailscale gateway is already authenticated and connected to your tailnet.',
        result: null,
      }
    }

    const authUrl = getAuthUrlFromState(state)

    if (authUrl) {
      return {
        version: '1' as const,
        title: 'Fresh Tailscale Login Link',
        message:
          'Open this refreshed link on any trusted device to authenticate this StartOS Tailscale gateway.',
        result: {
          type: 'single' as const,
          value: authUrl,
          copyable: true,
          qr: true,
          masked: false,
        },
      }
    }

    if (state.status?.BackendState === 'NeedsMachineAuth') {
      await syncExportedUrls(effects)
      return {
        version: '1' as const,
        title: 'Machine Approval Required',
        message:
          'This Tailscale node has authenticated and is now waiting for approval from your tailnet admin.',
        result: null,
      }
    }

    if (state.error) {
      return {
        version: '1' as const,
        title: 'Login Link Request Failed',
        message:
          'The refreshed login-link request failed. Review the error below, then try again.',
        result: {
          type: 'single' as const,
          value: state.error,
          copyable: true,
          qr: false,
          masked: false,
        },
      }
    }

    return {
      version: '1' as const,
      title: 'Login Link Requested',
      message:
        'A fresh Tailscale login link has been requested, but it is still being generated. Wait a few seconds, then run Show Login Link again.',
      result: null,
    }
  },
)
