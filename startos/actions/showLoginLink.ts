import {
  getAuthUrlFromState,
  getLoginLinkState,
  waitForLoginLinkState,
} from '../lib/loginInfo'
import { sdk } from '../sdk'
import { syncExportedUrls } from '../urlPlugin'

export const showLoginLink = sdk.Action.withoutInput(
  'show-login-link',
  async () => ({
    name: 'Show Login Link',
    description:
      'Display the current device-independent Tailscale login link for this gateway node.',
    warning: null,
    allowedStatuses: 'any',
    group: 'Access',
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    let state = await getLoginLinkState()

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

    let authUrl = getAuthUrlFromState(state)

    if (authUrl) {
      return {
        version: '1' as const,
        title: 'Tailscale Login Link',
        message:
          'Open this link on any trusted device to authenticate this StartOS Tailscale gateway.',
        result: {
          type: 'single' as const,
          value: authUrl,
          copyable: true,
          qr: true,
          masked: false,
        },
      }
    }

    state = await waitForLoginLinkState()
    authUrl = getAuthUrlFromState(state)

    if (authUrl) {
      return {
        version: '1' as const,
        title: 'Tailscale Login Link',
        message:
          'Open this link on any trusted device to authenticate this StartOS Tailscale gateway.',
        result: {
          type: 'single' as const,
          value: authUrl,
          copyable: true,
          qr: true,
          masked: false,
        },
      }
    }

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

    if (state.error) {
      return {
        version: '1' as const,
        title: 'Login Link Request Failed',
        message:
          'The last attempt to generate a Tailscale login link failed. Review the error below, then run Refresh Login Link to try again.',
        result: {
          type: 'single' as const,
          value: state.error,
          copyable: true,
          qr: false,
          masked: false,
        },
      }
    }

    if (
      !state.status ||
      state.pending ||
      state.status.BackendState === 'NeedsLogin'
    ) {
      return {
        version: '1' as const,
        title: 'Login Link Still Generating',
        message:
          'This gateway requested a Tailscale login link automatically on startup, but it is not ready yet. Wait a few seconds and try again, or run Refresh Login Link to force a new request.',
        result: null,
      }
    }

    return {
      version: '1' as const,
      title: 'Login Link Not Ready',
      message:
        state.status?.BackendState
          ? `The Tailscale daemon is in state ${state.status.BackendState}. Try again in a few seconds.`
          : 'The Tailscale daemon is still starting. Try this action again in a few seconds.',
      result: null,
    }
  },
)
