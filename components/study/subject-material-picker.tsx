'use client';
import { useState, useMemo } from 'react';
import type { Data } from '@/lib/analysis';
import { recordMaterials } from '@/lib/record-materials';
import { Search } from 'lucide-react';
import { Autocomplete } from '../interaction/autocomplete';
export function SubjectMaterialPicker({ data, date, subject, material, onChange, disabled = false, searchable = false, labelPrefix = '' }: {
    data: Data;
    date: string;
    subject: string;
    material: string;
    onChange: (subject: string, material: string) => void;
    disabled?: boolean;
    searchable?: boolean; labelPrefix?: string;
}) {
    const [searchOpen, setSearchOpen] = useState(searchable);
    const rows = useMemo(() => recordMaterials(data, date).filter(m => !subject || m.subject_id === subject), [data, date, subject]);
    const options = useMemo(() => {
        const counts = new Map<string, { count: number; last: string }>();
        for (const record of data.study_records) {
            if (!record.material_id || !record.date || record.date > date) continue;
            const previous = counts.get(record.material_id);
            counts.set(record.material_id, { count: (previous?.count || 0) + 1, last: !previous || record.date > previous.last ? record.date : previous.last });
        }
        return rows.map(row => {
            const usage = counts.get(row.id), name = data.subjects.find(s => s.id === row.subject_id)?.name;
            return { id: row.id, label: row.name, detail: [name, usage ? `${usage.count}回記録 · 最終 ${usage.last}` : '記録なし'].filter(Boolean).join(' · ') };
        });
    }, [rows, data, date]);
    function chooseMaterial(value: string) {
        const selected = data.materials.find(m => m.id === value);
        onChange(selected?.subject_id && data.subjects.some(s => s.id === selected.subject_id) ? selected.subject_id : subject, value);
    }
    return <div className="subject-material-picker"><div className="manual-two"><label className="field"><span>科目</span><select aria-label={labelPrefix+'科目'} disabled={disabled} value={subject} onChange={e => { const s = e.target.value; onChange(s, data.materials.some(m => m.id === material && (!s || m.subject_id === s)) ? material : ''); }}><option value="">科目を選択</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>教材</span><select aria-label={labelPrefix+'教材'} disabled={disabled} value={material} onChange={e => chooseMaterial(e.target.value)}><option value="">教材なし</option>{rows.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>{subject && !rows.length && <p className="muted">この科目の教材がありません。教材なしでも記録できます。</p>}
        <button type="button" className="material-search-toggle" disabled={disabled} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={14} aria-hidden="true"/>{searchOpen ? '教材検索を閉じる' : '教材を検索'}</button>
        {searchOpen && <Autocomplete label={labelPrefix+'教材名で検索'} options={options} selectedId={material} disabled={disabled} onSelect={chooseMaterial}/>}
    </div>;
}
export type RecordMethod = 'manual' | 'stopwatch' | 'pomodoro';
export type RecordIntent = {
    id: number;
    method: RecordMethod;
    autoStart: boolean;
};
