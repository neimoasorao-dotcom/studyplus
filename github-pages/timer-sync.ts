import {getTimerConnection} from './device-sync';
import {readGitHubTimer,writeGitHubTimer} from './github-timer';
import {timerStore,type TimerState} from '../lib/timer-store';
import {emptySharedTimer,planTimerSync,timerControlled,type TimerSharing} from '../lib/shared-timer';
import type {StudyTimer,TimerConfig} from '../lib/study-timer';

let queue:Promise<unknown>=Promise.resolve();
function exclusive<T>(operation:()=>Promise<T>):Promise<T>{
 const run=async()=>{
  if(!navigator.locks)return operation();
  let entered=false;
  try{return await navigator.locks.request('studyplus-shared-timer',()=>{entered=true;return operation();});}
  catch(e){if(!entered&&e instanceof DOMException&&['SecurityError','NotSupportedError'].includes(e.name))return operation();throw e;}
 };
 const result=queue.then(run,run);queue=result.catch(()=>{});return result;
}
const identity=(c:NonNullable<Awaited<ReturnType<typeof getTimerConnection>>>)=>c.target.repository+':'+c.target.branch;
function announce(){if(typeof BroadcastChannel!=='undefined'){const c=new BroadcastChannel('studyplus-timer');c.postMessage('changed');c.close();}}
async function put(current:TimerState,timer:StudyTimer|null,sharing:TimerSharing,config?:TimerConfig){
 const next=await timerStore({expected:current.revision,timer,sharing,config});announce();return next;
}
async function sync():Promise<TimerState>{
 const c=await getTimerConnection();let local=await timerStore();
 if(!c||!navigator.onLine)return local;
 const target=identity(c);
 if(!local.sharing){
  local=await put(local,local.timer,{deviceId:crypto.randomUUID(),target,base:emptySharedTimer(),pending:null});
 }
 let sharing=local.sharing!;
 if(sharing.target!==target){
  // A different repository never receives old drafts automatically.
  sharing={...sharing,target,base:emptySharedTimer(),pending:null,issue:undefined,remote:undefined,archives:[...(sharing.archives??[]),{at:Date.now(),timer:local.timer,pending:sharing.pending}]};
  local=await put(local,null,sharing);
 }
 if(!navigator.onLine)return local;
 const remote=await readGitHubTimer(c.target);
 const latest=await getTimerConnection();
 if(!latest||latest.session!==c.session)throw Error('同期設定が変わりました。共有計測は再確認してください。');
 if(remote.state.revision<sharing.base.revision)throw Error('共有計測の更新番号が戻っています。上書きしていません。');
 const decision=planTimerSync(sharing,remote.state);
 if(decision==='conflict')return put(local,local.timer,{...sharing,issue:'別の端末で計測が変更されました。未送信の計測は保持しています。',remote:remote.state});
 if(sharing.issue)return local;
 if(!sharing.pending&&local.timer&&!sharing.base.timer&&sharing.base.revision===0){
  if(remote.state.timer)return put(local,local.timer,{...sharing,issue:'端末内と共有先に別の計測があります。端末内の計測は保持しています。',remote:remote.state});
  const pending={...remote.state,revision:remote.state.revision+1,epoch:remote.state.epoch+1,ownerId:sharing.deviceId,sessionId:local.timer.id,timer:local.timer,terminal:null,updatedAt:Date.now()} as const;
  local=await put(local,local.timer,{...sharing,base:remote.state,pending});sharing=local.sharing!;
 }
 let state=remote.state;
 if(sharing.pending&&JSON.stringify(sharing.pending)!==JSON.stringify(remote.state)){
  await writeGitHubTimer(c.target,remote,sharing.pending);state=sharing.pending;
 }
 const after=await getTimerConnection();
 if(!after||after.session!==c.session)throw Error('同期設定が変わりました。送信結果は再確認してください。');
 if(!sharing.pending&&JSON.stringify(sharing.base)===JSON.stringify(state)&&local.timer===null&&state.timer===null)return local;
 return put(local,state.timer,{...sharing,base:state,pending:null,remote:undefined,issue:undefined,syncedAt:Date.now()});
}
export function synchronizeTimer(){return exclusive(sync);}

export function changeSharedTimer(expected:number,timer:StudyTimer|null,config?:TimerConfig,terminal:'saved'|'discarded'='discarded'){
 return exclusive(async()=>{
  const current=await timerStore();
  if(current.revision!==expected)throw Error('別のタブで計測が更新されました。最新の計測を再読込してください。');
  const c=await getTimerConnection();
  if(!c&&!current.sharing)return timerStore({expected,timer,config});
  const sharing=current.sharing??{deviceId:crypto.randomUUID(),target:identity(c!),base:emptySharedTimer(),pending:null};
  if(c&&sharing.target!==identity(c))throw Error('同期先が変わりました。共有計測を再確認してください。');
  if(sharing.issue)throw Error(sharing.issue);
  const state=sharing.pending??sharing.base;
  if(current.timer&&!timerControlled(sharing))throw Error('この計測は別の端末で操作しています。「この端末で操作する」で引き継いでください。');
  if(!current.timer&&state.timer)throw Error('共有先に計測があります。再確認してください。');
  const starting=!!timer&&!current.timer;
  const pending={...state,version:1 as const,revision:sharing.base.revision+1,ownerId:sharing.deviceId,epoch:state.epoch+(starting?1:0),sessionId:timer?.id??current.timer?.id??state.sessionId,timer,terminal:timer?null:terminal,updatedAt:Date.now()};
  return put(current,timer,{...sharing,pending},config);
 });
}
export function takeOverTimer(){return exclusive(async()=>{
 if(!navigator.onLine)throw Error('操作の引き継ぎには通信が必要です。');
 const current=await sync(),sharing=current.sharing,c=await getTimerConnection();
 if(!c||!sharing)throw Error('GitHubの端末間同期を設定してください。');
 if(sharing.issue||sharing.pending||!sharing.base.timer)throw Error('共有計測を確認してから引き継いでください。');
 const remote=await readGitHubTimer(c.target);
 if(remote.state.revision!==sharing.base.revision)throw Error('共有計測が更新されました。再確認してください。');
 const pending={...remote.state,revision:remote.state.revision+1,epoch:remote.state.epoch+1,ownerId:sharing.deviceId,updatedAt:Date.now()};
 // Ownership is applied locally only after the SHA-guarded write succeeds.
 await writeGitHubTimer(c.target,remote,pending);
 if((await getTimerConnection())?.session!==c.session)throw Error('同期設定が変わりました。再確認してください。');
 return put(current,pending.timer,{...sharing,base:pending,pending:null,syncedAt:Date.now()});
 });}
export function acceptRemoteTimer(){return exclusive(async()=>{
 const current=await timerStore(),sharing=current.sharing;
 if(!sharing?.issue)throw Error('共有計測を再確認してください。');
 const c=await getTimerConnection();if(!c||identity(c)!==sharing.target||!navigator.onLine)throw Error('共有状態の確認には通信が必要です。');
 const remote=await readGitHubTimer(c.target);
 return put(current,remote.state.timer,{...sharing,base:remote.state,pending:null,issue:undefined,remote:undefined,syncedAt:Date.now(),archives:[...(sharing.archives??[]),{at:Date.now(),timer:current.timer,pending:sharing.pending}]});
 });}
