'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, Check, RefreshCw, TriangleAlert } from 'lucide-react';
export type RefreshResult = { kind: 'success' | 'info' | 'warning' | 'error'; message: string };
type State = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'complete' | 'error';
const threshold = 72;

export function PullToRefresh({ enabled, onRefresh }: { enabled: boolean; onRefresh: () => Promise<RefreshResult> }) {
    const [state, setState] = useState<State>('idle'), [distance, setDistance] = useState(0), [message, setMessage] = useState('');
    const settings = useRef({ enabled, onRefresh }), active = useRef(false);
    settings.current = { enabled, onRefresh };
    useEffect(() => {
        document.documentElement.classList.add('studyplus-pull');
        let start: {x:number;y:number} | null = null, pulling = false, amount = 0, frame = 0, timeout: ReturnType<typeof setTimeout>;
        const reset = () => { start=null; pulling=false; amount=0; cancelAnimationFrame(frame); setDistance(0); if (!active.current) setState('idle'); };
        const allowed = (target: EventTarget | null) => {
            if (!(target instanceof Element) || !target.closest('.main') || target.closest('button,a,input,select,textarea,summary,[role=dialog],[role=combobox],.chart,.record-swipe')) return false;
            for (let el = target; el && el !== document.body; el = el.parentElement!) {
                const style = getComputedStyle(el);
                if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return false;
            }
            return true;
        };
        const begin = (event: TouchEvent) => {
            if (!settings.current.enabled || active.current || !matchMedia('(max-width:767px)').matches || event.touches.length !== 1 || scrollY > 1 || document.querySelector('[role=dialog][data-state=open]') || !allowed(event.target)) return;
            clearTimeout(timeout); start={x:event.touches[0].clientX,y:event.touches[0].clientY}; pulling=false; amount=0;
        };
        const move = (event: TouchEvent) => {
            if (!start) return;
            if (!settings.current.enabled || event.touches.length !== 1 || scrollY > 1) { reset(); return; }
            const dy=event.touches[0].clientY-start.y, dx=Math.abs(event.touches[0].clientX-start.x);
            if (!pulling && (dy < -8 || dx > Math.max(12, Math.abs(dy)))) { reset(); return; }
            if (dy <= 8) return;
            pulling=true;
            if (event.cancelable) event.preventDefault();
            amount=Math.min(100, (dy-8)*.58);
            cancelAnimationFrame(frame); frame=requestAnimationFrame(() => {setDistance(amount);setState(amount>=threshold?'ready':'pulling');});
        };
        const end = () => {
            if (!start) return;
            start=null; cancelAnimationFrame(frame);
            if (!pulling || amount < threshold || !settings.current.enabled) {reset();return;}
            pulling=false;active.current=true;setDistance(threshold);setState('refreshing');
            settings.current.onRefresh().then(result => {setMessage(result.message);setState(result.kind==='error'||result.kind==='warning'?'error':'complete');}, () => {setMessage('更新できませんでした。データ・設定から再試行できます。');setState('error');}).finally(() => {
                active.current=false;timeout=setTimeout(() => {setState('idle');setDistance(0);},1100);
            });
        };
        document.addEventListener('touchstart',begin,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',reset,{passive:true});
        return () => { document.documentElement.classList.remove('studyplus-pull');document.removeEventListener('touchstart',begin);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',reset);cancelAnimationFrame(frame);clearTimeout(timeout); };
    }, []);
    const text=state==='ready'?'離して更新':state==='refreshing'?'更新中…':state==='complete'||state==='error'?message:'下に引いて更新';
    return <div className="pull-refresh" data-state={state} style={{'--pull-distance':distance+'px'} as CSSProperties} hidden={state==='idle'}><span className="pull-refresh-icon" aria-hidden="true">{state==='complete'?<Check size={18}/>:state==='error'?<TriangleAlert size={18}/>:state==='refreshing'?<RefreshCw size={18}/>:<ArrowDown size={18}/>}</span><span role="status" aria-live="polite">{text}</span></div>;
}
