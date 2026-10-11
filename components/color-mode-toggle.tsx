'use client';
import {useSyncExternalStore} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
import {colorModeSnapshot,subscribeColorMode,setColorMode,nextColorMode,type ColorMode,type ResolvedColorMode} from '../lib/color-mode';

export function useColorMode(){
 const snapshot=useSyncExternalStore(subscribeColorMode,colorModeSnapshot,()=> 'system:light');
 const [mode,resolved]=snapshot.split(':') as [ColorMode,ResolvedColorMode];
 return {mode,resolved};
}
export function ColorModeToggle(){
 const {mode}=useColorMode(),next=nextColorMode(mode);
 const Icon=mode==='light'?Sun:mode==='dark'?Moon:Monitor;
 const labels={light:'ライト',dark:'ダーク',system:'システム'};
 return <button type="button" className="color-mode-toggle" data-mode={mode} aria-label={`表示モード：${labels[mode]}。${labels[next]}に切り替える`} onClick={()=>setColorMode(next)}><Icon size={18} aria-hidden="true"/></button>;
}
