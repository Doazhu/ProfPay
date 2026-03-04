#!/bin/bash
# =============================================================================
# ProfPay — Первичное получение SSL-сертификата Let's Encrypt
# Запускать ОДИН раз при первом деплое на сервере
# =============================================================================

set -e

DOMAIN="profpay.site"
EMAIL="${1:-}"
COMPOSE_FILE="docker-compose.prod.yml"

if [ -z "$EMAIL" ]; then
  echo "Использование: ./init-ssl.sh your-email@example.com"
  echo "Email нужен для уведомлений от Let's Encrypt"
  exit 1
fi

echo "=== Получение SSL-сертификата для $DOMAIN ==="

# 1. Создаём директории
mkdir -p certbot/conf certbot/www

# 2. Создаём временный nginx конфиг (только HTTP для ACME challenge)
cat > nginx/nginx-initssl.conf << 'INITEOF'
server {
    listen 80;
    listen [::]:80;
    server_name profpay.site;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
INITEOF

# 3. Запускаем nginx с временным конфигом
echo "=== Запускаю nginx для ACME challenge ==="
docker compose -f "$COMPOSE_FILE" up -d db
sleep 3

docker run -d --name profpay-nginx-initssl \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx-initssl.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$(pwd)/certbot/www:/var/www/certbot:ro" \
  nginx:1.25-alpine

sleep 2

# 4. Получаем сертификат
echo "=== Запрашиваю сертификат у Let's Encrypt ==="
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# 5. Убираем временный nginx
echo "=== Убираю временный nginx ==="
docker stop profpay-nginx-initssl && docker rm profpay-nginx-initssl
rm nginx/nginx-initssl.conf

# 6. Запускаем проект полностью
echo "=== Запускаю ProfPay ==="
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "=== Готово! ==="
echo "Сайт доступен: https://$DOMAIN"
echo ""
