'use client';
import { type ReactNode } from 'react';
import { House, BookOpen, ChartNoAxesCombined, List, Grid2X2, Plus, SlidersHorizontal } from 'lucide-react';
import brandIcon from '@/public/favicon-32.png?inline';
import { ColorModeToggle } from '@/components/color-mode-toggle';
import { type SyncStatus } from '@/components/device-sync';
import { navigationGroup, pageNames } from '@/lib/navigation';
const items = [['dashboard', 'ホーム', House], ['study', '学習', BookOpen], ['time', '分析', ChartNoAxesCombined], ['records', '記録', List], ['manage', '学習管理', Grid2X2]] as const;
export function AppShell({ page, go, children, onRecord, onUtilities, blocked, syncStatus, browserStorage, timerSlot, mobileTimerSlot }: {
    page: string;
    go: (page: string) => void;
    children: ReactNode;
    onRecord: () => void;
    onUtilities: () => void;
    blocked: boolean;
    syncStatus: SyncStatus;
    browserStorage: boolean;
    timerSlot: (node: HTMLDivElement | null) => void;
    mobileTimerSlot: (node: HTMLDivElement | null) => void;
}) {
    const group = navigationGroup(page), labels = { disconnected: '同期未設定', waiting: '同期待ち', syncing: '同期中', synced: '同期済み', offline: 'オフライン・同期待ち', conflict: '同期の競合・要確認', error: '同期エラー・要確認' };
    const navigation = (mobile = false) => items.map(([id, label, Icon]) => <button key={id} onClick={() => go(id)} className={group === id ? 'active' : ''} aria-current={group === id ? 'page' : undefined} aria-label={label}><Icon size={20}/><span>{mobile && id === 'manage' ? '管理' : label}</span></button>);
    return <div className="studyplus-shell"><aside className="workspace-sidebar"><a className="workspace-brand" href="#dashboard"><img src={brandIcon} alt=""/>studyplus</a><nav aria-label="メインナビゲーション">{navigation()}</nav><div className="workspace-sidebar-bottom"><div className="sidebar-timer-slot" ref={timerSlot}/><span>自分の学習スペース</span></div></aside><main className="main"><header className="topbar"><div className="page-heading"><h1>{pageNames[page]}</h1><ColorModeToggle /></div><div className="top-actions"><div className="mobile-only mobile-timer-slot" ref={mobileTimerSlot}/><button className="record-add" aria-label="記録を追加" onClick={onRecord} disabled={blocked}><Plus size={18}/><span>記録を追加</span></button><button className="utility-trigger" onClick={onUtilities} aria-label="データ・設定メニュー" aria-haspopup="dialog" title={labels[syncStatus.phase]}><SlidersHorizontal size={20}/>{browserStorage && <span className="sync-dot" data-phase={syncStatus.phase} role="status" aria-label={labels[syncStatus.phase]}/>}</button></div></header>{children}<footer>Studyplus 学習分析<span>記録にない情報は推測しません。</span></footer></main><nav className="mobile-nav" aria-label="メインナビゲーション">{navigation(true)}</nav></div>;
}
