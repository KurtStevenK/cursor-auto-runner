import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Props = {
  as?: 'div' | 'section' | 'article' | 'span' | 'h1' | 'p';
  className?: string;
  id?: string;
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Reveal when scrolled into view instead of on mount. */
  inView?: boolean;
  variant?: 'up' | 'fade' | 'left' | 'right' | 'scale';
};

/** CSS-transition replacement for simple framer-motion fades (see .reveal in App.css). */
export function Reveal({ as = 'div', className = '', id, children, delay = 0, inView = false, variant = 'up' }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inView || typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => el.classList.add('is-visible'));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return createElement(
    as,
    {
      ref,
      id,
      className: `reveal reveal-${variant} ${className}`.trim(),
      style: { '--reveal-delay': `${delay}s` } as CSSProperties,
    },
    children,
  );
}
