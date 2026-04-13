#!/bin/sh
set -eu

STATE_DIR=/var/lib/tailscale
SOCKET=/var/run/tailscale/tailscaled.sock
CONFIG_FILE="${STATE_DIR}/gateway-routes.json"
STATUS_FILE="${STATE_DIR}/tailscale-status.json"
LOGIN_FILE="${STATE_DIR}/tailscale-login.json"
LOGIN_REQUEST_FILE="${STATE_DIR}/tailscale-login-request"
LOGIN_ERROR_FILE="${STATE_DIR}/tailscale-login.stderr"
LOGIN_TIMEOUT=30s
TAILSCALE_DEVICE_NAME="${TAILSCALE_DEVICE_NAME:-}"

mkdir -p "${STATE_DIR}" /var/run/tailscale

tailscaled \
  --state="${STATE_DIR}/tailscaled.state" \
  --socket="${SOCKET}" \
  --tun=userspace-networking &
TAILSCALED_PID=$!

PROXY_PID=
LAST_PROXY_HASH=
LAST_APPLIED_HASH=
STARTUP_LOGIN_ATTEMPTED=0

cleanup() {
  for pid in "${PROXY_PID}" "${TAILSCALED_PID}"; do
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
  wait "${PROXY_PID}" 2>/dev/null || true
  wait "${TAILSCALED_PID}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

capture_status() {
  if tailscale --socket="${SOCKET}" status --json > "${STATUS_FILE}.tmp" 2>/dev/null; then
    mv "${STATUS_FILE}.tmp" "${STATUS_FILE}"
    return 0
  fi

  rm -f "${STATUS_FILE}.tmp"
  return 1
}

current_backend_state() {
  if [ ! -f "${STATUS_FILE}" ]; then
    return 0
  fi

  sed -n 's/.*"BackendState"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${STATUS_FILE}" | head -n 1
}

current_auth_url() {
  if [ ! -f "${STATUS_FILE}" ]; then
    return 0
  fi

  sed -n 's/.*"AuthURL"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${STATUS_FILE}" | head -n 1
}

current_device_name() {
  if [ ! -f "${STATUS_FILE}" ]; then
    return 0
  fi

  sed -n 's/.*"HostName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${STATUS_FILE}" | head -n 1
}

until capture_status; do
  sleep 1
done

request_login_link() {
  echo "Requesting device-independent Tailscale login link"

  if [ -n "${TAILSCALE_DEVICE_NAME}" ]; then
    tailscale --socket="${SOCKET}" up --hostname="${TAILSCALE_DEVICE_NAME}" --json --timeout="${LOGIN_TIMEOUT}" > "${LOGIN_FILE}.tmp" 2> "${LOGIN_ERROR_FILE}.tmp" &
  else
    tailscale --socket="${SOCKET}" up --json --timeout="${LOGIN_TIMEOUT}" > "${LOGIN_FILE}.tmp" 2> "${LOGIN_ERROR_FILE}.tmp" &
  fi
  LOGIN_PID=$!
  LOGIN_EXIT=0
  LOGIN_READY=0

  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    capture_status || true

    AUTH_URL=$(current_auth_url)
    BACKEND_STATE=$(current_backend_state)

    if [ -n "${AUTH_URL}" ] || [ "${BACKEND_STATE}" = "Running" ] || [ "${BACKEND_STATE}" = "NeedsMachineAuth" ]; then
      LOGIN_READY=1
      break
    fi

    if ! kill -0 "${LOGIN_PID}" 2>/dev/null; then
      break
    fi

    sleep 1
  done

  if kill -0 "${LOGIN_PID}" 2>/dev/null; then
    kill "${LOGIN_PID}" 2>/dev/null || true
  fi

  if wait "${LOGIN_PID}" 2>/dev/null; then
    LOGIN_EXIT=0
  else
    LOGIN_EXIT=$?
  fi

  if [ -s "${LOGIN_FILE}.tmp" ]; then
    mv "${LOGIN_FILE}.tmp" "${LOGIN_FILE}"
  else
    rm -f "${LOGIN_FILE}.tmp"
  fi

  if [ -s "${LOGIN_ERROR_FILE}.tmp" ]; then
    mv "${LOGIN_ERROR_FILE}.tmp" "${LOGIN_ERROR_FILE}"
  else
    rm -f "${LOGIN_ERROR_FILE}.tmp"
  fi

  if [ "${LOGIN_READY}" -eq 1 ]; then
    rm -f "${LOGIN_ERROR_FILE}"
  fi

  if [ "${LOGIN_EXIT}" -ne 0 ] && [ "${LOGIN_READY}" -eq 0 ] && [ ! -s "${LOGIN_FILE}" ]; then
    echo "Failed to request a Tailscale login link (exit ${LOGIN_EXIT})" >&2
    if [ -s "${LOGIN_ERROR_FILE}" ]; then
      cat "${LOGIN_ERROR_FILE}" >&2
    fi
  fi

  rm -f "${LOGIN_REQUEST_FILE}"
}

reconcile_device_name() {
  if [ -z "${TAILSCALE_DEVICE_NAME}" ]; then
    return 0
  fi

  capture_status || return 0

  BACKEND_STATE=$(current_backend_state)
  CURRENT_DEVICE_NAME=$(current_device_name)

  if [ "${BACKEND_STATE}" != "Running" ] || [ "${CURRENT_DEVICE_NAME}" = "${TAILSCALE_DEVICE_NAME}" ]; then
    return 0
  fi

  echo "Updating Tailscale device name to ${TAILSCALE_DEVICE_NAME}"
  if ! tailscale --socket="${SOCKET}" set --hostname="${TAILSCALE_DEVICE_NAME}" >/dev/null 2>&1; then
    echo "Warning: failed to update the running Tailscale device name" >&2
  fi

  capture_status || true
}

refresh_login_state() {
  capture_status || return 0

  BACKEND_STATE=$(current_backend_state)
  AUTH_URL=$(current_auth_url)

  case "${BACKEND_STATE}" in
    Running)
      rm -f "${LOGIN_FILE}" "${LOGIN_REQUEST_FILE}" "${LOGIN_ERROR_FILE}"
      ;;
  esac

  if [ "${BACKEND_STATE}" != "Running" ] && {
    [ -e "${LOGIN_REQUEST_FILE}" ] ||
    {
      [ "${STARTUP_LOGIN_ATTEMPTED}" -eq 0 ] &&
      [ -z "${AUTH_URL}" ] &&
      [ ! -s "${LOGIN_FILE}" ];
    };
  }; then
    request_login_link
    capture_status || true
  fi

  STARTUP_LOGIN_ATTEMPTED=1
}

