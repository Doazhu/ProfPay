import { ReactNode, lazy, Suspense, useEffect, useState } from 'react';

import { useTheme } from '../theme/ThemeContext';

/*
  Появление блока при прокрутке.

  Обёртка над AnimatedContent из React Bits, и вся её работа — решить, надо ли
  вообще анимировать:

  - в классическом оформлении анимаций нет, это его смысл;
  - при «уменьшить движение» в системе их тоже нет;
  - gsap весит прилично, поэтому грузится отдельным куском и только тогда,
    когда действительно нужен.

  Пока кусок не загрузился, содержимое показывается как есть. Прятать его
  на это время нельзя: на медленной сети главная моргала бы пустотой.
*/
const AnimatedContent = lazy(() => import('./AnimatedContent.jsx'));

/*
  Прокручивается не окно, а <main> в Layout — у него свой overflow. ScrollTrigger
  по умолчанию слушает окно и в таком случае не срабатывает никогда: блоки
  остались бы невидимыми. Поэтому явно указываем, что считать полосой прокрутки.
*/
const SCROLL_CONTAINER = '#app-scroll';

interface RevealProps {
  children: ReactNode;
  /** Задержка, чтобы соседние блоки появлялись друг за другом, а не разом. */
  delay?: number;
  distance?: number;
  duration?: number;
  className?: string;
}

export default function Reveal({
  children, delay = 0, distance = 28, duration = 0.55, className,
}: RevealProps) {
  const { skin } = useTheme();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (skin !== 'radix') {
      setAnimate(false);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimate(false);
      return;
    }
    /*
      Без прокручиваемого элемента ScrollTrigger слушал бы окно и не сработал
      бы никогда — содержимое осталось бы скрытым навсегда. Пустая страница
      хуже отсутствия анимации, поэтому в таком случае просто не анимируем.
    */
    setAnimate(document.querySelector(SCROLL_CONTAINER) !== null);
  }, [skin]);

  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Suspense fallback={<div className={className}>{children}</div>}>
      <AnimatedContent
        container={SCROLL_CONTAINER}
        distance={distance}
        duration={duration}
        delay={delay}
        ease="power3.out"
        threshold={0.05}
        className={className}
        onComplete={undefined}
        onDisappearanceComplete={undefined}
      >
        {children}
      </AnimatedContent>
    </Suspense>
  );
}
