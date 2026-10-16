'use client';
import { useState, useMemo } from 'react';
import type { Data } from '@/lib/analysis';
import { recordMaterials } from '@/lib/record-materials';
export function SubjectMaterialPicker({ data, date, subject, material, onChange, disabled = false, searchable = false, labelPrefix = '' }: {
    data: Data;
    date: string;
    subject: string;
    material: string;
    onChange: (subject: string, material: string) => void;
    disabled?: boolean;
    searchable?: boolean; labelPrefix?: string;
}) {
    const [query, setQuery] = useState('');
    const rows = useMemo(() => recordMaterials(data, date).filter(m => (!subject || m.subject_id === subject) && (!query || m.id === material || m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))), [data, date, subject, material, query]);
    return <div className="subject-material-picker">{searchable && <label className="field picker-search"><span>教材を検索</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="教材名で絞り込み" disabled={disabled}/></label>}<div className="manual-two"><label className="field"><span>科目</span><select aria-label={labelPrefix+'科目'} disabled={disabled} value={subject} onChange={e => { const s = e.target.value; onChange(s, data.materials.some(m => m.id === material && (!s || m.subject_id === s)) ? material : ''); }}><option value="">科目を選択</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>教材</span><select aria-label={labelPrefix+'教材'} disabled={disabled} value={material} onChange={e => { const m = data.materials.find(m => m.id === e.target.value); onChange(m?.subject_id && data.subjects.some(s => s.id === m.subject_id) ? m.subject_id : subject, e.target.value); }}><option value="">教材なし</option>{rows.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>{subject && !rows.length && <p className="muted">この科目の教材がありません。教材なしでも記録できます。</p>}</div>;
}
export type RecordMethod = 'manual' | 'stopwatch' | 'pomodoro';
export type RecordIntent = {
    id: number;
    method: RecordMethod;
    autoStart: boolean;
};
