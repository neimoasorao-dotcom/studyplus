'use client';
import {useState,useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {type Data} from '@/lib/analysis';
import {initialRecord,buildManualRecord,manualDuplicateCount,nextRecord,type RecordInput} from '@/lib/manual-record';

type Props={data:Data;date:string;materialId?:string;saving:boolean;onSave:(record:ReturnType<typeof buildManualRecord>)=>Promise<boolean>;onClose:()=>void;onSettings:()=>void};
export function ManualRecordForm({data,date,materialId='',saving,onSave,onClose,onSettings}:Props){
 const [input,setInput]=useState(()=>initialRecord(date,data,materialId)),[details,setDetails]=useState(false),[error,setError]=useState(''),[duplicates,setDuplicates]=useState(0),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
 const busy=useRef(false),minutesField=useRef<HTMLInputElement>(null);
 const update=(key:keyof RecordInput,value:string)=>{setInput(old=>({...old,[key]:value}));setError('');setDuplicates(0);setConfirmed(false);setNotice('');};
 function chooseMaterial(value:string){const material=data.materials.find(m=>m.id===value);const subject=data.subjects.some(s=>s.id===material?.subject_id)?material.subject_id:'';setInput(old=>({...old,material_id:value,subject_id:value?subject:old.subject_id}));setError('');setDuplicates(0);setConfirmed(false);setNotice('');}
 async function submit(keepOpen:boolean){if(saving||busy.current)return;setError('');setNotice('');let record;try{record=buildManualRecord(input,data,date,crypto.randomUUID());const count=manualDuplicateCount(data,record);if(count&&!confirmed){setDuplicates(count);return;}}catch(e:any){setError(e.message);return;}
  busy.current=true;try{if(await onSave(record)){if(keepOpen){setInput(nextRecord(input));setDuplicates(0);setConfirmed(false);setNotice('記録を追加しました');minutesField.current?.focus();}else onClose();}else setError('保存できませんでした。入力内容は残っています。画面のエラーを確認してください。');}finally{busy.current=false;}
 }
 const material=data.materials.find(m=>m.id===input.material_id),autoSubject=material&&material.subject_id===input.subject_id&&data.subjects.some(s=>s.id===input.subject_id);
 return <form className="manual-form" onSubmit={e=>{e.preventDefault();submit(false);}} noValidate>
 {!data.subjects.length&&<div className="notice"><p>先に設定で科目を追加してください。</p><button type="button" onClick={onSettings}>科目を設定する</button></div>}
 <fieldset disabled={saving}>
 <label className="field"><span>日付</span><input type="date" value={input.date} max={date} onChange={e=>update('date',e.target.value)} required/></label>
 <div className="manual-two"><label className="field"><span>教材</span><select aria-label="教材" value={input.material_id} onChange={e=>chooseMaterial(e.target.value)}><option value="">教材なし</option>{data.materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="field"><span>科目</span><select aria-label="科目" value={input.subject_id} onChange={e=>update('subject_id',e.target.value)} required><option value="">選択してください</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
 {autoSubject&&<p className="manual-auto">教材に設定された科目を選択しました</p>}
 <div className="field"><span>学習時間</span><div className="manual-duration"><input aria-label="学習時間の時間" type="number" inputMode="numeric" min={0} max={24} step={1} value={input.hours} onChange={e=>update('hours',e.target.value)} required/><span>時間</span><input ref={minutesField} aria-label="学習時間の分" type="number" inputMode="numeric" min={0} max={59} step={1} value={input.minutes} onChange={e=>update('minutes',e.target.value)} required/><span>分</span></div></div>
 <label className="field"><span>学習内容（任意）</span><input value={input.content} placeholder="例：No. 101〜150を復習" onChange={e=>update('content',e.target.value)}/></label>
 <button type="button" className="manual-details-toggle" aria-expanded={details} aria-controls="manual-record-details" onClick={()=>setDetails(!details)}><ChevronDown size={16}/>時刻・メモを入力</button>
 {details&&<div id="manual-record-details" className="manual-extra"><div className="manual-two"><label className="field"><span>開始時刻（任意）</span><input type="time" value={input.start_time} onChange={e=>update('start_time',e.target.value)}/></label><label className="field"><span>終了時刻（任意）</span><input type="time" value={input.end_time} onChange={e=>update('end_time',e.target.value)}/></label></div><label className="field"><span>メモ（任意）</span><textarea value={input.comment} onChange={e=>update('comment',e.target.value)}/></label></div>}
 {duplicates>0&&<div className="manual-duplicate" role="status"><p>同じ日付・教材・科目・学習時間の記録が{duplicates}件あります。</p><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>別の記録として追加する</label></div>}
 {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="manual-success" aria-live="polite">{notice}</p>}
 <div className="manual-buttons"><button type="submit" disabled={saving||!data.subjects.length}>{saving?'保存中…':'保存'}</button><button type="button" className="primary" disabled={saving||!data.subjects.length} onClick={()=>submit(true)}>{saving?'保存中…':'保存して続ける'}</button><button type="button" className="mobile-only manual-close" disabled={saving} onClick={onClose}>閉じる（保存しない）</button></div>
 </fieldset></form>;
}
