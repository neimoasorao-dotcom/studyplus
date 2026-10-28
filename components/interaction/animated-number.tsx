'use client';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

const query = '(prefers-reduced-motion: reduce)';
let media: MediaQueryList | undefined;
const listeners = new Set<() => void>();
const currentMedia = () => media ??= window.matchMedia(query);
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  const source = currentMedia();
  if (!listeners.size) source.addEventListener('change', notify);
  listeners.add(listener);
  return () => { listeners.delete(listener); if (!listeners.size) source.removeEventListener('change', notify); };
};
/** Shared by charts and interaction components; the server always renders the final value. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => currentMedia().matches, () => true);
}

/** The accessible label is always the real value, independent of the visual tween. */
export function AnimatedNumber({ value, format = String, label }: {
  value: number; format?: (value: number) => string; label?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null), previous = useRef<number | null>(null);
  const formatter = useRef(format);
  formatter.current = format;
  const text = label ?? format(value);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0, observer: IntersectionObserver | undefined, cancelled = false;
    const from = previous.current ?? 0;
    previous.current = value;
    // An OS preference change immediately restores the actual number.
    if (reduced || !Number.isFinite(value) || from === value) {
      node.dataset.value = text;
      return;
    }
    function start() {
      if (cancelled) return;
      const started = performance.now();
      const draw = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - started) / 420);
        node!.dataset.value = progress === 1 ? text : formatter.current(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); start(); }
      }, { threshold: .1 });
      observer.observe(node);
    } else start();
    return () => { cancelled = true; cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [value, reduced, text]);
  return <span className="animated-number" data-final={text}><span className="animated-number-visual" ref={ref} data-value={text} aria-hidden="true"/><span className="sr-only">{text}</span></span>;
}

/** Only complete numeric/time values are animated. Mixed labels and missing data stay literal. */
export function AnimatedMetric({ value }: { value: ReactNode }) {
  if (typeof value === 'number' && Number.isFinite(value)) return <AnimatedNumber value={value}/>;
  if (typeof value !== 'string') return <>{value}</>;
  const time = value.match(/^([−-]?)(\d+)h\s+(\d{1,2})m$/);
  if (time) {
    const sign = time[1] ? -1 : 1;
    return <AnimatedNumber value={sign * (Number(time[2]) * 60 + Number(time[3]))} label={value} format={n => {
      const minutes = Math.round(Math.abs(n));
      return `${n < 0 ? time[1] || '−' : ''}${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
    }}/>;
  }
  const number = value.match(/^([+−-]?)(\d+(?:\.\d+)?)(%|pt|分|日|件|回)?$/);
  if (!number) return <>{value}</>;
  const decimals = number[2].split('.')[1]?.length ?? 0, sign = number[1] === '−' || number[1] === '-' ? -1 : 1;
  return <AnimatedNumber value={sign * Number(number[2])} label={value} format={n => `${number[1] === '+' ? '+' : n < 0 ? number[1] || '−' : ''}${Math.abs(n).toFixed(decimals)}${number[3] ?? ''}`}/>;
}
