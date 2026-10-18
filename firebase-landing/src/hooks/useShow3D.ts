import { useEffect, useState } from 'react';

const QUERY = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';

/** True only on wide viewports where the user has not asked for reduced motion. */
export function useShow3D(): boolean {
  const [show, setShow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setShow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return show;
}
