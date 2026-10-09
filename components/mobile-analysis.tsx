'use client';

import {Children, Fragment, isValidElement, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type ReactElement} from 'react';
import {useIsMobile} from '@/hooks/use-mobile';

type Section = {id: string; label: string};
const defaultSections: Section[] = [
  {id: 'overview', label: '概要'},
  {id: 'analysis', label: '分析'},
  {id: 'details', label: '記録・詳細'},
];

// Keep the desktop tree intact. Only phones regroup existing panels; calculations,
// save handlers and the contents of each panel stay in their owning page.
export function MobileAnalysis({children, sections = defaultSections, enabled = true}: {children: ReactNode; sections?: Section[]; enabled?: boolean}) {
  const mobile = useIsMobile();
  const [selected, setSelected] = useState(sections[0].id);
  const [visited, setVisited] = useState<string[]>([sections[0].id]);
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!mobile || !enabled) return <>{children}</>;

  const groups = new Map<string, ReactNode[]>();
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, node => {
      if (node == null || typeof node === 'boolean') return;
      if (isValidElement(node)) {
        const element = node as ReactElement<{children?: ReactNode; className?: string; mobileSection?: string; 'data-mobile-section'?: string}>;
        if (element.type === Fragment || (element.type === 'div' && element.props.className?.split(' ').includes('grid'))) {
          collect(element.props.children);
          return;
        }
        const group = element.props.mobileSection || element.props['data-mobile-section'] || 'overview';
        groups.set(group, [...(groups.get(group) || []), <Fragment key={groups.get(group)?.length || 0}>{node}</Fragment>]);
      } else groups.set('overview', [...(groups.get('overview') || []), node]);
    });
  }
  collect(children);
  const available = sections.filter(section => groups.has(section.id));
  const active = available.some(section => section.id === selected) ? selected : available[0]?.id;
  function choose(next: string) {
    setSelected(next);
    setVisited(old => old.includes(next) ? old : [...old, next]);
    anchor.current?.scrollIntoView({block: 'start', behavior: 'instant'});
  }
  return <>
    {groups.get('always')}
    <div ref={anchor} className="mobile-analysis">
      {available.length > 1 && <div role="tablist" aria-label="ページ内の表示" className="analysis-tabs">
        {available.map((section, index) => <button key={section.id} ref={element => {tabs.current[index] = element;}}
          type="button" role="tab" id={`${id}-${section.id}-tab`} aria-controls={`${id}-${section.id}-panel`}
          aria-selected={active === section.id} tabIndex={active === section.id ? 0 : -1}
          onClick={() => choose(section.id)} onKeyDown={event => {
            const target = event.key === 'ArrowRight' ? (index + 1) % available.length
              : event.key === 'ArrowLeft' ? (index - 1 + available.length) % available.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : null;
            if (target !== null) {event.preventDefault(); choose(available[target].id); tabs.current[target]?.focus();}
          }}>{section.label}</button>)}
      </div>}
      {available.map(section => (visited.includes(section.id) || section.id === active) && <div key={section.id}
        id={`${id}-${section.id}-panel`} role="tabpanel" aria-labelledby={`${id}-${section.id}-tab`}
        hidden={active !== section.id} tabIndex={0} className="analysis-content">
        {groups.get(section.id)}
      </div>)}
    </div>
  </>;
}

export function scrollMobilePageTop() {
  if (window.matchMedia('(max-width: 767px)').matches) window.scrollTo({top: 0, behavior: 'instant'});
}

// Safari may pan rather than resize the layout viewport when the keyboard opens.
function subscribeViewport(notify: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', notify);
  viewport?.addEventListener('scroll', notify);
  return () => {viewport?.removeEventListener('resize', notify); viewport?.removeEventListener('scroll', notify);};
}
function viewportSnapshot() {
  const viewport = window.visualViewport;
  return viewport ? `${viewport.height},${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}` : '';
}
export function useInputViewport(open: boolean): CSSProperties | undefined {
  const mobile = useIsMobile();
  const snapshot = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => '');
  if (!open || !mobile || !snapshot) return undefined;
  const [height, bottom] = snapshot.split(',');
  return {'--input-viewport-height': `${height}px`, '--input-viewport-bottom': `${bottom}px`} as CSSProperties;
}
