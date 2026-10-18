import { lazy, Suspense } from 'react';
import { useShow3D } from '../hooks/useShow3D';

const Scene = lazy(() => import('./Scene').then((m) => ({ default: m.Scene })));

/** Static gradient fallback; the 3D scene is an async chunk mounted only on wide, motion-OK viewports. */
export function HeroBackdrop() {
  const show3D = useShow3D();
  return (
    <>
      <div className="scene-fallback" aria-hidden="true" />
      {show3D && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
    </>
  );
}
