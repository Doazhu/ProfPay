# ProfPay — запуск и деплой

Два сценария: локально на Mac (посмотреть, проверить изменения) и на VDS,
где уже живут другие сайты.

- [Локальный запуск](#локальный-запуск)
- [Деплой на сервер](#деплой-на-сервер)
- [Второй фактор входа](#второй-фактор-входа)
- [Обновление работающего сайта](#обновление-работающего-сайта)
- [Бэкапы и восстановление](#бэкапы-и-восстановление)
- [Если что-то сломалось](#если-что-то-сломалось)

---

## Локальный запуск

Нужен Docker Desktop.

### 1. Ключи

```bash
cd ~/Project/profpay
cp .env.production.example .env
```

Сгенерируйте два ключа и вставьте их в `.env`:

```bash
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
```

```bash
python3 -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

Задайте `ADMIN_PASSWORD` — под ним будете входить.

Для локальной работы по HTTP допишите в конец `.env`. **На сервере эти три
строки надо убрать** — там HTTPS:

```
COOKIE_SECURE=false
CORS_ORIGINS=["http://localhost:8020","http://127.0.0.1:8020"]
TRUSTED_HOSTS=["localhost","127.0.0.1"]
```

Без `COOKIE_SECURE=false` браузер не сохранит куку сессии по HTTP,
и вход зациклится.

### 2. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Сайт: **http://localhost:8020**

### 3. Остановка

```bash
docker compose -f docker-compose.prod.yml down          # оставить данные
docker compose -f docker-compose.prod.yml down -v       # стереть базу тоже
```

### Разработка без Docker

Пересобирать образ на каждую правку не нужно.

**Бэкенд:**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

export DATABASE_URL="sqlite:///./local.db"
export SECRET_KEY="локальный-ключ-минимум-32-символа-длиной"
export ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
export ADMIN_PASSWORD="локальный-пароль"
export DEBUG=true

PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

SQLite годится для проверки интерфейса, но не для проверки миграций —
там нужен настоящий Postgres. Документация API при `DEBUG=true`:
http://localhost:8000/api/docs

**Фронтенд:**

```bash
npm --prefix frontend install
npm --prefix frontend run dev     # http://localhost:5173, /api проксируется на 8000
```

**Тесты:**

```bash
PYTHONPATH=. DATABASE_URL=sqlite:///test.db SECRET_KEY=test-key-at-least-32-characters-long \
  pytest backend/tests -q
```

```bash
npm --prefix frontend run build   # заодно проверяет типы
```

---

## Деплой на сервер

ProfPay не трогает ни общий `nginx.conf`, ни порты 80/443 — он слушает только
`127.0.0.1:8020`, а наружу его пускает host nginx отдельным конфигом.

```
Интернет ──► host nginx (80/443, SSL, лимиты) ──► 127.0.0.1:8020
                    │                                     │
                    ├──► ваш сайт                  profpay-frontend (nginx + React)
                    └──► ваш скрипт                        │
                                                    /api ──► profpay-backend (FastAPI)
                                                              │
                                                        profpay-db (PostgreSQL)
```

### 1. Код

```bash
sudo mkdir -p /var/www/ProfPay && sudo chown $USER:$USER /var/www/ProfPay
cd /var/www/ProfPay
git clone https://github.com/Doazhu/ProfPay.git .
```

### 2. Настройки

```bash
cp .env.production.example .env
nano .env
```

Про два ключа отдельно:

| Переменная | Что будет, если потерять |
|---|---|
| `SECRET_KEY` | Все разлогинятся. Данные целы. Минимум 32 символа, иначе приложение не стартует. |
| `ENCRYPTION_KEY` | Контакты, даты рождения и примечания станут нечитаемы навсегда. ФИО, группы, курсы и суммы останутся. |

**Сохраните `ENCRYPTION_KEY` в менеджер паролей отдельно от бэкапов базы.**
Дамп и ключ рядом — это те же данные в открытом виде.

Проверьте, что порт свободен (на сервере несколько сайтов):

```bash
sudo ss -tlnp | grep 8020
```

Занят — поставьте другой в `PROFPAY_PORT` и поправьте `proxy_pass`
в `nginx/profpay.site.conf`.

Два адресных параметра для боевого домена (в примере они закомментированы —
раскомментируйте и подставьте свой домен):

```ini
CORS_ORIGINS=https://profpay.site
TRUSTED_HOSTS=profpay.site,www.profpay.site
```

Списки пишутся через запятую; JSON вида `["https://profpay.site"]` тоже
принимается. `CORS_ORIGINS=*` приложение отвергает и не стартует: вместе
с куками сессии звёздочка означала бы, что запросы от имени вошедшего
может слать любой сайт.

### 3. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

В логе должно появиться `ProfPay 2.0.0 запущен`. Если вместо этого
`Запуск невозможен: …` — приложение назвало недостающую настройку. Это
намеренно: лучше не стартовать, чем принимать данные с полупустой конфигурацией.

```bash
curl -s http://127.0.0.1:8020/api/v1/health
```

### 4. Сертификат и nginx

```bash
sudo certbot certonly --webroot --webroot-path=/var/www/certbot \
  -d profpay.site -d www.profpay.site \
  --email ваша@почта --agree-tos --no-eff-email
```

Для webroot нужен работающий HTTP. Если это первый выпуск и сайт ещё
не отвечает, используйте `--nginx` вместо `--webroot`.

```bash
sudo cp nginx/profpay.site.conf /etc/nginx/sites-available/profpay.site
sudo ln -sf /etc/nginx/sites-available/profpay.site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` проверяет **все** сайты сразу. Если он ругается на чужой конфиг —
разберитесь до перезагрузки, иначе упадут все сайты, а не только этот.

Готово: **https://profpay.site**

### 5. Первый вход

Войдите под `ADMIN_USERNAME` из `.env`. Сразу же откроется экран привязки
приложения-аутентификатора — второй фактор обязателен по умолчанию
(подробнее ниже). После привязки **сразу смените пароль**: «Остальное» →
«Пароль и вход». Пароль из `.env` остаётся в файле на диске и в истории
команд.

---

## Второй фактор входа

Почтовый сервер не нужен: вместо писем — приложение-аутентификатор
(Google Authenticator, Aegis, 1Password и подобные).

**Второй фактор обязателен для всех и включён по умолчанию.** Он заводится
под каждую учётную запись отдельно: свой секрет, свой QR-код, свои резервные
коды. Пока приложение не привязано, вместо разделов человек видит экран
привязки — это проверяет и сервер, а не только интерфейс, поэтому обойти
требование запросом к API мимо страниц нельзя.

Как это выглядит у нового пользователя:

1. Администратор заводит запись в «Пользователи» и передаёт логин с паролем.
2. При первом входе открывается «Настройте вход по коду» с QR-кодом.
3. Человек сканирует код своим приложением и вводит шестизначное число.
4. Выдаются восемь резервных кодов. **Их надо сохранить** — повторно они
   не показываются, в базе лежат только их отпечатки. Экран не уйдёт, пока
   человек не нажмёт «Я сохранил коды»; рядом кнопки «Скачать файлом»,
   «Скопировать» и «Распечатать».
5. Дальше при каждом входе спрашивается код; смена пароля тоже
   подтверждается им.

Если коды всё-таки потерялись, а приложение работает — «Пароль и вход» →
«Новые резервные коды» (под пароль и действующий код). Прежний набор гаснет
целиком. Это единственный выход, когда фактор обязателен: отключить и
привязать заново в таком режиме нельзя.

В «Пользователях» видно, у кого приложение уже привязано, а у кого ещё нет.

Требование можно снять: «Настройки» → «Вход в систему» → выключить
«Требовать второй фактор от всех пользователей». Тогда каждый решает сам,
включать ли его в разделе «Пароль и вход». Администратор, у которого
приложение ещё не привязано, может снять требование прямо с экрана привязки —
иначе он оказался бы заперт: страница настроек закрыта тем же требованием.

### Если доступ потерян

TOTP — это *второй фактор*, а не восстановление пароля: забытый пароль он
не вернёт. Поэтому:

| Что случилось | Что делать |
|---|---|
| Забыт пароль | Другой администратор задаёт новый: «Пользователи» → «Пароль» |
| Потеряны резервные коды | «Пароль и вход» → «Новые резервные коды» |
| Потерян телефон | Резервный код при входе, либо администратор жмёт «Сбросить 2FA» |
| Администратор один и потерял всё | Аварийный скрипт на сервере, см. ниже |

```bash
docker compose -f docker-compose.prod.yml exec backend \
  python -m backend.tools.reset_admin --list

docker compose -f docker-compose.prod.yml exec backend \
  python -m backend.tools.reset_admin --username admin --password --clear-totp
```

Скрипт требует доступа к серверу — то есть того же, что и прямое
редактирование базы. Отдельной защиты у него нет и не должно быть.

---

## Обновление работающего сайта

```bash
cd /var/www/ProfPay

# 1. Бэкап — всегда
docker exec profpay-db pg_dump -U profpay_user -Fc profpay_db > backups/before_$(date +%F_%H%M).dump

# 2. Обновление
git pull
docker compose -f docker-compose.prod.yml up -d --build

# 3. Проверка
docker compose -f docker-compose.prod.yml logs --tail=50 backend
curl -s http://127.0.0.1:8020/api/v1/health
```

Новые колонки бэкенд дописывает сам при старте и пишет об этом в лог.
Смена типов колонок — отдельный шаг, см. ниже.

**После обновления второй фактор становится обязательным для всех.** Тем,
у кого приложение ещё не привязано, при следующем входе откроется экран
привязки, и до неё разделы будут закрыты. Предупредите бухгалтера заранее
и убедитесь, что телефон с приложением у него под рукой, — иначе работа
встанет на ровном месте. Если сегодня не до этого, сразу после обновления
зайдите администратором и снимите требование: «Настройки» → «Вход в систему».

### Переход на частичное шифрование

Делается **один раз** при обновлении со старой версии, где было зашифровано
всё. Приложение не стартует на старой схеме и само подскажет команду.

Что произойдёт с данными:

| Было | Станет |
|---|---|
| ФИО, группа, кафедра — шифротекст | открыто, с индексами (поиск и сортировка в SQL) |
| Суммы платежей и стипендии — шифротекст | числа (итоги считаются одним `SUM`) |
| Почта, телефон, Telegram, ВК, дата рождения, примечания | остаются зашифрованными, но новым ключом |
| Ключ завёрнут в пароль администратора | ключ в `ENCRYPTION_KEY` |
| Курс — число в колонке | год поступления, курс вычисляется |
| Поля с двойным шифрованием (след старой ошибки) | восстанавливаются |

Прогон на копии боевой схемы показал: данные переносятся целиком, включая
записи, испорченные двойным шифрованием, статусы оплаты не задеваются,
повторный запуск безопасен («База уже переведена — делать нечего»).

**1. Ключ.** До обновления допишите в `.env` на сервере:

```bash
python3 -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

Без него приложение не стартует, а миграция откажется работать.

**2. Бэкап.** Обязательно, миграция меняет типы колонок:

```bash
cd /var/www/ProfPay
mkdir -p backups
docker exec profpay-db pg_dump -U profpay_user -Fc profpay_db > backups/before_migration.dump
ls -lh backups/before_migration.dump    # убедитесь, что файл не пустой
```

**3. Код и остановка приложения.** Останавливаем только backend — база должна
остаться поднятой, миграция ходит в неё:

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml stop backend frontend
```

**4. Просмотр.** Ничего не меняет, только показывает, что прочиталось:

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
  python -m backend.tools.migrate_partial_encryption
```

Спросит пароль администратора — им разворачивается старый ключ. В выводе
должна быть строка вида «первая запись читается как «Гом Павел», группа
«1-мд-10»». Если вместо фамилии шифротекст — пароль не тот, **не продолжайте**.

**5. Применение.** Идёт одной транзакцией: при ошибке база останется как была.

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
  python -m backend.tools.migrate_partial_encryption --apply
```

**6. Запуск и проверка.**

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail=30 backend
```

Ждём `ProfPay 2.0.0 запущен`. Затем откройте список плательщиков: ФИО,
группы и суммы на месте, в карточке видны телефон и почта.

**7. После миграции.** Год поступления восстановлен из старого курса,
уровень образования всем проставлен «бакалавриат». Проверьте и поправьте:

```bash
docker exec profpay-db psql -U profpay_user -d profpay_db \
  -c "SELECT id, last_name, course AS старый_курс, admission_year, education_level FROM payers ORDER BY id"
```

Магистрантам и специалистам уровень нужно поменять в карточке — от него
зависит, когда человек уйдёт в архив.

### Если что-то пошло не так

Откат на дамп из шага 2:

```bash
docker compose -f docker-compose.prod.yml stop backend frontend
docker exec -i profpay-db pg_restore -U profpay_user -d profpay_db --clean --if-exists \
  < backups/before_migration.dump
git checkout <предыдущий-коммит>
docker compose -f docker-compose.prod.yml up -d --build
```

Старый код читает старую базу — она не менялась, пока миграция не прошла
целиком.

---

## Бэкапы и восстановление

### Ежедневно по расписанию

```bash
crontab -e
```

```cron
0 3 * * * cd /var/www/ProfPay && docker exec profpay-db pg_dump -U profpay_user -Fc profpay_db > backups/backup_$(date +\%Y\%m\%d).dump && find backups -name "*.dump" -mtime +30 -delete
```

### Восстановление

```bash
docker compose -f docker-compose.prod.yml stop backend
docker exec -i profpay-db pg_restore -U profpay_user -d profpay_db --clean --if-exists \
  < backups/backup_20260901.dump
docker compose -f docker-compose.prod.yml start backend
```

Восстановленная база читается только тем же `ENCRYPTION_KEY`. Если ключ
менялся — сначала верните старый в `.env`.

---

## Если что-то сломалось

| Симптом | Причина и что делать |
|---|---|
| `Запуск невозможен: ENCRYPTION_KEY не задан` | Ключа нет в `.env`. Сгенерируйте и впишите. |
| `Запуск невозможен: SECRET_KEY слишком короткий` | Нужно от 32 символов. |
| `База осталась от версии со сплошным шифрованием` | Запустите миграцию из раздела выше. |
| Вход зациклился, сразу выкидывает | `COOKIE_SECURE=true` при работе по HTTP. Включите HTTPS либо поставьте `false` для локального запуска. |
| `429 Слишком много попыток` | Защита от перебора. Подождите 15 минут или «Пользователи» → «Разблокировать». |
| Код из приложения не подходит | Разошлось время на телефоне — TOTP считается от часов. Включите автоматическую установку времени. |
| Контейнер `unhealthy`, а страница открывается | Проверка здоровья должна ходить на `127.0.0.1`, а не `localhost`: внутри контейнера имя резолвится в IPv6, а nginx слушает IPv4. |
| 502 Bad Gateway | Контейнеры ещё поднимаются (~30 с) или занят порт. |
| Порт 8020 занят другим сайтом | `PROFPAY_PORT` в `.env` + `proxy_pass` в `nginx/profpay.site.conf`. |
| `nginx -t` ругается на дубли зон | Имена `profpay_login` / `profpay_api` уже заняты другим сайтом. Переименуйте в конфиге ProfPay. |
| Контакты показываются пустыми | `ENCRYPTION_KEY` не тот, которым шифровали. Верните прежний ключ. |

### Полезное

```bash
cd /var/www/ProfPay

docker compose -f docker-compose.prod.yml ps               # что запущено
docker compose -f docker-compose.prod.yml logs -f backend  # логи
docker compose -f docker-compose.prod.yml restart backend  # перезапуск
docker stats --no-stream                                   # сколько ест

docker exec -it profpay-db psql -U profpay_user -d profpay_db
```

Мониторинг через telegram-бот — в `collect_alerts()`:

```python
status = os.popen("docker inspect --format='{{.State.Status}}' profpay-backend 2>/dev/null").read().strip()
if status != "running":
    alerts.append("🔴 ProfPay backend не работает")
```
