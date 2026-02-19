#!/bin/sh
# =============================================================================
# ProfPay — скрипт запуска (Linux / macOS / WSL на Windows)
# Использование: ./start.sh
# =============================================================================

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "${GREEN}=== ProfPay — запуск ===${NC}"

# Проверяем наличие .env
if [ ! -f ".env" ]; then
    echo "${YELLOW}[!] Файл .env не найден. Создаю из .env.example...${NC}"
    cp .env.example .env
    echo "${RED}[!] ОБЯЗАТЕЛЬНО отредактируй .env перед первым запуском!${NC}"
    echo "    Открой .env и замени пароли и SECRET_KEY на свои."
    echo "    Команда для генерации ключа:"
    echo "    python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
    exit 1
fi

# Проверяем, что SECRET_KEY не дефолтный
SECRET_KEY_VALUE=$(grep '^SECRET_KEY=' .env | cut -d'=' -f2-)
if echo "$SECRET_KEY_VALUE" | grep -qi "измени\|your-super\|local-dev\|change"; then
    echo "${RED}[!] Опасность: SECRET_KEY не изменён! Это небезопасно.${NC}"
    echo "    Сгенерируй ключ: python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
    echo "    И запиши его в .env"
    exit 1
fi

echo "${GREEN}[*] Запускаю Docker Compose...${NC}"
docker compose -f docker-compose.local.yml up --build -d

echo ""
echo "${GREEN}=== Готово! ===${NC}"
echo "  Приложение: http://localhost"
echo "  API docs:   http://localhost/api/v1/docs"
echo ""
echo "Логи: docker compose -f docker-compose.local.yml logs -f"
echo "Стоп: ./stop.sh"
