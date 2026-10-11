import {validateTimer, type StudyTimer, defaultTimerConfig, validTimerConfig, type TimerConfig} from './study-timer';
import {validTimerSharing, type TimerSharing} from './shared-timer';
export type TimerState = {revision:number;timer:StudyTimer|null;config:TimerConfig;sharing?:TimerSharing};
const empty=():TimerState=>({revision:0,timer:null,config:{...defaultTimerConfig}});
export async function timerStore(write?: {expected:number;timer:StudyTimer|null;config?:TimerConfig;sharing?:TimerSharing}): Promise<TimerState> {
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  let blocked=false;const r=indexedDB.open('studyplus-timer-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('timer');
  r.onsuccess=()=>{if(blocked)r.result.close();else resolve(r.result);};r.onerror=()=>reject(r.error);
  r.onblocked=()=>{blocked=true;reject(Error('別のタブを閉じて、タイマーを再読込してください。'));};
 });
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('timer',write?'readwrite':'readonly'),store=tx.objectStore('timer'),r=store.get('main');let result=empty(),error='タイマーの下書きを保存できません。計測は開始・変更していません。';
  r.onsuccess=()=>{
   try{
   const current=r.result??empty();
   if(!Number.isSafeInteger(current.revision)||current.revision<0||(current.timer&&!validateTimer(current.timer))||!validTimerConfig(current.config)||(current.sharing&&!validTimerSharing(current.sharing))){error='タイマーの下書き形式を確認できません。データは変更していません。';tx.abort();return;}
   result=current;
   if(write){
    if(write.expected!==current.revision){error='別のタブでタイマーが更新されました。最新の状態を再読込してください。';tx.abort();return;}
    if((write.timer&&!validateTimer(write.timer))||(write.config&&!validTimerConfig(write.config))||(write.sharing&&!validTimerSharing(write.sharing))){tx.abort();return;}
    result={...current,revision:current.revision+1,timer:write.timer,config:write.config??current.config,...(write.sharing?{sharing:write.sharing}:{})};store.put(result,'main');
   }
   }catch{tx.abort();}
  };
  tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(Error(error));};
 });
}
