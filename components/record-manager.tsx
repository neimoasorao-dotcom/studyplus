'use client';
import { useState } from 'react';
import { ManualRecordForm } from './manual-record-form';
import { type Data } from '@/lib/analysis';
import { type RecordInput } from '@/lib/manual-record';
export function RecordManager({ data, date, saving, blocked, onSave, initialQuery = '', materialId, subjectId, recordDate }: {
    materialId?: string;
    subjectId?: string;
    recordDate?: string;
    initialQuery?: string;
    data: Data;
    date: string;
    saving: boolean;
    blocked: boolean;
    onSave: (data: Data, reason: string) => Promise<boolean>;
}) {
    const [query, setQuery] = useState(initialQuery), [page, setPage] = useState(0), [selected, setSelected] = useState<{
        index: number;
        record: any;
        mode: 'edit' | 'delete';
    } | null>(null), [error, setError] = useState('');
    const rows = data.study_records.map((r, index) => ({ r, index })).filter(({ r }) => (!materialId || r.material_id === materialId) && (!subjectId || r.subject_id === subjectId) && (!recordDate || r.date === recordDate)).filter(({ r }) => [r.date, data.subjects.find(s => s.id === r.subject_id)?.name, data.materials.find(m => m.id === r.material_id)?.name, r.content, r.comment].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => String(b.r.date + (b.r.start_time || '')).localeCompare(String(a.r.date + (a.r.start_time || ''))));
    async function commit(record: any | null) { if (!selected || blocked)
        return false; if (JSON.stringify(data.study_records[selected.index]) !== JSON.stringify(selected.record)) {
        setError('記録が更新されています。一覧に戻って選び直してください。');
        return false;
    } const study_records = [...data.study_records]; if (record === null)
        study_records.splice(selected.index, 1);
    else {
        const { date, material_id, subject_id, duration_minutes, start_time, end_time, content, comment } = record;
        study_records[selected.index] = { ...selected.record, date, material_id, subject_id, duration_minutes, start_time, end_time, content, comment };
    } const ok = await onSave({ ...data, study_records }, record === null ? '学習記録を削除' : '学習記録を編集'); if (ok) {
        setSelected(null);
        setError('');
    }
    else
        setError('保存できませんでした。入力内容は保持しています。'); return ok; }
    if (selected) {
        const r = selected.record, minutes = Number(r.duration_minutes) || 0;
        const input: RecordInput = { date: r.date || date, material_id: r.material_id || '', subject_id: r.subject_id || '', hours: String(Math.floor(minutes / 60)), minutes: String(minutes % 60), content: r.content || '', comment: r.comment || '', start_time: r.start_time || '', end_time: r.end_time || '' };
        return <section><button disabled={saving} onClick={() => { setSelected(null); setError(''); }}>一覧に戻る</button><h3>{selected.mode === 'edit' ? '学習記録を編集' : '学習記録を削除'}</h3>{selected.mode === 'edit' ? <ManualRecordForm data={data} date={date} initialInput={input} recordId={r.id || 'editing-record'} singleSave saving={saving || blocked} onSave={commit} onClose={() => setSelected(null)} onSettings={() => { }}/> : <><p>{r.date} · {data.subjects.find(s => s.id === r.subject_id)?.name || '科目未設定'} · {data.materials.find(m => m.id === r.material_id)?.name || '教材なし'} · {minutes}分</p><p>この記録を削除しますか？同期を設定している場合は他の端末にも反映されます。</p><button className="danger-outline" disabled={blocked} onClick={() => { void commit(null); }}>この記録を削除する</button></>}{error && <p className="notice error" role="alert">{error}</p>}</section>;
    }
    const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 30) - 1));
    return <><label className="field"><span>日付・科目・教材・内容で検索</span><input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/></label><p>{rows.length}件</p><div className="record-manager-list">{rows.slice(current * 30, current * 30 + 30).map(({ r, index }) => <article key={index}><div><strong>{r.date} {r.start_time || ''}</strong><span>{data.subjects.find(s => s.id === r.subject_id)?.name || '科目未設定'} · {data.materials.find(m => m.id === r.material_id)?.name || '教材なし'}</span><span>{r.duration_minutes}分</span>{(r.content || r.comment) && <small>{[r.content, r.comment].filter(Boolean).join(' / ')}</small>}</div><div className="actions"><button disabled={blocked} onClick={() => setSelected({ index, record: r, mode: 'edit' })}>編集</button><button disabled={blocked} onClick={() => setSelected({ index, record: r, mode: 'delete' })}>削除</button></div></article>)}</div>{!rows.length && <p className="muted">該当する記録はありません。</p>}<div className="actions"><button disabled={current === 0} onClick={() => setPage(current - 1)}>前へ</button><span>{current + 1} / {Math.max(1, Math.ceil(rows.length / 30))}</span><button disabled={(current + 1) * 30 >= rows.length} onClick={() => setPage(current + 1)}>次へ</button></div></>;
}
