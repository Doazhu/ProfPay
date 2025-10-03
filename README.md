# ProfPay

## Структура проекта

```
ProfPay/
├── backend/          # Backend сервер
├── frontend/         # React приложение (Create React App)
│   └── react/        # React приложение (Vite)
└── README.md
```

## Frontend

### React приложение (Create React App)

Расположение: `frontend/`

#### Зависимости

**Основные зависимости:**
- `react` ^19.2.0 - Основная библиотека React
- `react-dom` ^19.2.0 - React DOM для рендеринга
- `react-scripts` 5.0.1 - Скрипты для Create React App
- `typescript` ^4.9.5 - TypeScript поддержка
- `web-vitals` ^2.1.4 - Метрики производительности

**Зависимости для тестирования:**
- `@testing-library/dom` ^10.4.1 - Утилиты для тестирования DOM
- `@testing-library/jest-dom` ^6.9.1 - Jest matchers для DOM
- `@testing-library/react` ^16.3.0 - Утилиты для тестирования React компонентов
- `@testing-library/user-event` ^13.5.0 - Симуляция пользовательских событий
- `@types/jest` ^27.5.2 - TypeScript типы для Jest

**TypeScript типы:**
- `@types/node` ^16.18.126 - TypeScript типы для Node.js
- `@types/react` ^19.2.0 - TypeScript типы для React
- `@types/react-dom` ^19.2.0 - TypeScript типы для React DOM

#### Скрипты

```bash
npm start      # Запуск в режиме разработки
npm run build  # Сборка для продакшена
npm test       # Запуск тестов
npm run eject  # Извлечение конфигурации (необратимо)
```

### React приложение (Vite)

Расположение: `frontend/react/`

#### Зависимости

**Основные зависимости:**
- `react` ^19.1.1 - Основная библиотека React
- `react-dom` ^19.1.1 - React DOM для рендеринга

**Dev зависимости:**
- `@eslint/js` ^9.36.0 - ESLint JavaScript правила
- `@types/node` ^24.6.0 - TypeScript типы для Node.js
- `@types/react` ^19.1.16 - TypeScript типы для React
- `@types/react-dom` ^19.1.9 - TypeScript типы для React DOM
- `@vitejs/plugin-react` ^5.0.4 - Vite плагин для React
- `autoprefixer` ^10.4.21 - Автоматическое добавление префиксов CSS
- `babel-plugin-react-compiler` ^19.1.0-rc.3 - Babel плагин для React Compiler
- `eslint` ^9.36.0 - Линтер для JavaScript/TypeScript
- `eslint-plugin-react-hooks` ^5.2.0 - ESLint правила для React Hooks
- `eslint-plugin-react-refresh` ^0.4.22 - ESLint правила для React Refresh
- `globals` ^16.4.0 - Глобальные переменные для ESLint
- `postcss` ^8.5.6 - CSS постпроцессор
- `tailwindcss` ^4.1.14 - CSS фреймворк
- `typescript` ~5.9.3 - TypeScript компилятор
- `typescript-eslint` ^8.45.0 - ESLint правила для TypeScript
- `vite` ^7.1.7 - Сборщик и dev сервер

#### Скрипты

```bash
npm run dev     # Запуск в режиме разработки
npm run build   # Сборка для продакшена
npm run lint    # Запуск линтера
npm run preview # Предварительный просмотр сборки
```

## Установка и запуск

### Frontend (Create React App)

```bash
cd frontend
npm install
npm start
```

### Frontend (Vite)

```bash
cd frontend/react
npm install
npm run dev
```
