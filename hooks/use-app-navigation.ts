'use client';
import { useEffect, useRef, useState } from 'react';
import { parseLocation } from '@/lib/navigation';
export function useAppNavigation() {
    const [location, setLocation] = useState(() => parseLocation(typeof window === 'undefined' ? '' : window.location.hash));
    const positions = useRef(new Map<string, number>()), previous = useRef(''), pending = useRef<string | null>(null);
    useEffect(() => { previous.current = window.location.hash; const read = () => { const hash = window.location.hash; positions.current.set(previous.current, window.scrollY); previous.current = hash; setLocation(parseLocation(hash)); const fresh = pending.current === hash; pending.current = null; requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: fresh ? 0 : positions.current.get(hash) || 0, behavior: 'instant' }))); }; window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read); }, []);
    function go(target: string, restore = false) { const hash = '#' + target; if (window.location.hash === hash)
        return; pending.current = restore ? null : hash; window.location.hash = target; }
    return { ...location, go };
}
