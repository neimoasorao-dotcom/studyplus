import {validateTimer, type StudyTimer} from './study-timer';

export type SharedTimer = {
 version: 1; revision: number; epoch: number; ownerId: string | null;
 sessionId: string | null; timer: StudyTimer | null;
 terminal: 'saved' | 'discarded' | null; updatedAt: number;
};
export type TimerSharing = {
 deviceId: string; target: string; base: SharedTimer; pending: SharedTimer | null;
 syncedAt?: number; issue?: string; remote?: SharedTimer;
 archives?: {at: number; timer: StudyTimer | null; pending: SharedTimer | null}[];
};
export const emptySharedTimer = (): SharedTimer => ({version:1,revision:0,epoch:0,ownerId:null,sessionId:null,timer:null,terminal:null,updatedAt:0});
export function validSharedTimer(x: unknown): x is SharedTimer {
 if(!x || typeof x!=='object')return false;
 const s=x as SharedTimer;
 return s.version===1 && Number.isSafeInteger(s.revision) && s.revision>=0 && Number.isSafeInteger(s.epoch) && s.epoch>=0 && Number.isFinite(s.updatedAt) && s.updatedAt>=0 &&
 (s.ownerId===null || (typeof s.ownerId==='string' && s.ownerId.length>0 && s.ownerId.length<=200)) &&
 (s.sessionId===null || (typeof s.sessionId==='string' && s.sessionId.length>0 && s.sessionId.length<=200)) &&
 (s.timer===null || validateTimer(s.timer)) && [null,'saved','discarded'].includes(s.terminal) &&
 (s.timer ? s.timer.id===s.sessionId && !!s.ownerId && s.terminal===null : s.sessionId===null ? s.terminal===null : !!s.terminal && !!s.ownerId);
}
export function timerControlled(sharing?: TimerSharing) {
 if(!sharing)return true;
 return !sharing.issue && (sharing.pending??sharing.base).ownerId===sharing.deviceId;
}
export function validTimerSharing(x: unknown): x is TimerSharing {
 if(!x||typeof x!=='object')return false;
 const s=x as TimerSharing;
 return typeof s.deviceId==='string'&&s.deviceId.length>0&&s.deviceId.length<=200&&typeof s.target==='string'&&s.target.length>0&&s.target.length<=512&&
 validSharedTimer(s.base)&&(s.pending===null||(validSharedTimer(s.pending)&&s.pending.revision===s.base.revision+1&&s.pending.ownerId===s.deviceId))&&
 (s.remote===undefined||validSharedTimer(s.remote))&&(s.issue===undefined||typeof s.issue==='string')&&
 (s.syncedAt===undefined||(Number.isFinite(s.syncedAt)&&s.syncedAt>=0))&&
 (s.archives===undefined||(Array.isArray(s.archives)&&s.archives.every(a=>Number.isFinite(a.at)&&(a.timer===null||validateTimer(a.timer))&&(a.pending===null||validSharedTimer(a.pending)))));
}
export function planTimerSync(sharing: TimerSharing, remote: SharedTimer): 'write'|'accept'|'conflict' {
 if(!sharing.pending)return 'accept';
 if(JSON.stringify(remote)===JSON.stringify(sharing.pending))return 'accept'; // Lost acknowledgement.
 return JSON.stringify(remote)===JSON.stringify(sharing.base) ? 'write':'conflict';
}
