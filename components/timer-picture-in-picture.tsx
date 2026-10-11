'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {clockText,timerElapsed,type StudyTimer} from '../lib/study-timer';
import {subscribeColorMode,colorModeSnapshot} from '../lib/color-mode';

type PictureInPictureAPI={requestWindow:(options:{width:number;height:number;preferInitialWindowPlacement:boolean})=>Promise<Window>};
function pictureInPictureAPI(){return (window as Window&{documentPictureInPicture?:PictureInPictureAPI}).documentPictureInPicture;}

// Both the sidebar and the read-only floating window use this exact display.
export function TimerMiniContent({timer,now,name,showName=true}:{timer:StudyTimer;now:number;name:string;showName?:boolean}){
 const elapsed=timerElapsed(timer,now);
 return <><strong className="timer-banner-time">{clockText(timer.mode==='pomodoro'&&timer.status!=='review'?elapsed.remainingMs:elapsed.studyMs)}</strong>{showName&&<span className="timer-banner-name">{name}</span>}</>;
}

export function useTimerPictureInPicture(timer:StudyTimer|null,name:string,now:number,onTick:(now:number)=>void){
 const [supported,setSupported]=useState(false),[popup,setPopup]=useState<{window:Window;root:HTMLElement}|null>(null),[error,setError]=useState('');
 const owned=useRef<Window|null>(null),opening=useRef(false),mounted=useRef(true),current=useRef(timer);
 current.current=timer;
 useEffect(()=>{
  mounted.current=true;setSupported(window.isSecureContext&&typeof pictureInPictureAPI()?.requestWindow==='function');
  return()=>{mounted.current=false;owned.current?.close();owned.current=null;};
 },[]);
 useEffect(()=>{
  if(!timer){owned.current?.close();owned.current=null;setPopup(null);}
 },[timer?.id]);
 useEffect(()=>{
  if(!popup)return;
  const tick=()=>onTick(Date.now());tick();
  // The visible PiP document supplies the clock even when the original tab is hidden.
  const interval=popup.window.setInterval(tick,250);
  return()=>popup.window.clearInterval(interval);
 },[popup,onTick]);
 useEffect(()=>{
  if(!popup)return;
  const apply=()=>{const resolved=colorModeSnapshot().split(':')[1];popup.window.document.documentElement.classList.toggle('dark',resolved==='dark');popup.window.document.documentElement.style.colorScheme=resolved;};
  apply();return subscribeColorMode(apply);
 },[popup]);
 async function open(){
  if(opening.current||!current.current)return;
  if(owned.current&&!owned.current.closed){owned.current.focus();return;}
  const api=pictureInPictureAPI();if(!api){setError('このブラウザでは計測の小窓を利用できません。');return;}
  opening.current=true;setError('');
  let win:Window|undefined;
  try{
   // Called directly by the icon click to retain the required user activation.
   win=await api.requestWindow({width:240,height:96,preferInitialWindowPlacement:true});
   if(!mounted.current||!current.current){win.close();return;}
   win.document.documentElement.className=document.documentElement.className;
   win.document.title='Studyplus 学習タイマー';win.document.documentElement.lang='ja';
   for(const sheet of document.querySelectorAll('style,link[rel="stylesheet"]')){
    const clone=win.document.importNode(sheet,true);
    if(sheet instanceof HTMLLinkElement)(clone as HTMLLinkElement).href=sheet.href;
    win.document.head.appendChild(clone);
   }
   const style=win.document.createElement('style');
   style.textContent='html,body{margin:0!important;min-width:0!important;min-height:0!important}body{background:var(--background);color:var(--foreground)}.pip-timer-display{padding:6px}.pip-timer-display .timer-banner{position:static;cursor:default;height:auto;border:1px solid var(--border);border-radius:6px;font-weight:500;width:100%;margin:0;box-sizing:border-box}.pip-timer-display .timer-banner .timer-banner-time{font-size:1.125rem}.pip-timer-display .timer-banner-name{max-width:100%;overflow-wrap:anywhere}';
   win.document.head.appendChild(style);
   const root=win.document.createElement('div');win.document.body.appendChild(root);
   const opened=win;owned.current=opened;
   opened.addEventListener('pagehide',()=>{if(owned.current===opened){owned.current=null;if(mounted.current)setPopup(null);}},{once:true});
   setPopup({window:opened,root});
  }catch{win?.close();if(mounted.current)setError('小窓を開けませんでした。対応するPCのChromeで、ブラウザの利用制限を確認してください。計測は続いています。');}
  finally{opening.current=false;}
 }
 const icon=supported&&timer?<button type="button" className="timer-pip-trigger" aria-label="計測を小窓で表示" title="計測を小窓で表示" aria-pressed={!!popup} onClick={()=>{void open();}}>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4M14 3v7h7M3 21l8-8M3 13h8v8"/></svg>
 </button>:null;
 const view=popup&&timer?createPortal(<div className="sidebar-timer-slot pip-timer-display"><div className="timer-banner" data-status={timer.status} data-phase={timer.phase} role="timer" aria-live="off" aria-label={`${name}の学習タイマー`}><TimerMiniContent timer={timer} now={now} name={name}/></div></div>,popup.root):null;
 return {icon,view,error,isOpen:!!popup};
}
