/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  // Сброс Tailwind выключен: его правило для <button> перебивает фон кнопок
  // Radix Themes, и они рисуются прозрачными (об этом прямо сказано
  // в документации Radix). Сброс даёт сама Radix Themes.
  corePlugins: { preflight: false },

  theme: {
    extend: {
      /*
        Палитра указывает на токены Radix Themes, а не на конкретные цвета.
        Так все старые классы вида `bg-light` и `text-dark`, которых в разметке
        сотни, начинают следовать выбранной теме: Radix подменяет значения
        переменных при переключении светлого и тёмного вида, а правила Tailwind
        остаются прежними.

        Прозрачность через дробь (`bg-light/60`) с такими цветами не работает —
        для полупрозрачных фонов есть отдельные alpha-токены Radix (`--gray-a3`),
        они вынесены ниже как `*-a`.
      */
      colors: {
        primary: {
          DEFAULT: 'var(--accent-9)',
          dark:    'var(--accent-10)',
          light:   'var(--accent-8)',
          50:      'var(--accent-2)',
          100:     'var(--accent-3)',
        },
        accent: {
          DEFAULT: 'var(--gray-11)',
          light:   'var(--gray-10)',
          dark:    'var(--gray-12)',
        },
        dark: {
          DEFAULT: 'var(--gray-12)',
          light:   'var(--gray-11)',
        },
        light: {
          DEFAULT: 'var(--color-background)',
          dark:    'var(--gray-a3)',
          darker:  'var(--gray-a6)',
        },
        panel:  'var(--color-panel-solid)',
        surface:'var(--color-surface)',
        line:   'var(--gray-a5)',
        state: {
          paid:   'var(--jade-11)',
          unpaid: 'var(--red-11)',
          part:   'var(--amber-11)',
          arch:   'var(--gray-10)',
        },

      /*
        Цветные шкалы Tailwind переведены на токены Radix.

        В разметке остались сотни классов вида `bg-red-50` и `text-green-700`
        с фиксированными светлыми оттенками. На тёмной теме они светились
        белыми и салатовыми пятнами, потому что не зависят от оформления.
        Теперь каждый оттенок указывает на шаг радиксовой шкалы, и цвета
        подменяются вместе с темой.

        Соответствие по смыслу шагов Radix: 2 — приглушённый фон,
        3 — фон элемента, 6/7 — границы, 9 — заливка, 11 — текст на фоне,
        12 — контрастный текст.
      */
      ...Object.fromEntries(
        ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'amber'].map((name) => [
          name,
          {
            50:  `var(--${name}-2)`,
            100: `var(--${name}-3)`,
            200: `var(--${name}-6)`,
            300: `var(--${name}-7)`,
            400: `var(--${name}-8)`,
            500: `var(--${name}-9)`,
            600: `var(--${name}-11)`,
            700: `var(--${name}-11)`,
            800: `var(--${name}-12)`,
            900: `var(--${name}-12)`,
          },
        ]),
      ),

      gray: {
        50:  'var(--gray-2)',
        100: 'var(--gray-3)',
        200: 'var(--gray-4)',
        300: 'var(--gray-7)',
        400: 'var(--gray-8)',
        500: 'var(--gray-9)',
        600: 'var(--gray-11)',
        700: 'var(--gray-11)',
        800: 'var(--gray-12)',
        900: 'var(--gray-12)',
      },
      },

      fontFamily: {
        // Шрифты задаёт Radix Themes своей переменной; внешних CDN нет,
        // поэтому Content-Security-Policy остаётся с font-src 'self'.
        sans: ['var(--default-font-family)'],
        mono: ['var(--code-font-family)'],
      },

      borderRadius: {
        DEFAULT: 'var(--radius-2)',
        md: 'var(--radius-2)',
        lg: 'var(--radius-3)',
        xl: 'var(--radius-4)',
        '2xl': 'var(--radius-5)',
        '3xl': 'var(--radius-6)',
      },

      boxShadow: {
        soft: 'var(--shadow-2)',
        'soft-md': 'var(--shadow-3)',
        'soft-lg': 'var(--shadow-4)',
      },

      keyframes: { 'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } } },
      animation: { 'fade-in': 'fade-in 120ms ease-out' },
    },
  },
  plugins: [],
}
