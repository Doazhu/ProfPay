<img width="1728" height="997" alt="изображение" src="https://github.com/user-attachments/assets/c418aebe-47bd-4046-b8cc-436b2756b42a" />

<img width="1728" height="999" alt="изображение" src="https://github.com/user-attachments/assets/f003aee8-c000-476b-a105-7975b70d53b4" />

<img width="1728" height="1000" alt="изображение" src="https://github.com/user-attachments/assets/d178f304-884d-4fdd-81d9-f701086dbe5e" />

<img width="1728" height="1001" alt="изображение" src="https://github.com/user-attachments/assets/d46f95d5-3b12-4045-a124-f6691214ff8d" />

<img width="1728" height="996" alt="изображение" src="https://github.com/user-attachments/assets/30de738f-6357-4be9-8d6f-1476dd138074" />

<img width="1728" height="989" alt="изображение" src="https://github.com/user-attachments/assets/49fa2bb9-dcfb-4405-b2c0-8c2888dc3bdc" />

<img width="1728" height="995" alt="изображение" src="https://github.com/user-attachments/assets/48f44576-173d-46c8-8dd2-b6fe854422ac" />

<img width="1728" height="1000" alt="изображение" src="https://github.com/user-attachments/assets/af35d7d0-cf35-461d-a374-e106d5c1487d" />


Гайд по настройке .env для деплоя ProfPay
1. Создай файл .env
cp .env.example .env

2. Заполни переменные
База данных PostgreSQL
# Для локальной разработки
DB_USER=profpay
DB_PASSWORD=profpay_secret
DB_NAME=profpay

# Для продакшена — используй надёжный пароль!
DB_USER=profpay
DB_PASSWORD=Str0ng_P@ssw0rd_2024!
DB_NAME=profpay_prod

Секретный ключ (ОБЯЗАТЕЛЬНО СМЕНИТЬ!)
# Сгенерируй ключ командой:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

SECRET_KEY=вставь_сгенерированный_ключ_сюда

JWT токены
# Время жизни access токена (минуты)
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Время жизни refresh токена (дни)
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS (разрешённые домены)
# Локальная разработка
CORS_ORIGINS=http://localhost,http://localhost:80,http://localhost:3000,http://localhost:5173

# Продакшен — укажи свой домен
CORS_ORIGINS=https://profpay.doazhu.ru,http://profpay.doazhu.ru

Режим отладки
# Разработка
DEBUG=true

# Продакшен (ВАЖНО!)
DEBUG=false

3. Пример полного .env для продакшена
# =============================================================================
# ProfPay Production Environment
# =============================================================================

# Database
DB_USER=profpay
DB_PASSWORD=Str0ng_P@ssw0rd_2024!
DB_NAME=profpay_prod

# Security (ОБЯЗАТЕЛЬНО СМЕНИТЬ!)
SECRET_KEY=your-64-character-secret-key-generated-above

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=https://profpay.youruniversity.ru

# Debug
DEBUG=false

4. Чеклист перед деплоем
 SECRET_KEY — сгенерирован уникальный ключ
 DB_PASSWORD — надёжный пароль (не profpay_secret)
 DEBUG=false
 CORS_ORIGINS — только твой домен
 Файл .env добавлен в .gitignore (не коммитить!)
 Сменить пароль админа после первого входа
5. Запуск с Docker
# Запуск всех сервисов
docker-compose up -d --build

# Проверка
docker-compose ps
docker-compose logs -f backend

6. Без Docker (ручной деплой)
# Backend
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://profpay:Str0ng_P@ssw0rd_2024!@localhost:5432/profpay_prod"
export SECRET_KEY="твой_секретный_ключ"
export DEBUG=false

# Запуск с gunicorn (продакшен)
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
