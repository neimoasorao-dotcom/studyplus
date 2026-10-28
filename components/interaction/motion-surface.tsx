'use client';
import { useEffect, useRef, type ReactNode } from 'react';

// One observer per visible page, never a listener per card. Content stays readable
// before JS runs; reveal only adds a short emphasis as a section enters view.
export function MotionSurface({ children, view }: { children: ReactNode; view: string }) {
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = root.current;
        if (!node || !('IntersectionObserver' in window)) return;
        const preference = matchMedia('(prefers-reduced-motion: reduce)');
        const seen = new WeakSet<Element>();
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) if (entry.isIntersecting) {
                if (!preference.matches) entry.target.classList.add('motion-revealed');
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.08 });
        const watch = () => node.querySelectorAll('.panel, .management-link, .records-workspace, .material-browser').forEach(element => {
            if (!seen.has(element)) { seen.add(element); observer.observe(element); }
        });
        watch();
        let frame = 0;
        const mutation = new MutationObserver(records => {
            if (records.some(record => [...record.addedNodes].some(child => child instanceof Element))) {
                cancelAnimationFrame(frame); frame = requestAnimationFrame(watch);
            }
        });
        mutation.observe(node, { childList: true, subtree: true });
        return () => { observer.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); };
    }, [view]);
    return <div ref={root} className="motion-surface" data-view={view}>{children}</div>;
}
