import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode,
} from 'react';

/**
 * Оформление приложения.
 *
 * Хранит две независимые настройки:
 *  - светлая / тёмная / как в системе;
 *  - классический вид (прежнее оформление) вместо нового.
 *
 * Классические стили лежат отдельным файлом и подгружаются только тогда,
 * когда их включили. Vite вынесет их в отдельный кусок сборки, поэтому
 * у тех, кто пользуется новым видом, они не скачиваются вовсе.
 */

export type Appearance = 'light' | 'dark' | 'system';
export type Skin = 'radix' | 'classic';

const APPEARANCE_KEY = 'profpay.appearance';
const SKIN_KEY = 'profpay.skin';

interface ThemeContextValue {
  /** Что выбрал пользователь. */
  appearance: Appearance;
  /** Что показывается на самом деле — 'system' уже разрешён в light/dark. */
  resolvedAppearance: 'light' | 'dark';
  setAppearance: (value: Appearance) => void;
  /** Переключает светлое ↔ тёмное, отталкиваясь от текущего вида. */
  toggleAppearance: () => void;

  skin: Skin;
  setSkin: (value: Skin) => void;
  /** Классические стили уже загружены — нужно, чтобы не мигало при переключении. */
  classicLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** localStorage может быть недоступен: приватное окно, запрет на сайт. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Настройка не сохранится между сессиями — работать это не мешает.
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(
    () => readStored(APPEARANCE_KEY, ['light', 'dark', 'system'] as const, 'system'),
  );
  const [skin, setSkinState] = useState<Skin>(
    () => readStored(SKIN_KEY, ['radix', 'classic'] as const, 'radix'),
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [classicLoaded, setClassicLoaded] = useState(false);

  // Следим за системной настройкой, пока выбран режим «как в системе».
  useEffect(() => {
    if (appearance !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    setSystemDark(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, [appearance]);

  const resolvedAppearance: 'light' | 'dark' =
    appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance;

  // Классические стили тянем по требованию — отдельным куском сборки.
  useEffect(() => {
    if (skin !== 'classic' || classicLoaded) return;
    let cancelled = false;
    import('../styles/classic.css')
      .then(() => { if (!cancelled) setClassicLoaded(true); })
      .catch((error) => console.error('Не удалось загрузить классические стили:', error));
    return () => { cancelled = true; };
  }, [skin, classicLoaded]);

  // Класс на <html> нужен и стилям, и браузеру: по color-scheme он подбирает
  // цвет полос прокрутки и системных полей ввода.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('classic-skin', skin === 'classic');
    root.style.colorScheme = resolvedAppearance;
  }, [skin, resolvedAppearance]);

  /*
    Плавная смена темы.

    Переход по цвету включается только на время переключения. Держать его
    постоянно нельзя: тогда каждое наведение на строку таблицы тянулось бы
    четверть секунды и список начал бы «плыть». Первую отрисовку пропускаем —
    иначе страница проявлялась бы через переход при каждой загрузке.
  */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = document.documentElement;
    root.classList.add('theme-switching');
    const timer = window.setTimeout(() => root.classList.remove('theme-switching'), 300);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove('theme-switching');
    };
  }, [resolvedAppearance]);

  const setAppearance = useCallback((value: Appearance) => {
    setAppearanceState(value);
    writeStored(APPEARANCE_KEY, value);
  }, []);

  const setSkin = useCallback((value: Skin) => {
    setSkinState(value);
    writeStored(SKIN_KEY, value);
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
  }, [resolvedAppearance, setAppearance]);

  const value = useMemo<ThemeContextValue>(() => ({
    appearance,
    resolvedAppearance,
    setAppearance,
    toggleAppearance,
    skin,
    setSkin,
    classicLoaded,
  }), [appearance, resolvedAppearance, setAppearance, toggleAppearance, skin, setSkin, classicLoaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme должен вызываться внутри ThemeProvider');
  return context;
}
