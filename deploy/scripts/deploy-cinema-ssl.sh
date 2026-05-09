#!/usr/bin/env bash
set -euo pipefail

DOMAIN="cinema.bloop.io.vn"
EMAIL="${1:-}"
PROJECT_DIR="/opt/soa-BloopCinema"
NGINX_SRC="$PROJECT_DIR/deploy/nginx/$DOMAIN.conf"
NGINX_DST="/etc/nginx/sites-available/$DOMAIN.conf"
NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN.conf"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash deploy-cinema-ssl.sh <email>"
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Missing email. Usage: sudo bash deploy-cinema-ssl.sh admin@bloop.io.vn"
  exit 1
fi

if [[ ! -f "$NGINX_SRC" ]]; then
  echo "Nginx template not found: $NGINX_SRC"
  exit 1
fi

echo "[1/7] Install nginx + certbot"
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

echo "[2/7] Copy nginx config"
cp "$NGINX_SRC" "$NGINX_DST"
ln -sf "$NGINX_DST" "$NGINX_LINK"
rm -f /etc/nginx/sites-enabled/default

echo "[3/7] Test nginx config"
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[4/7] Ensure firewall opens 80/443"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

echo "[5/7] Request Let's Encrypt certificate"
certbot --nginx \
  -d "$DOMAIN" \
  --agree-tos \
  --non-interactive \
  --email "$EMAIL" \
  --redirect

echo "[6/7] Reload nginx with cert"
nginx -t
systemctl reload nginx

echo "[7/7] Validate endpoint"
curl -I "https://$DOMAIN" || true
echo "Deploy done for https://$DOMAIN"
