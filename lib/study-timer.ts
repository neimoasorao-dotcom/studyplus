import type {RecordInput} from './manual-record';

export type TimerConfig = {focus: number; shortBreak: number; longBreak: number; sets: number};
export const defaultTimerConfig: TimerConfig = {focus: 25, shortBreak: 5, longBreak: 15, sets: 4};
export type StudyTimer = {
 version: 1; id: string; mode: 'stopwatch' | 'pomodoro'; subjectId: string; materialId: string;
 date: string; startedAt: number; status: 'running' | 'paused' | 'waiting' | 'review';
 phase: 'focus' | 'shortBreak' | 'longBreak'; config: TimerConfig; completedSets: number;
 studyMs: number; phaseMs: number; runningSince: number | null; endedAt: number | null;
 review?: RecordInput;
};
export const maxStudyMs = 86400000;
export function validTimerConfig(c: TimerConfig) {
 return c && Number.isInteger(c.focus) && c.focus >= 1 && c.focus <= 180 && Number.isInteger(c.shortBreak) && c.shortBreak >= 1 && c.shortBreak <= 60 && Number.isInteger(c.longBreak) && c.longBreak >= 1 && c.longBreak <= 120 && Number.isInteger(c.sets) && c.sets >= 1 && c.sets <= 12;
}
export function createTimer(mode: StudyTimer['mode'], id: string, date: string, subjectId: string, materialId: string, config: TimerConfig, now: number): StudyTimer {
 if (!validTimerConfig(config)) throw Error('学習は1〜180分、短休憩は1〜60分、長休憩は1〜120分、セット数は1〜12で指定してください。');
 return {version: 1, id, mode, date, subjectId, materialId, config: {...config}, startedAt: now, status: 'running', phase: 'focus', completedSets: 0, studyMs: 0, phaseMs: 0, runningSince: now, endedAt: null};
}
export function phaseLimit(t: StudyTimer) {return t.config[t.phase] * 60000;}
export function timerElapsed(t: StudyTimer, now: number) {
 const delta = t.status === 'running' && t.runningSince !== null ? Math.max(0, now - t.runningSince) : 0;
 const elapsed = t.mode === 'pomodoro' ? Math.min(delta, Math.max(0, phaseLimit(t) - t.phaseMs)) : delta;
 const study = Math.min(maxStudyMs, t.studyMs + (t.phase === 'focus' ? elapsed : 0));
 return {studyMs: study, phaseMs: t.phaseMs + elapsed, remainingMs: Math.max(0, phaseLimit(t) - t.phaseMs - elapsed)};
}
// A suspended browser catches up only to this interval's deadline, never starts
// unattended future intervals. Wall-clock timestamps, not tick counts, measure time.
export function settleTimer(t: StudyTimer, now: number): StudyTimer {
 if (t.status !== 'running') return t;
 const e = timerElapsed(t, now);
 if (e.studyMs >= maxStudyMs) return {...t,studyMs:maxStudyMs,phaseMs:e.phaseMs,status:'review',runningSince:null,endedAt:t.runningSince! + Math.max(0,maxStudyMs-t.studyMs)};
 if (t.mode === 'pomodoro' && e.remainingMs === 0) {
  const focus = t.phase === 'focus', sets = t.completedSets + (focus ? 1 : 0);
  return {...t,studyMs:e.studyMs,phaseMs:0,status:'waiting',runningSince:null,completedSets:sets,phase:focus?(sets % t.config.sets === 0?'longBreak':'shortBreak'):'focus'};
 }
 return t;
}
export function pauseTimer(t: StudyTimer, now: number): StudyTimer {
 const settled = settleTimer(t,now);
 if (settled.status !== 'running') return settled;
 const e=timerElapsed(settled,now);
 return {...settled,studyMs:e.studyMs,phaseMs:e.phaseMs,status:'paused',runningSince:null};
}
export function resumeTimer(t: StudyTimer, now: number): StudyTimer {
 if (!['paused','waiting'].includes(t.status)) return t;
 return {...t,status:'running',runningSince:now};
}
export function finishTimer(t: StudyTimer, now: number): StudyTimer {
 if (t.status === 'review') return t;
 const settled=settleTimer(t,now),e=timerElapsed(settled,now);
 return {...settled,studyMs:e.studyMs,phaseMs:e.phaseMs,status:'review',runningSince:null,endedAt:now};
}
export function timerMinutes(ms: number) {return Math.round(ms / 60000);}
export function clockText(ms: number) {
 const seconds=Math.floor(Math.max(0,ms)/1000);
 return `${Math.floor(seconds/3600)?String(Math.floor(seconds/3600)).padStart(2,'0')+':':''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
export function timerReview(t: StudyTimer, timezone: string): RecordInput {
 const minutes=timerMinutes(t.studyMs);
 const time=(n:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(n));
 return {date:t.date,subject_id:t.subjectId,material_id:t.materialId,hours:String(Math.floor(minutes/60)),minutes:String(minutes%60),content:'',comment:'',start_time:time(t.startedAt),end_time:time(t.endedAt??t.startedAt)};
}
export function validateTimer(t: unknown): t is StudyTimer {
 if (!t || typeof t !== 'object') return false;
 const x=t as StudyTimer;
 return x.version===1 && typeof x.id==='string' && !!x.id && ['stopwatch','pomodoro'].includes(x.mode) && typeof x.subjectId==='string' && typeof x.materialId==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && validTimerConfig(x.config) && ['running','paused','waiting','review'].includes(x.status) && ['focus','shortBreak','longBreak'].includes(x.phase) && Number.isFinite(x.startedAt) && x.startedAt>=0 && Number.isFinite(x.studyMs) && x.studyMs>=0 && x.studyMs<=maxStudyMs && Number.isFinite(x.phaseMs) && x.phaseMs>=0 && Number.isSafeInteger(x.completedSets) && x.completedSets>=0 && (x.runningSince===null || (Number.isFinite(x.runningSince)&&x.runningSince>=0)) && (x.endedAt===null || (Number.isFinite(x.endedAt)&&x.endedAt>=0)) && (x.status==='running'?x.runningSince!==null:x.runningSince===null) && (!x.review || ['date','material_id','subject_id','hours','minutes','content','comment','start_time','end_time'].every(k=>typeof (x.review as unknown as Record<string,unknown>)[k]==='string'));
}