refresh_login_state

config_hash() {
  if [ -f "${CONFIG_FILE}" ]; then
    sha256sum "${CONFIG_FILE}" | awk '{print $1}'
  else
    echo none
  fi
}

start_proxy() {
  if [ -n "${PROXY_PID}" ] && kill -0 "${PROXY_PID}" 2>/dev/null; then
    kill "${PROXY_PID}" 2>/dev/null || true
    wait "${PROXY_PID}" 2>/dev/null || true
  fi
  /usr/local/bin/tailscale-gateway proxy --config "${CONFIG_FILE}" &
  PROXY_PID=$!
}

apply_routes() {
  /usr/local/bin/tailscale-gateway apply --config "${CONFIG_FILE}" --socket "${SOCKET}"
}

start_proxy

while kill -0 "${TAILSCALED_PID}" 2>/dev/null; do
  CURRENT_HASH=$(config_hash)

  refresh_login_state
  reconcile_device_name

  if [ "${CURRENT_HASH}" != "${LAST_PROXY_HASH}" ] || ! kill -0 "${PROXY_PID}" 2>/dev/null; then
    LAST_PROXY_HASH="${CURRENT_HASH}"
    LAST_APPLIED_HASH=
    start_proxy
  fi

  if [ "${CURRENT_HASH}" != "${LAST_APPLIED_HASH}" ]; then
    if apply_routes; then
      LAST_APPLIED_HASH="${CURRENT_HASH}"
    fi
  fi

  sleep 2
done

wait "${TAILSCALED_PID}"
