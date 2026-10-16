'use client';
import { useState } from 'react';
import { Play, ChevronRight } from 'lucide-react';
import type { StudyTimer } from '@/lib/study-timer';
import type { RecordMethod } from './subject-material-picker';
export function StartAction({ material, subject, onRecord, blocked, timer, readOnly = false }: {
    material: string;
    subject: string;
    onRecord: (material?: string, subject?: string, method?: RecordMethod, autoStart?: boolean) => void;
    blocked: boolean;
    timer: StudyTimer | null;
    readOnly?: boolean;
}) {
    const [method, setMethod] = useState<RecordMethod>(() => { try {
        const value = localStorage.getItem('studyplus.recordMethod');
        if (value === 'pomodoro' || value === 'manual')
            return value;
    }
    catch { } return 'stopwatch'; });
    const title = timer ? readOnly ? '共有計測を確認' : timer.status === 'review' ? '結果を確認して保存' : timer.status === 'paused' ? '計測画面で再開' : '計測を開く' : method === 'manual' ? '記録を入力' : '学習を始める';
    return <div className="start-action">{!timer && <label className="field method-choice"><span>記録方法</span><select aria-label="開始する記録方法" value={method} disabled={blocked} onChange={e => { const next = e.target.value as RecordMethod; setMethod(next); try {
        localStorage.setItem('studyplus.recordMethod', next);
    }
    catch { } }}><option value="stopwatch">ストップウォッチ</option><option value="pomodoro">ポモドーロ</option><option value="manual">手入力</option></select></label>}<div className="start-action-buttons"><button className="primary today-start" disabled={blocked} onClick={() => onRecord(timer?.materialId ?? material, timer?.subjectId ?? subject, timer?.mode ?? method, !timer && method !== 'manual' && !!subject)}>{timer ? <ChevronRight size={18}/> : <Play size={18}/>}<span>{title}</span></button>{!timer && <button className="start-manual" disabled={blocked} onClick={() => onRecord(material, subject, 'manual')}>手入力</button>}</div></div>;
}
