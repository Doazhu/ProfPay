#!/bin/bash
# =============================================================================
# ProfPay — Настройка SSL и запуск на VDS
# SSL через HOST nginx + certbot (не через Docker)
# =============================================================================

set -e

DOMAIN="profpay.site"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "Использование: ./init-ssl.sh your-email@example.com"
  exit 1
fi

echo "=== Настройка ProfPay для $DOMAIN ==="

# 1. Проверяем что certbot установлен
if ! command -v certbot &> /dev/null; then
  echo "=== Устанавливаю certbot ==="
  apt-get update && apt-get install -y certbot python3-certbot-nginx
fi

# 2. Копируем nginx конфиг на хост (только HTTP часть для начала)
echo "=== Настраиваю nginx ==="
cat > /etc/nginx/sites-available/profpay.site << 'EOF'
# Временный конфиг — только HTTP для получения сертификата
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
EOF

# Создаём симлинк если его нет
ln -sf /etc/nginx/sites-available/profpay.site /etc/nginx/sites-enabled/profpay.site
mkdir -p /var/www/certbot

# Проверяем и перезагружаем nginx
nginx -t && systemctl reload nginx

# 3. Получаем SSL сертификат
echo "=== Получаю SSL сертификат ==="
certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# 4. Теперь ставим полный конфиг с SSL
echo "=== Применяю полный nginx конфиг ==="
cp nginx/profpay.site.conf /etc/nginx/sites-available/profpay.site
nginx -t && systemctl reload nginx

# 5. Запускаем Docker
echo "=== Собираю и запускаю ProfPay ==="
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Готово! ==="
echo "Сайт: https://$DOMAIN"
echo ""
echo "Проверь:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  curl -I https://$DOMAIN"
echo ""
