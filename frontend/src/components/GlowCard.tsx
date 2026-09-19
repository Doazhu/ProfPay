import { ReactNode, lazy, Suspense, useEffect, useState } from 'react';
import { Card } from '@radix-ui/themes';

import { useTheme } from '../theme/ThemeContext';

/*
  Карточка со свечением по краю под курсором.

  Обёртка над BorderGlow из React Bits. Смысл обёртки в трёх вещах:

  - цвета берутся из оформления сайта, а не из фиолетово-розовой палитры
    по умолчанию: зелёный акцент, спокойный контур, фон панели по теме;
  - в классическом оформлении и при «уменьшить движение» свечения нет,
    рисуется обычная карточка Radix;
  - сам компонент с его тяжёлыми масками грузится отдельным куском.

  Цвет фона приходится задавать конкретным значением, а не переменной темы:
  компонент считает по нему яркость, чтобы выбрать светлый или тёмный набор
  теней, и `var(--color-panel-solid)` он разобрать не сможет.
*/
const BorderGlow = lazy(() => import('./BorderGlow.jsx'));

/** Фон карточки и палитра контура — по одному набору на тему. */
const PALETTE = {
  dark: {
    background: '#121B16',
    glow: '142 45 55',                              // зелёный акцент в HSL
    colors: ['#53b997', '#3E9C7C', '#2f6d59'] as string[],
  },
  light: {
    background: '#FFFFFF',
    glow: '142 40 45',
    colors: ['#3E9C7C', '#53b997', '#8ecfb4'] as string[],
  },
} as const;

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  /** Отступ внутри карточки — как size у Radix Card. */
  padding?: number;
}

export default function GlowCard({ children, className, padding = 20 }: GlowCardProps) {
  const { skin, resolvedAppearance } = useTheme();
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    if (skin !== 'radix') {
      setGlow(false);
      return;
    }
    setGlow(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [skin]);

  if (!glow) {
    return <Card size="2" className={className}>{children}</Card>;
  }

  const palette = PALETTE[resolvedAppearance];

  return (
    <Suspense fallback={<Card size="2" className={className}>{children}</Card>}>
      <BorderGlow
        className={className}
        backgroundColor={palette.background}
        glowColor={palette.glow}
        colors={palette.colors}
        // Скругление и мягкость подогнаны под остальные карточки: у Radix
        // при radius="large" это 12 px, а исходные 28 выглядели инородно.
        borderRadius={12}
        glowRadius={24}
        glowIntensity={0.7}
        edgeSensitivity={35}
        fillOpacity={0.35}
      >
        <div style={{ padding }}>{children}</div>
      </BorderGlow>
    </Suspense>
  );
}
