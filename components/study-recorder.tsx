'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useIsMobile} from '../hooks/use-mobile';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './ui/dialog';
import {ManualRecordForm} from './manual-record-form';
import {useInputViewport} from './mobile-analysis';
import {today,type Data} from '../lib/analysis';
import {initialRecord, type buildManualRecord} from '../lib/manual-record';
import {clockText,createTimer,defaultTimerConfig,finishTimer,pauseTimer,resumeTimer,settleTimer,timerElapsed,timerMinutes,timerReview,type StudyTimer,type TimerConfig} from '../lib/study-timer';
import {timerStore,type TimerState} from '../lib/timer-store';
import {timerControlled} from '../lib/shared-timer';
import {synchronizeTimer,changeSharedTimer,takeOverTimer,acceptRemoteTimer} from '../github-pages/timer-sync';
import {synchronize} from '../github-pages/device-sync';
import {PomodoroIndicator} from './pomodoro-indicator';
import {TimerMiniContent,useTimerPictureInPicture} from './timer-picture-in-picture';

type TimerRecord=ReturnType<typeof buildManualRecord> & {timer?:{mode:StudyTimer['mode'];elapsed_seconds:number;completed_sets:number;config?:TimerConfig}};
type Props={shareTimer?:boolean;onSharedRecordsApplied?:()=>Promise<void>;initialSubject?:string;onTimerChange?:(timer:StudyTimer|null)=>void;onTimerControlChange?:(readOnly:boolean)=>void;data:Data;date:string;materialId:string|null;saving:boolean;blocked:boolean;bannerTarget?:HTMLElement|null;onOpen:(material:string|null)=>void;onSave:(record:TimerRecord)=>Promise<boolean>;onSettings:()=>void};
const phases={focus:'学習',shortBreak:'短休憩',longBreak:'長休憩'};
const methodNames={manual:'手入力',stopwatch:'ストップウォッチ',pomodoro:'ポモドーロ'};
export function StudyRecorder({data,materialId,saving,blocked,bannerTarget,onOpen,onSave,onSettings,initialSubject,onTimerChange,onTimerControlChange,shareTimer=false,onSharedRecordsApplied}:Props){
 const isMobile=useIsMobile();
 const [stored,setStored]=useState<TimerState|null>(null),[method,setMethod]=useState<'manual'|'stopwatch'|'pomodoro'>('manual'),[now,setNow]=useState(0),[config,setConfig]=useState<TimerConfig>({...defaultTimerConfig}),[subject,setSubject]=useState(''),[material,setMaterial]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[discard,setDiscard]=useState(false),[restored,setRestored]=useState(false),[sound,setSound]=useState(false),[shareMessage,setShareMessage]=useState(''),[sharingBusy,setSharingBusy]=useState(false);
 const state=useRef<TimerState|null>(null),operating=useRef(false),audio=useRef<AudioContext|null>(null),mounted=useRef(true);
 const date=today(data.profile.timezone);
 useEffect(()=>{onTimerChange?.(stored?.timer??null);},[stored?.timer,onTimerChange]);
 const rawTimer=stored?.timer??null,viewport=useInputViewport(materialId!==null);
 function accept(s:TimerState){state.current=s;setStored(s);}
 const canOperate=!stored?.sharing || timerControlled(stored.sharing);
 const timer=rawTimer&&!canOperate?settleTimer(rawTimer,now):rawTimer;
 const timerName=timer?data.materials.find(m=>m.id===timer.materialId)?.name||data.subjects.find(s=>s.id===timer.subjectId)?.name||'科目を確認':'';
 const pip=useTimerPictureInPicture(timer,timerName,now,setNow);
 useEffect(()=>{onTimerControlChange?.(!canOperate);},[canOperate,onTimerControlChange]);
 async function refreshSharing(){
  if(!shareTimer||operating.current)return;
  try{const s=await synchronizeTimer();if(mounted.current){accept(s);setShareMessage(navigator.onLine||!s.sharing?'':'オフライン：表示は最終確認時点の共有状態です。端末内の変更は通信復帰後に送信します。');}}
  catch(e){if(mounted.current)setShareMessage((e as Error).message);}
 }
 async function sharedAction(action:()=>Promise<TimerState>){
  if(operating.current)return;
  operating.current=true;setSharingBusy(true);
  try{accept(await action());setError('');setShareMessage('');}
  catch(e){setShareMessage((e as Error).message);}
  finally{operating.current=false;setSharingBusy(false);}
 }
 async function reload(){try{const s=await timerStore();accept(s);setError('');return s;}catch(e){setError((e as Error).message);return null;}}
 useEffect(()=>{
  mounted.current=true;
  timerStore().then(s=>{if(mounted.current){state.current=s;setStored(s);setConfig(s.config);setRestored(!!s.timer&&timerControlled(s.sharing));}}).catch(e=>{if(mounted.current)setError((e as Error).message);});
  const tick=()=>setNow(Date.now());tick();const interval=setInterval(tick,250);
  const refresh=()=>{tick();if(!operating.current)void timerStore().then(s=>{if(mounted.current){state.current=s;setStored(s);}}).catch(e=>setError((e as Error).message));};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('studyplus-timer'):null;
  if(channel)channel.onmessage=refresh;
  return()=>{mounted.current=false;clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);channel?.close();void audio.current?.close();};
 },[]);
 useEffect(()=>{
  if(materialId===null)return;
  const opener=setTimeout(()=>{const initial=initialRecord(date,data,materialId);setMaterial(initial.material_id);setSubject(initial.subject_id||initialSubject||'');setDiscard(false);setMethod(state.current?.timer?.mode??'manual');},0);
  return()=>clearTimeout(opener);
  // The record opener supplies a new selection only when it opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[materialId]);
 useEffect(()=>{
  if(!shareTimer)return;
  let stopped=false,inFlight=false,delay=15000,timeout:ReturnType<typeof setTimeout>;
  const poll=async()=>{if(stopped||inFlight)return;inFlight=true;clearTimeout(timeout);if((document.visibilityState==='visible'||pip.isOpen)&&!operating.current){try{const s=await synchronizeTimer();if(!stopped){accept(s);setShareMessage(navigator.onLine||!s.sharing?'':'オフライン：表示は最終確認時点の共有状態です。端末内の変更は通信復帰後に送信します。');}delay=s.timer||s.sharing?.pending?15000:30000;}catch(e){if(!stopped)setShareMessage((e as Error).message);delay=Math.min(delay*2,120000);}}inFlight=false;if(!stopped)timeout=setTimeout(poll,delay);};
  const wake=()=>{clearTimeout(timeout);void poll();};
  timeout=setTimeout(poll,1000);window.addEventListener('focus',wake);window.addEventListener('online',wake);window.addEventListener('offline',wake);document.addEventListener('visibilitychange',wake);
  return()=>{stopped=true;clearTimeout(timeout);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',wake);document.removeEventListener('visibilitychange',wake);};
 },[shareTimer,pip.isOpen]);
 function broadcast(){if(typeof BroadcastChannel!=='undefined'){const c=new BroadcastChannel('studyplus-timer');c.postMessage('changed');c.close();}}
 async function change(update:(t:StudyTimer|null)=>StudyTimer|null,nextConfig?:TimerConfig,terminal:'saved'|'discarded'='discarded'){
  if(operating.current||!state.current)return false;
  const expectedTimerId=state.current.timer?.id??null;
  operating.current=true;setBusy(true);setError('');
  try{
   if(shareTimer&&navigator.onLine){try{accept(await synchronizeTimer());}catch(e){setShareMessage((e as Error).message);}}
   const current=state.current!;
   if((current.timer?.id??null)!==expectedTimerId)throw Error('共有計測が変わりました。最新の計測を確認してください。');
   const proposed=update(current.timer);
   if(proposed===current.timer&&!nextConfig)return false;
   const next=shareTimer?await changeSharedTimer(current.revision,proposed,nextConfig,terminal):await timerStore({expected:current.revision,timer:proposed,config:nextConfig});if(mounted.current)accept(next);broadcast();if(shareTimer)setTimeout(()=>{void refreshSharing();},0);return true;}
  catch(e){if(mounted.current)setError((e as Error).message);return false;}
  finally{operating.current=false;if(mounted.current)setBusy(false);}
 }
 function bell(){if(!sound||!audio.current||document.visibilityState!=='visible')return;try{const a=audio.current,o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.08,a.currentTime);o.frequency.value=660;o.start();o.stop(a.currentTime+.3);}catch{}}
 useEffect(()=>{
  if(!timer||timer.status!=='running'||busy||error||!canOperate)return;
  const settled=settleTimer(timer,now);
  if(settled!==timer)void change(t=>t?settleTimer(t,Date.now()):t).then(ok=>{if(ok)bell();});
  // Timer writes happen only at an interval boundary; ticks never write data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[timer,now,busy,error]);
 async function start(){
  if(method==='manual'||blocked||!state.current||state.current.timer)return;
  if(!data.subjects.some(s=>s.id===subject)){setError('科目を選択してください。');return;}
  if(material&&!data.materials.some(m=>m.id===material)){setError('教材を選び直してください。');return;}
  const startedAt=Date.now();
  const mode=method,selectedConfig=mode==='pomodoro'?config:state.current.config;
  await change(t=>{if(t)throw Error('共有先に計測があります。新しい計測は開始していません。');return createTimer(mode,'timer-'+crypto.randomUUID(),date,subject,material,selectedConfig,startedAt);},selectedConfig);
  setRestored(false);
 }
 async function finish(){const endedAt=Date.now();await change(t=>{if(!t)return t;const next=finishTimer(t,endedAt);return {...next,review:next.review??timerReview(next,data.profile.timezone)};});setRestored(false);}
 async function saveTimer(record:ReturnType<typeof buildManualRecord>){
  if(shareTimer&&navigator.onLine){try{accept(await synchronizeTimer());}catch(e){setShareMessage((e as Error).message);}}
  const current=state.current;
  if(current?.sharing&&!timerControlled(current.sharing)){setError('この計測は閲覧用です。操作を引き継いでください。');return false;}
  if(!current?.timer||current.timer.status!=='review'||operating.current)return false;
  // Verify the draft is still this revision before using it. The learning-data
  // save's own revision CAS and fixed ID protect repeated/reloaded submissions.
  try{const latest=await timerStore();if(latest.revision!==current.revision){setError('別のタブでタイマーが更新されました。再読込してください。');return false;}}catch(e){setError((e as Error).message);return false;}
  const t=current.timer;
  const saved=data.study_records.some(r=>r.id===t.id||r.source_id===t.id)||await onSave({...record,timer:{mode:t.mode,elapsed_seconds:Math.floor(t.studyMs/1000),completed_sets:t.completedSets,config:t.mode==='pomodoro'?t.config:undefined}});
  if(!saved)return false;
  if(shareTimer&&current.sharing){
   try{if(!navigator.onLine)throw Error('記録は端末内に保存済みです。通信復帰後にもう一度保存して、共有計測を完了してください。');
    const r=await synchronize();if(r.conflicts.length||r.warning)throw Error('学習記録の同期を確認してから共有計測を完了してください。');
    if(r.changed)await onSharedRecordsApplied?.();
   }catch(e){setError((e as Error).message);return false;}
  }
  if(!await change(t=>{if(t?.id!==current.timer!.id)throw Error('計測が変わりました。共有状態を再確認してください。');return null;},undefined,'saved'))return false;
  setRestored(false);return true;
 }
 const elapsed=timer?timerElapsed(timer,now):null;
 const label=timer?timer.status==='review'?'保存待ち':timer.status==='paused'?'一時停止中':timer.status==='waiting'?`${phases[timer.phase]}の開始待ち`:timer.phase==='focus'?'計測中':`${phases[timer.phase]}中`:'';
 const disabled=busy||saving||sharingBusy;
 const mobileTime=timer?timer.mode==='pomodoro'&&timer.status!=='review'?`${phases[timer.phase]} ${clockText(elapsed!.remainingMs)}`:`${timer.mode==='stopwatch'?'経過':'学習'} ${clockText(elapsed!.studyMs)}`:'';
 const timerSubject=timer?data.subjects.find(s=>s.id===timer.subjectId)?.name||'科目未設定':'';
 const banner=timer&&materialId===null?<button className="timer-banner" data-status={timer.status} data-phase={timer.phase} onClick={()=>onOpen(timer.materialId)} aria-label={`学習タイマーを開く：${restored?'計測を復元、':''}${label}、${mobileTime}、${timerSubject}`}>
 <TimerMiniContent timer={timer} now={now} name={timerName} showName={!isMobile}/>
 </button>:null;
 return <>
 {bannerTarget?createPortal(banner&&!isMobile?<div className="timer-banner-group">{banner}{pip.icon}</div>:banner,bannerTarget):banner}
 {pip.view}
 {pip.error&&<div className="notice error" role="alert">{pip.error}</div>}
 {error&&materialId===null&&<div className="notice error" role="alert">{error}<button onClick={()=>{void reload();}}>タイマーを再読込</button></div>}
 <Dialog open={materialId!==null} onOpenChange={open=>{if(!open&&!disabled)onOpen(null);}}><DialogContent placement="responsive-sheet" className="manual-dialog recorder-dialog" style={viewport} showCloseButton={!disabled} onEscapeKeyDown={e=>{if(disabled)e.preventDefault();}} onPointerDownOutside={e=>e.preventDefault()}>
 <div className="manual-handle"/><DialogHeader><DialogTitle>{timer&&method!=='manual'&&timer.status==='review'?'計測結果を保存':'学習記録を追加'}</DialogTitle><DialogDescription className="sr-only">手入力、ストップウォッチ、ポモドーロから記録方法を選択します。</DialogDescription></DialogHeader>
 <div className="recorder-methods" role="group" aria-label="記録方法">{(['manual','stopwatch','pomodoro'] as const).map(m=><button key={m} aria-pressed={method===m} disabled={disabled||(m!=='manual'&&!!timer&&timer.mode!==m)} onClick={()=>{setMethod(m);setDiscard(false);}}>{methodNames[m]}</button>)}</div>
 {method==='manual'?materialId!==null&&<ManualRecordForm key={materialId} data={data} date={date} materialId={materialId} initialInput={initialSubject?{...initialRecord(date,data,materialId),subject_id:initialSubject}:undefined} saving={saving} onSave={onSave} onClose={()=>onOpen(null)} onSettings={onSettings}/>:<div className="timer-panel">
 {shareTimer&&(stored?.sharing||shareMessage)&&<section className="timer-sharing" aria-label="計測の端末間共有">
 <p role="status">{stored?.sharing?.issue??shareMessage??''}</p>
 {stored?.sharing&&<><p>{stored.sharing.issue?'共有状態の確認が必要です':stored.sharing.pending?'計測の変更を送信待ち':!timer?'共有計測なし':canOperate?'この端末で操作できます':'別の端末の計測を表示しています'}{stored.sharing.syncedAt&&` · 最終確認 ${new Date(stored.sharing.syncedAt).toLocaleTimeString('ja-JP')}`}</p>
 {!canOperate&&!stored.sharing.issue&&timer&&<button disabled={disabled} onClick={()=>{void sharedAction(takeOverTimer);}}>この端末で操作する</button>}
 <button disabled={disabled} onClick={()=>{void sharedAction(synchronizeTimer);}}>共有計測を再確認</button>
 {stored.sharing.issue&&<button disabled={disabled} onClick={()=>{void sharedAction(acceptRemoteTimer);}}>端末内の計測を保管して共有状態を表示</button>}
 {(stored.sharing.issue||stored.sharing.archives?.length)&&<button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({timer:stored.timer,pending:stored.sharing?.pending,archives:stored.sharing?.archives},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='studyplus_timer_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>未送信・保管した計測をJSON出力</button>}</>}
 </section>}
 {error&&<div className="notice error" role="alert">{error}<button disabled={disabled} onClick={()=>{void reload();}}>最新の計測を再読込</button></div>}
 {!stored&&<p role="status">計測の保存先を確認しています。</p>}
 {!timer?<>
 <div className="manual-two"><label className="field"><span>計測する科目</span><select value={subject} onChange={e=>setSubject(e.target.value)} disabled={disabled}><option value="">選択してください</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>計測する教材</span><select value={material} disabled={disabled} onChange={e=>{setMaterial(e.target.value);const m=data.materials.find(m=>m.id===e.target.value);if(m&&data.subjects.some(s=>s.id===m.subject_id))setSubject(m.subject_id);}}><option value="">教材なし</option>{data.materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>
 {method==='pomodoro'&&<div className="form-grid">{([['focus','学習（分）'],['shortBreak','短休憩（分）'],['longBreak','長休憩（分）'],['sets','長休憩までのセット数']] as const).map(([key,name])=><label className="field" key={key}><span>{name}</span><input type="number" min={1} max={{focus:180,shortBreak:60,longBreak:120,sets:12}[key]} step={1} value={Number.isNaN(config[key])?'':config[key]} onChange={e=>{setConfig({...config,[key]:e.target.value===''?NaN:Number(e.target.value)});setError('');}}/></label>)}</div>}
 {!data.subjects.length&&<button onClick={onSettings}>科目を設定する</button>}
 <p className="muted">{method==='pomodoro'?'休憩は記録に含めません。次の区間はボタンで開始します。':'一時停止中の時間は記録に含めません。'}{stored?.sharing?'計測状況はGitHubの共有先と同期します。':'計測はこの端末に保存します。'}</p>
 <button className="primary" disabled={disabled||blocked||!stored||!subject||!!error} onClick={()=>{void start();}}>計測を開始</button>
 </>:<>
 {restored&&<p className="notice">中断前の計測を復元しました。経過時間を確認し、続けるか、終了して保存してください。</p>}
 <p className="timer-target">{data.subjects.find(s=>s.id===timer.subjectId)?.name||'科目を選び直してください'} · {data.materials.find(m=>m.id===timer.materialId)?.name||'教材なし'}</p>
 <p className="timer-phase" role="status">{label}{timer.mode==='pomodoro'&&` · 完了 ${timer.completedSets}セット`}</p>
 {timer.mode==='pomodoro'&&timer.status!=='review'?<PomodoroIndicator timer={timer} remainingMs={elapsed!.remainingMs}/>:<output className="timer-clock" aria-live="off" aria-label="計測した学習時間">{clockText(elapsed!.studyMs)}</output>}
 {timer.mode==='pomodoro'&&<p>累計学習時間 {clockText(elapsed!.studyMs)}</p>}
 {timer.status==='review'?<>
 <p className="muted">計測 {clockText(timer.studyMs)} → 保存 {timerMinutes(timer.studyMs)}分。科目・教材・日付・時間を修正できます。日付は開始日です。</p>
 <ManualRecordForm key={timer.id} data={data} date={date} initialInput={timer.review??timerReview(timer,data.profile.timezone)} recordId={timer.id} singleSave saving={disabled||!canOperate} onSave={saveTimer} onClose={()=>onOpen(null)} onSettings={onSettings}/>
 </>:<div className="timer-actions">
 {timer.status==='running'?<button disabled={disabled||!canOperate} onClick={()=>{const at=Date.now();void change(t=>t?pauseTimer(t,at):t);}}>一時停止</button>:<button className="primary" disabled={disabled||blocked||!canOperate} onClick={()=>{const at=Date.now();void change(t=>t?resumeTimer(t,at):t);setRestored(false);}}>{timer.status==='waiting'?`${phases[timer.phase]}を開始`:'計測を再開'}</button>}
 <button disabled={disabled||!canOperate} onClick={()=>{void finish();}}>終了して保存へ</button>
 </div>}
 {discard?<div className="notice"><p>この計測を破棄しますか？保存済みの学習記録は残ります。</p><div className="timer-actions"><button disabled={disabled||!canOperate} className="danger-outline" onClick={()=>{void change(()=>null).then(ok=>{if(ok){setDiscard(false);setRestored(false);}});}}>計測を破棄する</button><button onClick={()=>setDiscard(false)}>キャンセル</button></div></div>:<button className="quiet" disabled={disabled||!canOperate} onClick={()=>setDiscard(true)}>この計測を破棄</button>}
 <button disabled={disabled} onClick={()=>onOpen(null)}>画面を閉じる（計測・下書きを保持）</button>
 </>}
 {method==='pomodoro'&&<label className="timer-sound"><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);if(e.target.checked){try{audio.current??=new AudioContext();void audio.current.resume();}catch{setSound(false);setError('このブラウザでは終了音を利用できません。');}}}}/>区間終了時に音を鳴らす</label>}
 <p className="muted">画面ロック中の音は保証されません。画面に戻ると時刻から復元し、ポモドーロは現在の区間で止まります。学習時間は最大24時間です。</p>
 </div>}
 </DialogContent></Dialog>
 </>;
}
