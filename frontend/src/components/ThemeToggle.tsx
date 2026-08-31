import { DesktopIcon, MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { IconButton, SegmentedControl, Tooltip } from '@radix-ui/themes';
import { Appearance, useTheme } from '../theme/ThemeContext';

/**
 * Быстрый переключатель светлого и тёмного вида — одна кнопка в шапке.
 *
 * Показывает иконку того, во что переключит, а не текущего состояния:
 * так понятнее, что произойдёт по нажатию.
 */
export function ThemeToggleButton() {
  const { resolvedAppearance, toggleAppearance } = useTheme();
  const goingDark = resolvedAppearance === 'light';

  return (
    <Tooltip content={goingDark ? 'Тёмная тема' : 'Светлая тема'}>
      <IconButton
        variant="ghost"
        color="gray"
        size="2"
        onClick={toggleAppearance}
        aria-label={goingDark ? 'Включить тёмную тему' : 'Включить светлую тему'}
      >
        {goingDark ? <MoonIcon /> : <SunIcon />}
      </IconButton>
    </Tooltip>
  );
}

const OPTIONS: { value: Appearance; label: string; icon: JSX.Element }[] = [
  { value: 'light', label: 'Светлая', icon: <SunIcon /> },
  { value: 'system', label: 'Как в системе', icon: <DesktopIcon /> },
  { value: 'dark', label: 'Тёмная', icon: <MoonIcon /> },
];

/**
 * Полный выбор для настроек: светлая, тёмная или как в системе.
 *
 * Вариант «как в системе» стоит по умолчанию — если у человека на маке
 * включена тёмная тема, сайт откроется тёмным без лишних действий.
 */
export function ThemeAppearanceControl() {
  const { appearance, setAppearance } = useTheme();

  return (
    <SegmentedControl.Root
      value={appearance}
      onValueChange={(value) => setAppearance(value as Appearance)}
      size="2"
    >
      {OPTIONS.map((option) => (
        <SegmentedControl.Item key={option.value} value={option.value}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {option.icon}
            {option.label}
          </span>
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
}
