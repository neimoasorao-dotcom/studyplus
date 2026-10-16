'use client';
import { useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import * as A from '@/lib/analysis';
import { MaterialsView } from './entity-views';
import { sortMaterialRows } from '@/lib/material-sort';
import { useMaterialSort, MaterialSortPick } from '@/components/data/presentation';
import { StartAction } from './start-action';
import type { StudyTimer } from '@/lib/study-timer';
import type { RecordMethod } from './subject-material-picker';
export function StudyWorkspace({ data, date, week, format, onRecord, blocked, onSort, params, go, timer, onSettings }: {
    data: A.Data;
    date: string;
    week: ReturnType<typeof A.week>;
    format: (n: number | null) => string;
    onRecord: (material?: string, subject?: string, method?: RecordMethod, autoStart?: boolean) => void;
    blocked: boolean;
    onSort?: (value: any) => void;
    params: URLSearchParams;
    go: (p: string, restore?: boolean) => void;
    timer: StudyTimer | null;
    onSettings: () => void;
}) {
    const [query, setQuery] = useState(''), [order, setOrder] = useMaterialSort(data, onSort);
    const subject = params.get('subject') || '', selected = params.get('material') || '';
    const rows = useMemo(() => sortMaterialRows(data.materials.filter(m => (!subject || m.subject_id === subject) && m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(m => { const rs = data.study_records.filter(r => A.validRecord(r) && r.material_id === m.id && r.date <= date); return { m, name: m.name, minutes: A.total(rs), last: rs.map(r => r.date).sort().at(-1) }; }), order), [data, date, subject, query, order]);
    const active = data.materials.find(m => m.id === selected) || (!selected ? rows[0]?.m : null);
    const target = (s: string, m = '') => 'study?' + new URLSearchParams({ ...s ? { subject: s } : {}, ...m ? { material: m } : {} }).toString();
    return <div className={'study-workspace ' + (selected ? 'has-selection' : '')}><div className="subject-filter" role="group" aria-label="教材の科目"><button aria-pressed={!subject} onClick={() => go(target(''))}>すべて</button>{data.subjects.map(s => <button key={s.id} aria-pressed={subject === s.id} onClick={() => go(target(s.id))}><i style={{ background: s.color || 'var(--primary)' }}/>{s.name}</button>)}</div><div className="material-workspace-grid"><section className="material-browser"><div className="material-browser-tools"><label className="field"><span><Search size={14}/>教材を検索</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="教材名"/></label><MaterialSortPick value={order} onChange={setOrder}/></div><p className="muted">{rows.length}教材</p><div className="material-browser-list">{rows.map(({ m, minutes, last }) => <button key={m.id} aria-pressed={active?.id === m.id} onClick={() => go(target(subject, m.id))}><span><strong>{m.name}</strong><small>{data.subjects.find(s => s.id === m.subject_id)?.name || '科目未設定'} · {last || '未使用'}</small></span><b>{format(minutes)}</b></button>)}</div>{!rows.length && <p className="empty-small">該当する教材がありません。</p>}<button className="quiet" onClick={onSettings}>科目・教材を設定</button></section><section className="material-inspector"><button className="material-back mobile-only" onClick={() => go(target(subject), true)}><ChevronLeft size={18}/>教材一覧</button>{active ? <><MaterialsView key={active.id} d={data} date={date} w={week} f={format} activeId={active.id} embedded onRecord={(id: string) => onRecord(id, active.subject_id)} recordDisabled={blocked} onRecords={(id: string) => go('records?' + new URLSearchParams({ material: id }))}/><StartAction material={active.id} subject={active.subject_id || ''} timer={timer} onRecord={onRecord} blocked={blocked}/></> : <p className="empty-small">教材を選択してください。</p>}</section></div></div>;
}
