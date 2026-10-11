export type ColorMode='light'|'dark'|'system';
export type ResolvedColorMode='light'|'dark';
const key='studyplus.colorMode';

// Self-contained so the same initialization can run before the first paint.
export function applyColorMode(next?:ColorMode){
 let mode:ColorMode=next??'system';
 if(!next){try{const saved=localStorage.getItem('studyplus.colorMode');if(saved==='light'||saved==='dark'||saved==='system')mode=saved;}catch{}}
 let systemDark=false;try{systemDark=window.matchMedia('(prefers-color-scheme: dark)').matches;}catch{}
 const resolved:ResolvedColorMode=mode==='dark'||(mode==='system'&&systemDark)?'dark':'light';
 const root=document.documentElement;root.classList.toggle('dark',resolved==='dark');root.dataset.colorMode=mode;root.dataset.resolvedColorMode=resolved;root.style.colorScheme=resolved;
 return {mode,resolved};
}
export const colorModeBootstrap=`(${applyColorMode.toString()})()`;
let initialized=false,snapshot='system:light';
const listeners=new Set<()=>void>();
function update(mode?:ColorMode){const state=applyColorMode(mode);snapshot=state.mode+':'+state.resolved;listeners.forEach(fn=>fn());}
function initialize(){
 if(initialized||typeof window==='undefined')return;
 initialized=true;update();
 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(snapshot.startsWith('system:'))update('system');});
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)update();});
}
export function colorModeSnapshot(){initialize();return snapshot;}
export function subscribeColorMode(callback:()=>void){initialize();listeners.add(callback);return()=>{listeners.delete(callback);};}
export function setColorMode(mode:ColorMode){initialize();try{localStorage.setItem(key,mode);}catch{}update(mode);}
export function nextColorMode(mode:ColorMode):ColorMode{return mode==='light'?'dark':mode==='dark'?'system':'light';}
