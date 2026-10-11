import assert from 'node:assert/strict';
import {createTimer,defaultTimerConfig,finishTimer,pauseTimer,resumeTimer,settleTimer,timerElapsed,timerMinutes,clockText,validateTimer,timerReview,maxStudyMs} from '../lib/study-timer.ts';
const start=Date.parse('2026-10-11T14:59:00Z');
const stopwatch=createTimer('stopwatch','timer-a','2026-10-11','math','book',defaultTimerConfig,start);
assert(validateTimer(stopwatch));assert.equal(timerElapsed(stopwatch,start+65000).studyMs,65000);
const paused=pauseTimer(stopwatch,start+65000);assert.equal(timerElapsed(paused,start+300000).studyMs,65000);
const resumed=resumeTimer(paused,start+300000);assert.equal(timerElapsed(resumed,start+330000).studyMs,95000);
const finished=finishTimer(resumed,start+330000);assert.equal(finished.studyMs,95000);assert.equal(finished.date,'2026-10-11');assert.equal(finished.status,'review');
assert.deepEqual(timerReview(finished,'Asia/Tokyo'),{date:'2026-10-11',subject_id:'math',material_id:'book',hours:'0',minutes:'2',content:'',comment:'',start_time:'23:59',end_time:'00:04'});
assert.equal(timerMinutes(29999),0);assert.equal(timerMinutes(30000),1);assert.equal(clockText(3661000),'01:01:01');
assert.equal(timerElapsed(stopwatch,start-1).studyMs,0,'clock rollback must not subtract time');
const maxed=settleTimer(stopwatch,start+maxStudyMs*2);assert.equal(maxed.status,'review');assert.equal(maxed.studyMs,maxStudyMs);assert.equal(maxed.endedAt,start+maxStudyMs);
let pom=createTimer('pomodoro','timer-b','2026-10-11','math','book',defaultTimerConfig,start);
const delayed=settleTimer(pom,start+8*3600000);assert.equal(delayed.studyMs,25*60000);assert.equal(delayed.completedSets,1);assert.equal(delayed.phase,'shortBreak');assert.equal(delayed.status,'waiting');
assert.equal(timerElapsed(delayed,start+20*3600000).studyMs,25*60000,'no unattended intervals');
let time=start;
for(let set=1;set<=4;set++){
 pom=settleTimer(pom,time+25*60000);assert.equal(pom.completedSets,set);assert.equal(pom.phase,set===4?'longBreak':'shortBreak');
 time+=60*60000;pom=resumeTimer(pom,time);const limit=set===4?15:5;assert.equal(timerElapsed(pom,time+limit*60000).studyMs,set*25*60000,'exclude rest');
 pom=settleTimer(pom,time+limit*60000);assert.equal(pom.phase,'focus');assert.equal(pom.status,'waiting');
 time+=60*60000;pom=resumeTimer(pom,time);
}
assert.equal(pom.studyMs,100*60000);assert(validateTimer(pom));
const partial=finishTimer(createTimer('pomodoro','timer-c','2026-10-11','math','book',defaultTimerConfig,start),start+7*60000);assert.equal(partial.studyMs,7*60000);assert.equal(partial.completedSets,0);
const breakPaused=pauseTimer(resumeTimer(delayed,start+9*3600000),start+9*3600000+60000);assert.equal(breakPaused.studyMs,25*60000);assert.equal(breakPaused.phaseMs,60000);
for(const c of [{focus:0},{focus:181},{shortBreak:0},{longBreak:121},{sets:0},{sets:1.5}])assert.throws(()=>createTimer('pomodoro','bad','2026-10-11','math','book',{...defaultTimerConfig,...c},start));
for(const c of [{studyMs:-1},{studyMs:Infinity},{completedSets:-1},{runningSince:null},{mode:'wrong'},{config:{}}])assert(!validateTimer({...stopwatch,...c}));
console.log('PASS study timers: timestamp recovery, pause/resume, no unattended Pomodoro intervals, rests excluded, long-break cadence, partial sessions, rounding, midnight, 24h cap and validation');
