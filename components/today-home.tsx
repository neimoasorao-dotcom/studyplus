'use client';
import {useEffect,useState,useMemo,type ReactNode} from 'react';
import {ChevronRight,Target,BookOpen,Play,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {todayHome} from '../lib/today-home';
import type {Data} from '../lib/analysis';
import {timerElapsed,clockText,type StudyTimer} from '../lib/study-timer';

type Props={timerReadOnly?:boolean;data:Data;date:string;timer:StudyTimer|null;blocked:boolean;saving:boolean;onRecord:(material?:string,subject?:string)=>void;onGoal:(minutes:number|null)=>Promise<boolean>;onGoalEditing:(open:boolean)=>void;go:(page:string)=>void;format:(n:number|null)=>string;chart:ReactNode;records:ReactNode;condition:number|null};
export function TodayHome({data,date,timer,timerReadOnly=false,blocked,saving,onRecord,onGoal,onGoalEditing,go,format:f,chart,records,condition}:Props){
 const h=useMemo(()=>todayHome(data,date),[data,date]),candidate=h.achieved?null:h.candidate,[editing,setEditing]=useState(false),[hours,setHours]=useState(''),[minutes,setMinutes]=useState(''),[error,setError]=useState(''),[material,setMaterial]=useState(''),[now,setNow]=useState(0);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();if(!timer||timer.status!=='running')return;const id=setInterval(tick,1000);return()=>clearInterval(id);},[timer?.status]);
 useEffect(()=>{setEditing(false);onGoalEditing(false);setMaterial('');return()=>onGoalEditing(false);},[date,onGoalEditing]);
 useEffect(()=>{setMaterial('');},[candidate?.id]);
 function open(v:boolean){if(saving)return;setEditing(v);onGoalEditing(v);setError('');if(v){const value=data.goals.site.daily_targets?.[date]??h.target,n=value==null?null:Math.round(value);setHours(n==null?'':String(Math.floor(n/60)));setMinutes(n==null?'':String(Math.round(n)%60));}}
 async function save(clear=false){let n:number|null=null;if(!clear){if(!/^\d+$/.test(hours)||!/^\d+$/.test(minutes)||Number(minutes)>59){setError('時間・分を整数で入力してください。分は0〜59です。');return;}n=Number(hours)*60+Number(minutes);if(!Number.isInteger(n)||n<1||n>1440){setError('目標は1分〜24時間で設定してください。');return;}}if(await onGoal(n)){setEditing(false);onGoalEditing(false);}else setError('保存できませんでした。入力は保持しています。');}
 const subject=timer?data.subjects.find(s=>s.id===timer.subjectId):candidate;
 const title=timer&&timerReadOnly?'共有計測を確認する':timer?timer.status==='review'?'計測結果を保存する':timer.status==='paused'?'学習を再開する':timer.status==='waiting'?'次の区間を始める':timer.phase==='focus'?'学習を続ける':'休憩中':h.achieved?'今日の目標・目安に到達':candidate?`次の候補：${candidate.name}`:'科目・教材を選んで始める';
 const activeMaterial=timer?data.materials.find(m=>m.id===timer.materialId)?.name:null;
 const selectedMaterials=data.materials.filter(m=>!candidate||m.subject_id===candidate.id);
 const elapsed=timer?timerElapsed(timer,now):null,timerSaved=timer&&data.study_records.some(r=>r.id===timer.id||r.source_id===timer.id);
 return <div className="today-home">
  <section className="panel summary-panel today-progress" aria-labelledby="today-progress-title">
   <div className="panel-head"><div><h2 id="today-progress-title">今日の進捗</h2><p className="muted">保存済みの学習時間</p></div><button className="daily-goal-edit" disabled={blocked} onClick={()=>open(true)}><Target size={16}/>目標を設定</button></div>
   <div className="today-total">{f(h.minutes)}</div>
   <div className="today-goal-line"><span>{h.source} {f(h.target)}</span>{h.target!==null&&<strong>{h.target===0?'休み・調整日の目安':h.achieved?<><Check size={15}/>達成</>:<>あと {f(h.remaining)}</>}</strong>}</div>
   {h.target!==null&&h.target>0&&<><div className="today-meter" role="progressbar" aria-label={h.source+'の達成率'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(h.minutes/h.target*100))}><span style={{width:Math.min(100,h.minutes/h.target*100)+'%'}}/></div><p className="muted">{Math.round(h.minutes/h.target*100)}%</p></>}
   {h.target!==null&&h.target>1440&&<p className="muted">週目標からの目安が24時間を超えています。<button onClick={()=>go('week')}>週間目標を確認</button></p>}
   {!h.rs.length&&<p className="muted">今日の記録はまだありません。手入力・JSON読込から追加できます。</p>}
   {timer&&!timerSaved&&<p className="today-unsaved">未保存の計測あり{timer.date===date&&elapsed?` · 学習 ${clockText(elapsed.studyMs)}`:' · 別の日付の計測'}<span>保存済みの時間には含めていません。</span></p>}
   <p className="today-baseline">昨日までの7日平均 {h.average===null?'比較データなし':f(h.average)}{h.count>0&&h.count<7&&`（${h.count}日分）`}</p>
  </section>
  <section className="panel summary-panel today-next" aria-labelledby="today-next-title">
   <div className="panel-head"><div><h2 id="today-next-title">次の学習</h2><p className="muted">このあと行うこと</p></div><Play size={18}/></div>
   <h3>{title}</h3>
   {timer?<><p>{subject?.name||'科目未設定'}{activeMaterial&&<> · {activeMaterial}</>}</p><p className="muted">{timer.mode==='stopwatch'?'ストップウォッチ':`ポモドーロ · ${{focus:'学習',shortBreak:'短休憩',longBreak:'長休憩'}[timer.phase]}`} · 完了 {timer.completedSets}セット</p></>:<>
    {candidate&&!h.achieved&&<p className="muted">{candidate.remainingMinutes!==null?`今週の科目目標まであと${f(candidate.remainingMinutes)}`:candidate.reason}。{candidate.minutes===0?'今日はまだ記録がありません。':''}学習配分の参考です。</p>}
    {h.achieved&&<p className="muted">ここで区切るか、続ける学習を自分で選べます。</p>}
    <label className="field"><span>次に使う教材</span><select value={material} disabled={blocked} onChange={e=>setMaterial(e.target.value)}><option value="">教材を選択（なしでも可）</option>{selectedMaterials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   </>}
   <button className="primary today-start" disabled={blocked} onClick={()=>onRecord(timer?.materialId??material,timer?.subjectId??candidate?.id)}>{timer?timer.status==='review'?'結果を確認して保存':timer.status==='paused'?'計測画面で再開':'計測画面へ':'選んで記録・計測を始める'}<ChevronRight size={16}/></button>
  </section>
  <section className="panel summary-panel today-subjects" aria-labelledby="today-subjects-title">
   <div className="panel-head"><div><h2 id="today-subjects-title">今日の科目・教材</h2><p className="muted">何を勉強したか</p></div><BookOpen size={18}/></div>
   {!h.subjects.length&&<p className="muted">科目は設定から追加できます。</p>}
   <div className="today-subject-list">{h.subjects.map(s=><details key={s.id} className="today-subject"><summary><span className="today-subject-name"><i style={{background:s.color||'var(--chart-unknown)'}}/>{s.name}</span><strong>{s.minutes>0?f(s.minutes):'記録なし'}</strong><ChevronRight size={15}/><small className="today-material-preview">{s.materials.slice(0,2).map((m:any)=>m.name).join(' · ')}{s.materials.length>2&&` ほか${s.materials.length-2}教材`}</small><div className="today-subject-bar" aria-hidden="true"><span style={{width:(h.minutes?s.minutes/h.minutes*100:0)+'%',background:s.color||'var(--chart-unknown)'}}/></div></summary><div className="today-materials">{s.materials.map((m:any)=><p key={m.id}><span>{m.name}</span><strong>{f(Number(m.minutes))}</strong></p>)}{!s.materials.length&&<p className="muted">この科目の教材記録はありません。</p>}<button disabled={blocked||s.id==='unknown'} onClick={()=>onRecord('',s.id)}>この科目で記録する</button></div></details>)}</div>
   <details className="today-records"><summary>今日の記録を見る（{h.rs.length}件）</summary>{records}</details>
  </section>
  <section className="panel summary-panel today-trend" aria-labelledby="today-trend-title">
   <div className="panel-head"><div><h2 id="today-trend-title">最近の流れ</h2><p className="muted">今日を含む7日間 · 今日の棒は途中経過</p></div><button className="detail" aria-label="学習時間の詳細" onClick={()=>go('time')}><ChevronRight/></button></div>
   {chart}
   <button className="today-context-link" onClick={()=>go('week')}><span>今週の目標進捗<small>月曜からの実績 {f(h.week.current)} / {f(h.week.goal)}</small></span><ChevronRight size={16}/></button>
   <button className="today-context-link" onClick={()=>go('condition')}><span>今週の学習状態<small>{condition===null?'評価に必要なデータが不足':`Learning Condition ${Math.round(condition)} / 100`} · Balance・Stabilityの詳細</small></span><ChevronRight size={16}/></button>
  </section>
  <Dialog open={editing} onOpenChange={open}><DialogContent className="daily-goal-dialog" onPointerDownOutside={e=>{if(saving)e.preventDefault();}} onEscapeKeyDown={e=>{if(saving)e.preventDefault();}} showCloseButton={!saving}><DialogHeader><DialogTitle>今日の目標を設定</DialogTitle><DialogDescription>{date} の目標です。未設定に戻すと曜日別・週間目標からの目安を表示します。</DialogDescription></DialogHeader><div className="manual-two"><label className="field"><span>今日の目標の時間</span><input type="number" min="0" max="24" inputMode="numeric" value={hours} disabled={saving} onChange={e=>setHours(e.target.value)}/></label><label className="field"><span>今日の目標の分</span><input type="number" min="0" max="59" inputMode="numeric" value={minutes} disabled={saving} onChange={e=>setMinutes(e.target.value)}/></label></div>{error&&<p role="alert" className="notice error">{error}</p>}<button className="primary" disabled={saving} onClick={()=>void save()}>今日の目標を保存</button><button disabled={saving} onClick={()=>void save(true)}>未設定に戻して目安を使う</button></DialogContent></Dialog>
 </div>;
}
