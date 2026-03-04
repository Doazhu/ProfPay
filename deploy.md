# ProfPay — Деплой на VDS (Ubuntu)

Домен: `profpay.site`
Архитектура: Docker (db + backend + frontend на `127.0.0.1:8020`) → HOST nginx (SSL) → интернет

---

## 1. Подготовка сервера

```bash
sudo apt update && sudo apt upgrade -y

# Docker (если ещё нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Certbot
sudo apt install -y certbot python3-certbot-nginx

# Firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 2. DNS

Добавь A-запись:
```
profpay.site → A → <IP_СЕРВЕРА>
```

Проверка: `dig profpay.site +short`

---

## 3. Клонирование

```bash
sudo mkdir -p /var/www/ProfPay
sudo chown $USER:$USER /var/www/ProfPay
cd /var/www/ProfPay
git clone https://github.com/<USERNAME>/ProfPay.git .
```

---

## 4. Настройка .env

```bash
cp .env.production.example .env
nano .env
```

Заполни все поля. Сгенерируй SECRET_KEY:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## 5. Деплой (один скрипт)

```bash
cd /var/www/ProfPay
./init-ssl.sh me@doazhu.pro
```

Скрипт:
1. Установит certbot (если нет)
2. Создаст временный nginx конфиг для ACME challenge
3. Получит SSL сертификат от Let's Encrypt
4. Поставит полный nginx конфиг с SSL → proxy на `127.0.0.1:8020`
5. Соберёт и запустит Docker контейнеры

Проверь: **https://profpay.site**

---

## 6. Ручной деплой (без скрипта)

### 6.1. Nginx конфиг

```bash
cp nginx/profpay.site.conf /etc/nginx/sites-available/profpay.site
ln -sf /etc/nginx/sites-available/profpay.site /etc/nginx/sites-enabled/
```

Перед этим получи сертификат:
```bash
# Сначала временный конфиг только с HTTP
certbot certonly --webroot --webroot-path=/var/www/certbot -d profpay.site --email me@doazhu.pro --agree-tos --no-eff-email

# Потом полный конфиг
cp nginx/profpay.site.conf /etc/nginx/sites-available/profpay.site
nginx -t && systemctl reload nginx
```

### 6.2. Docker

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 7. Полезные команды

```bash
cd /var/www/ProfPay

# Статус
docker compose -f docker-compose.prod.yml ps

# Логи
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend

# Перезапуск
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml restart backend

# Обновление кода
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Остановка
docker compose -f docker-compose.prod.yml down
```

---

## 8. Бэкапы

### Ручной

```bash
mkdir -p /var/www/ProfPay/backups
docker exec profpay-db pg_dump -U profpay_user profpay_db | gzip > /var/www/ProfPay/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление

```bash
docker compose -f docker-compose.prod.yml stop backend
gunzip -c backups/backup_XXXXXX.sql.gz | docker exec -i profpay-db psql -U profpay_user profpay_db
docker compose -f docker-compose.prod.yml start backend
```

### Автоматический (cron, каждый день 3:00)

```bash
crontab -e
```
```cron
0 3 * * * docker exec profpay-db pg_dump -U profpay_user profpay_db | gzip > /var/www/ProfPay/backups/backup_$(date +\%Y\%m\%d).sql.gz && find /var/www/ProfPay/backups -name "*.sql.gz" -mtime +30 -delete
```

---

## 9. Telegram-бот мониторинг

В `/opt/vds_bot/bot.py`, в функцию `collect_alerts()`:

```python
# Проверка ProfPay
result = os.popen("docker inspect --format='{{.State.Status}}' profpay-backend 2>/dev/null").read().strip()
if result != "running":
    alerts.append("🔴 ProfPay backend не работает!")
```

```bash
sudo systemctl restart vds_bot
```

---

## 10. SSL обновление

Certbot автоматически обновляет. Проверка:
```bash
certbot certificates
certbot renew --dry-run
```

---

## 11. Проблемы

| Проблема | Решение |
|----------|---------|
| Порт 8020 занят | Поменяй в `docker-compose.prod.yml` и `profpay.site.conf` |
| Backend не стартует | `docker compose -f docker-compose.prod.yml logs backend` |
| 502 Bad Gateway | Контейнеры ещё запускаются, подожди 30 сек |
| SSL не работает | `certbot certificates` — проверь что сертификат есть |

---

## Архитектура

```
Интернет → HOST nginx (80/443, SSL) → 127.0.0.1:8020
                                          ↓
                               Docker: profpay-frontend (nginx)
                                   /          \
                                  /            \
                         React SPA          /api → profpay-backend (FastAPI:8000)
                                                        ↓
                                                   profpay-db (PostgreSQL)
```
