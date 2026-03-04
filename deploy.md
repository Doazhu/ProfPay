# ProfPay — Деплой на VDS (Ubuntu)

Домен: `profpay.site`
Структура сервера: `/var/www/profpay.site/`

---

## 1. Подготовка сервера

### 1.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Docker и Docker Compose

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh

# Добавить текущего пользователя в группу docker (чтобы без sudo)
sudo usermod -aG docker $USER

# Перелогинься, чтобы группа применилась
exit
# Зайди заново по SSH

# Проверка
docker --version
docker compose version
```

### 1.3 Установка Git

```bash
sudo apt install -y git
```

### 1.4 Настройка Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 2. Настройка DNS

Убедись, что A-запись домена указывает на IP сервера:

```
profpay.site → A → <IP_СЕРВЕРА>
```

Проверить:
```bash
dig profpay.site +short
# Должен вернуть IP твоего сервера
```

---

## 3. Клонирование проекта

```bash
# Создаём директорию по структуре сервера
sudo mkdir -p /var/www/profpay.site
sudo chown $USER:$USER /var/www/profpay.site

# Клонируем
cd /var/www/profpay.site
git clone https://github.com/<ТВОЙ_ЮЗЕРНЕЙМ>/ProfPay.git .
```

> Если репозиторий приватный:
> ```bash
> # Сгенерируй SSH-ключ на сервере
> ssh-keygen -t ed25519 -C "server-profpay"
> cat ~/.ssh/id_ed25519.pub
> # Добавь этот ключ в Settings → Deploy keys репозитория на GitHub
> git clone git@github.com:<ТВОЙ_ЮЗЕРНЕЙМ>/ProfPay.git .
> ```

---

## 4. Настройка .env

```bash
cd /var/www/profpay.site

# Копируем шаблон
cp .env.production.example .env

# Генерируем SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Редактируем .env
nano .env
```

Заполни **ВСЕ** поля:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<НАДЁЖНЫЙ_ПАРОЛЬ>

POSTGRES_USER=profpay_user
POSTGRES_PASSWORD=<НАДЁЖНЫЙ_ПАРОЛЬ_БД>
POSTGRES_DB=profpay_db

SECRET_KEY=<ВСТАВЬ_СГЕНЕРИРОВАННЫЙ_КЛЮЧ>

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

DEBUG=false
```

---

## 5. Получение SSL-сертификата

### 5.1 Первый запуск — получение сертификата

```bash
cd /var/www/profpay.site
./init-ssl.sh your-email@example.com
```

Скрипт автоматически:
1. Запустит временный nginx для ACME challenge
2. Получит сертификат от Let's Encrypt
3. Запустит весь проект с HTTPS

### 5.2 Проверка

```bash
# Проверяем статус контейнеров
docker compose -f docker-compose.prod.yml ps

# Должны быть Running:
# profpay-db        — PostgreSQL
# profpay-backend   — FastAPI API
# profpay-frontend  — React (nginx)
# profpay-nginx     — Reverse proxy + SSL
# profpay-certbot   — Авто-обновление сертификата
```

Открой в браузере: **https://profpay.site**

---

## 6. Полезные команды

### Логи

```bash
cd /var/www/profpay.site

# Все контейнеры
docker compose -f docker-compose.prod.yml logs -f

# Конкретный сервис
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f db
```

### Перезапуск

```bash
# Перезапуск всех сервисов
docker compose -f docker-compose.prod.yml restart

# Перезапуск одного сервиса
docker compose -f docker-compose.prod.yml restart backend
```

### Обновление (новая версия кода)

```bash
cd /var/www/profpay.site
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Остановка

```bash
docker compose -f docker-compose.prod.yml down
```

### Полная очистка (с удалением БД!)

```bash
docker compose -f docker-compose.prod.yml down -v
```

---

## 7. Бэкапы БД

### Ручной бэкап

```bash
# Создаём директорию для бэкапов
mkdir -p /var/www/profpay.site/backups

# Бэкап
docker exec profpay-db pg_dump -U profpay_user profpay_db | gzip > /var/www/profpay.site/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление из бэкапа

```bash
# Остановить backend
docker compose -f docker-compose.prod.yml stop backend

# Восстановить
gunzip -c /var/www/profpay.site/backups/backup_XXXXXXXX_XXXXXX.sql.gz | docker exec -i profpay-db psql -U profpay_user profpay_db

# Запустить backend
docker compose -f docker-compose.prod.yml start backend
```

