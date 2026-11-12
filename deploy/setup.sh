#!/usr/bin/env bash
# One-time setup of the Unified Matrix backend on a fresh Ubuntu 22.04/24.04 VM
# (Oracle Cloud Always Free or Google Cloud e2-micro).
#
# Run from the cloned repo:   bash deploy/setup.sh            (domain = <public-ip>.sslip.io)
#                         or: DOMAIN=api.example.com bash deploy/setup.sh
#
# Installs Node 24 + Caddy (automatic HTTPS), opens ports 80/443, creates
# /etc/unified-matrix.env (your server secrets) and a systemd service.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="${SUDO_USER:-$USER}"
ENV_FILE=/etc/unified-matrix.env
SERVICE=unified-matrix

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] && [ -z "${SUDO_USER:-}" ] && { echo "Run as your normal user (the script uses sudo itself)."; exit 1; }

# ---------- Domain ----------
if [ -z "${DOMAIN:-}" ]; then
  IP="$(curl -fsS4 https://api.ipify.org)"
  DOMAIN="${IP//./-}.sslip.io"
fi
log "Domain: $DOMAIN"

# ---------- Swap (small VMs run out of RAM during npm install) ----------
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && ! swapon --show | grep -q .; then
  log "Adding 2 GB swap"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ---------- Packages ----------
log "Installing Node.js 24 and Caddy"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https openssl
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

# ---------- Firewall (Oracle's Ubuntu image blocks everything but SSH in iptables) ----------
log "Opening ports 80 and 443"
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save >/dev/null; fi
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then sudo ufw allow 80,443/tcp; fi

# ---------- Backend dependencies ----------
log "Installing backend dependencies"
cd "$REPO_DIR/backend"
npm ci --omit=dev

# ---------- Server secrets ----------
# Values here override backend/.env (dotenv never overwrites variables already set).
if [ ! -f "$ENV_FILE" ]; then
  log "Creating $ENV_FILE"
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
  sudo install -m 600 -o "$APP_USER" /dev/null "$ENV_FILE"
  sudo tee "$ENV_FILE" >/dev/null <<EOF
# Unified Matrix server settings. Anything set here wins over backend/.env.
# After editing: sudo systemctl restart $SERVICE
NODE_ENV=production
HOST=127.0.0.1
PORT=4000

# MongoDB Atlas connection string (Atlas > Connect > Drivers). Include the database name, e.g. /unified_matrix
MONGO_URI=

# Your Vercel address(es), comma-separated. Example: https://unified-matrix.vercel.app
CLIENT_ORIGIN=

ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$(openssl rand -hex 48)

# Optional overrides. Uncomment to replace the values from backend/.env:
# HTTPSMS_SIGNING_KEY=
# WHATSAPP_VERIFY_TOKEN=
# WHATSAPP_APP_SECRET=
# TELEGRAM_API_ID=
# TELEGRAM_API_HASH=
# TELEGRAM_SESSION=
# GMAIL_CLIENT_ID=
# GMAIL_CLIENT_SECRET=
# GMAIL_REFRESH_TOKEN=
EOF
  NEW_PASSWORD=1
fi

# ---------- systemd service ----------
log "Installing systemd service"
sudo tee /etc/systemd/system/$SERVICE.service >/dev/null <<EOF
[Unit]
Description=Unified Matrix backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$REPO_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE >/dev/null

# ---------- Caddy (HTTPS + reverse proxy, WebSockets included) ----------
log "Configuring Caddy for https://$DOMAIN"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:4000
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

# ---------- Start ----------
if sudo grep -qE '^MONGO_URI=.+' "$ENV_FILE" && sudo grep -qE '^CLIENT_ORIGIN=.+' "$ENV_FILE"; then
  sudo systemctl restart $SERVICE
  log "Backend started"
else
  log "Almost done: fill in MONGO_URI and CLIENT_ORIGIN, then start the backend:"
  echo "    sudo nano $ENV_FILE"
  echo "    sudo systemctl restart $SERVICE"
fi

echo
echo "  Backend URL (API_URL for Vercel): https://$DOMAIN"
echo "  httpSMS webhook:                  https://$DOMAIN/webhooks/httpsms"
echo "  WhatsApp callback URL:            https://$DOMAIN/webhooks/whatsapp"
[ -n "${NEW_PASSWORD:-}" ] && echo "  Login password (save it now):     $ADMIN_PASSWORD"
echo "  Logs:                             journalctl -u $SERVICE -f"
echo
