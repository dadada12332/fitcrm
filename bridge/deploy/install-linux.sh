#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
INSTALL_DIR=${FITCRM_BRIDGE_INSTALL_DIR:-/opt/fitcrm-bridge}
CONFIG_PATH=${1:-"$SOURCE_DIR/config.json"}
ENV_PATH=${2:-}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required" >&2
  exit 1
fi

NODE_MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required" >&2
  exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Config not found: $CONFIG_PATH" >&2
  exit 1
fi
if grep -q '\${VENDOR_' "$CONFIG_PATH" && { [ -z "$ENV_PATH" ] || [ ! -f "$ENV_PATH" ]; }; then
  echo "Config uses vendor environment placeholders; pass bridge.env as the second argument" >&2
  exit 1
fi

if ! getent group fitcrm-bridge >/dev/null 2>&1; then
  groupadd --system fitcrm-bridge
fi
if ! id fitcrm-bridge >/dev/null 2>&1; then
  useradd --system --gid fitcrm-bridge --home-dir /var/lib/fitcrm-bridge --shell /usr/sbin/nologin fitcrm-bridge
fi

install -d -m 0750 "$INSTALL_DIR/bin" "$INSTALL_DIR/src"
install -d -o fitcrm-bridge -g fitcrm-bridge -m 0750 /var/lib/fitcrm-bridge
install -d -o root -g fitcrm-bridge -m 0750 /etc/fitcrm-bridge
cp -R "$SOURCE_DIR/bin/." "$INSTALL_DIR/bin/"
cp -R "$SOURCE_DIR/src/." "$INSTALL_DIR/src/"
install -m 0644 "$SOURCE_DIR/package.json" "$INSTALL_DIR/package.json"
install -o root -g fitcrm-bridge -m 0640 "$CONFIG_PATH" /etc/fitcrm-bridge/config.json
if [ -n "$ENV_PATH" ]; then
  install -o root -g fitcrm-bridge -m 0640 "$ENV_PATH" /etc/fitcrm-bridge/bridge.env
fi
install -m 0644 "$SOURCE_DIR/deploy/fitcrm-bridge.service" /etc/systemd/system/fitcrm-bridge.service

systemctl daemon-reload
systemctl enable --now fitcrm-bridge.service
echo "FitCRM Bridge installed. Run: curl http://127.0.0.1:8787/health"
