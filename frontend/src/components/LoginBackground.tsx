import { Suspense, lazy, useEffect, useState } from 'react';

/*
  Тяжёлая графика грузится отдельным куском и только когда браузер её
  действительно потянет. Вход — единственная страница, которую человек видит
  до аутентификации, и она обязана открываться даже там, где WebGPU нет:
  на старом ноутбуке в профкоме, в Firefox под Linux, в режиме экономии
  движения. Поэтому под канвасом всегда лежит статичная заливка, а канвас
  накладывается сверху, если получилось его завести.
*/
const AeroShards = lazy(() => import('./AeroShards.jsx'));

/** Цвета берутся из темы, чтобы фон не спорил со светлым оформлением. */
interface Palette {
  background: string;
  shard: string;
  accent: string;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  dark: { background: '#0B1210', shard: '#53b997', accent: '#0059eb' },
  light: { background: '#EAF1EC', shard: '#3E9C7C', accent: '#2563EB' },
};

function supportsWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LoginBackground({ appearance }: { appearance: 'light' | 'dark' }) {
  const palette = PALETTES[appearance];

  // Решение принимается один раз при монтировании: переключение темы не
  // должно пересоздавать контекст WebGPU.
  const [animated, setAnimated] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (supportsWebGpu() && !prefersReducedMotion()) setAnimated(true);
  }, []);

  return (
    <div className="login-bg" aria-hidden="true">
      {/*
        Статичная подложка. Она же остаётся единственным фоном, если WebGPU
        недоступен или инициализация упала — тогда страница просто выглядит
        спокойнее, а не ломается.
      */}
      <div
        className="login-bg__still"
        style={{
          background:
            `radial-gradient(120% 90% at 78% 12%, ${palette.shard}26 0%, transparent 55%),`
            + `radial-gradient(90% 70% at 12% 88%, ${palette.accent}1f 0%, transparent 60%),`
            + palette.background,
        }}
      />

      {animated && !failed && (
        <Suspense fallback={null}>
          <div className="login-bg__canvas">
            <AeroShards
              backgroundColor={palette.background}
              shardColor={palette.shard}
              accentColor={palette.accent}
              placement="center"
              material="satin"
              detail="balanced"
              effect="none"
              flow="stream"
              rippleIntensity={0.6}
              holdToGather
              scale={1.1}
              spread={0.9}
              depth={0.65}
              speed={0.75}
              spin={1.55}
              interaction="repel"
              density={1.5}
              shardSize={1.15}
              stretch={1}
              turbulence={1}
              glow={0.55}
              edgeSoftness={2}
              bloom={0.5}
              grain={0.05}
              chromaticAberration={0.0075}
              transitionDuration={1}
              interactionRadius={1.5}
              interactionStrength={0.5}
              paused={false}
              onError={() => setFailed(true)}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