### Автоматический бэкап (cron)

```bash
crontab -e
```

Добавь строку (бэкап каждый день в 3:00):

```cron
0 3 * * * docker exec profpay-db pg_dump -U profpay_user profpay_db | gzip > /var/www/profpay.site/backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz && find /var/www/profpay.site/backups -name "*.sql.gz" -mtime +30 -delete
```

---

## 8. Мониторинг через Telegram-бота

Если у тебя уже настроен бот на сервере (`/opt/vds_bot/bot.py`), добавь ProfPay в мониторинг.

В файле `/opt/vds_bot/bot.py`, в список сервисов для мониторинга добавь:

```python
# В блоке где определяются сервисы для мониторинга:
"profpay": {
    "container": "profpay-backend",
    "url": "http://localhost:8000/api/v1/health",  # не будет работать снаружи, проверяй через docker
    "check_cmd": "docker inspect --format='{{.State.Status}}' profpay-backend",
}
```

Или проще — добавь проверку в `collect_alerts()`:

```python
# Проверка ProfPay
result = os.popen("docker inspect --format='{{.State.Status}}' profpay-backend 2>/dev/null").read().strip()
if result != "running":
    alerts.append("🔴 ProfPay backend не работает!")

result = os.popen("docker inspect --format='{{.State.Status}}' profpay-nginx 2>/dev/null").read().strip()
if result != "running":
    alerts.append("🔴 ProfPay nginx не работает!")
```

После правок:
```bash
sudo systemctl restart vds_bot
```

---

## 9. Обновление SSL-сертификата

Certbot автоматически обновляет сертификат (контейнер `profpay-certbot` проверяет каждые 12 часов). Ничего делать не нужно.

Ручная проверка:
```bash
docker compose -f docker-compose.prod.yml exec certbot certbot certificates
```

---

## 10. Возможные проблемы

### Порт 80 или 443 занят

Если на сервере уже работает другой nginx/apache:

```bash
# Проверь что занимает порт
sudo lsof -i :80
sudo lsof -i :443

# Если это системный nginx — останови его
sudo systemctl stop nginx
sudo systemctl disable nginx
```

ProfPay использует свой nginx в Docker, поэтому системный nginx не нужен.

**Если нужно держать несколько проектов** на одном сервере через один nginx — смотри раздел 11.

### Контейнер не стартует

```bash
# Посмотреть логи
docker compose -f docker-compose.prod.yml logs backend

# Частая причина — БД ещё не готова, backend перезапустится автоматически (restart: unless-stopped)
```

### Ошибка "permission denied" при работе с Docker

```bash
sudo usermod -aG docker $USER
# Затем перелогинься
```

---

## 11. Несколько проектов на одном VDS

Если на сервере уже есть другие сайты, нужен общий reverse proxy. Варианты:

### Вариант A: Системный nginx как главный proxy

Убери порты `80:80` и `443:443` из `docker-compose.prod.yml`, замени на внутренний порт:

```yaml
  nginx:
    ports:
      - "127.0.0.1:8080:80"  # Только локально
    # Убрать volumes с certbot и SSL конфигом
    volumes:
      - ./nginx/nginx.local.conf:/etc/nginx/conf.d/default.conf:ro
```

Убери контейнер `certbot` из `docker-compose.prod.yml`.

Настрой системный nginx:

```bash
sudo nano /etc/nginx/sites-available/profpay.site
```

```nginx
server {
    listen 80;
    server_name profpay.site;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name profpay.site;

    ssl_certificate /etc/letsencrypt/live/profpay.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/profpay.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/profpay.site /etc/nginx/sites-enabled/
sudo certbot --nginx -d profpay.site
sudo nginx -t && sudo systemctl reload nginx
```

### Вариант B: Использовать nginx-proxy + acme-companion

Для автоматического управления несколькими Docker-проектами. Но это более сложный вариант, рекомендуется вариант A.

---

## Краткая шпаргалка

```bash
# Деплой с нуля
cd /var/www/profpay.site
cp .env.production.example .env
nano .env                                     # заполнить
./init-ssl.sh your@email.com                  # SSL + запуск

# Обновление
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Логи
docker compose -f docker-compose.prod.yml logs -f

# Бэкап
docker exec profpay-db pg_dump -U profpay_user profpay_db | gzip > backup.sql.gz

# Статус
docker compose -f docker-compose.prod.yml ps
```
