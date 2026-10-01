import { useEffect, useRef } from 'react';

/** Normalized pointer −1…1, smoothed on window (not R3F canvas pointer). */
export function useSmoothPointer(smoothing = 0.035) {
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const step = () => {
    const t = smoothing;
    current.current.x += (target.current.x - current.current.x) * t;
    current.current.y += (target.current.y - current.current.y) * t;
    return current.current;
  };

  return step;
}
