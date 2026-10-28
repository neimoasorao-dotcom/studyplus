'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';

const REVEAL = 152;
/** Gestures only reveal actions; deletion always uses the normal confirmation. */
export function SwipeActions({ children, disabled, onEdit, onDelete }: {
    children: ReactNode; disabled?: boolean; onEdit: () => void; onDelete: () => void;
}) {
    const [offset, setOffset] = useState(0), [dragging, setDragging] = useState(false);
    const gesture = useRef<{ x: number; y: number; initial: number; axis: 'pending' | 'horizontal' | 'vertical' } | null>(null);
    const offsetRef = useRef(0);
    function move(value: number) { offsetRef.current = value; setOffset(value); }
    function close() { gesture.current = null; setDragging(false); move(0); }
    return <div className="record-swipe" data-revealed={offset < -REVEAL / 2 || undefined}>
        <div className="swipe-reveal" aria-hidden={offset === 0}>
            <button type="button" disabled={disabled} tabIndex={offset < -REVEAL / 2 ? 0 : -1} onClick={() => { close(); onEdit(); }}><Pencil size={17} aria-hidden="true"/>編集</button>
            <button type="button" className="swipe-delete" disabled={disabled} tabIndex={offset < -REVEAL / 2 ? 0 : -1} onClick={() => { close(); onDelete(); }}><Trash2 size={17} aria-hidden="true"/>削除</button>
            <button type="button" className="swipe-close" tabIndex={offset < -REVEAL / 2 ? 0 : -1} onClick={close} aria-label="記録のスワイプ操作を閉じる"><X size={16} aria-hidden="true"/></button>
        </div>
        <div className="swipe-front" data-dragging={dragging || undefined} style={{ '--swipe-offset': `${offset}px` } as CSSProperties}
            onKeyDown={event => { if (event.key === 'Escape') close(); }}
            onPointerDown={event => {
                if (disabled || event.pointerType === 'mouse' || !window.matchMedia('(max-width: 767px)').matches || (event.target as Element).closest('button,input,select,textarea,a')) return;
                gesture.current = { x: event.clientX, y: event.clientY, initial: offsetRef.current, axis: 'pending' };
            }}
            onPointerMove={event => {
                const start = gesture.current;
                if (!start) return;
                const dx = event.clientX - start.x, dy = event.clientY - start.y;
                if (start.axis === 'pending') {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
                    start.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
                    if (start.axis === 'horizontal') {
                        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pointer may have ended before capture. */ }
                        setDragging(true);
                    }
                }
                if (start.axis === 'horizontal') { event.preventDefault(); move(Math.max(-REVEAL, Math.min(0, start.initial + dx))); }
            }}
            onPointerUp={() => { if (!gesture.current) return; const horizontal = gesture.current.axis === 'horizontal'; gesture.current = null; setDragging(false); if (horizontal) move(offsetRef.current < -52 ? -REVEAL : 0); }}
            onPointerCancel={() => { gesture.current = null; setDragging(false); move(offsetRef.current < -REVEAL / 2 ? -REVEAL : 0); }}>
            {children}
        </div>
    </div>;
}
