#!/bin/sh
# =============================================================================
# ProfPay — запуск с HTTPS (после setup-https.sh)
# =============================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "${GREEN}=== ProfPay — запуск с HTTPS ===${NC}"

# Проверяем сертификаты
if [ ! -f "nginx/ssl/localhost.crt" ] || [ ! -f "nginx/ssl/localhost.key" ]; then
    echo "${RED}[!] Сертификаты не найдены. Сначала запусти: ./setup-https.sh${NC}"
    exit 1
fi

# Проверяем .env
if [ ! -f ".env" ]; then
    echo "${RED}[!] Файл .env не найден. Скопируй .env.example в .env и настрой.${NC}"
    exit 1
fi

SECRET_KEY_VALUE=$(grep '^SECRET_KEY=' .env | cut -d'=' -f2-)
if echo "$SECRET_KEY_VALUE" | grep -qi "измени\|your-super\|local-dev\|change"; then
    echo "${RED}[!] SECRET_KEY не изменён — небезопасно!${NC}"
    echo "    Сгенерируй ключ: python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
    exit 1
fi

echo "${GREEN}[*] Запускаю Docker Compose с HTTPS...${NC}"
docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.https.yml \
  up --build -d

echo ""
echo "${GREEN}=== Готово! ===${NC}"
echo "  Приложение: https://localhost"
echo "  API docs:   https://localhost/api/v1/docs"
echo ""
echo "Логи: docker compose -f docker-compose.local.yml -f docker-compose.https.yml logs -f"
echo "Стоп: ./stop.sh"
