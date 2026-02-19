#!/bin/sh
# =============================================================================
# ProfPay — настройка HTTPS через mkcert (локально-доверенные сертификаты)
# Запускай один раз. После этого используй start-https.sh для старта.
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "${GREEN}=== ProfPay HTTPS Setup ===${NC}"
echo ""

# Проверяем mkcert
if ! command -v mkcert >/dev/null 2>&1; then
    echo "${RED}[!] mkcert не установлен.${NC}"
    echo ""
    echo "Установи mkcert:"
    echo ""
    echo "  Ubuntu/Debian (WSL):"
    echo "    sudo apt install libnss3-tools"
    echo "    curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/amd64"
    echo "    chmod +x mkcert-v*-linux-amd64"
    echo "    sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert"
    echo ""
    echo "  macOS:"
    echo "    brew install mkcert"
    echo "    brew install nss"
    echo ""
    echo "  Windows (PowerShell от администратора):"
    echo "    choco install mkcert"
    echo "    # или: scoop install mkcert"
    echo ""
    exit 1
fi

echo "${GREEN}[*] mkcert найден: $(mkcert --version)${NC}"

# Устанавливаем локальный CA (если ещё не установлен)
echo "${GREEN}[*] Устанавливаю локальный CA в системное хранилище...${NC}"
mkcert -install

# Создаём папку для сертификатов
mkdir -p nginx/ssl

# Генерируем сертификат для localhost
echo "${GREEN}[*] Генерирую сертификат для localhost...${NC}"
mkcert -cert-file nginx/ssl/localhost.crt -key-file nginx/ssl/localhost.key localhost 127.0.0.1 ::1

echo ""
echo "${GREEN}=== Сертификат создан! ===${NC}"
echo "  Файлы: nginx/ssl/localhost.crt и nginx/ssl/localhost.key"
echo ""
echo "Теперь запусти:"
echo "  ./start-https.sh"
