import {clockText, phaseLimit, type StudyTimer} from '../lib/study-timer';

const phaseNames = {focus: '学習', shortBreak: '短休憩', longBreak: '長休憩'};

function arc(start: number, end: number) {
 const point = (angle: number) => {
  const radians = (angle - 90) * Math.PI / 180;
  return [120 + 100 * Math.cos(radians), 120 + 100 * Math.sin(radians)];
 };
 const [x1, y1] = point(start), [x2, y2] = point(end);
 return `M ${x1} ${y1} A 100 100 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export function PomodoroIndicator({timer, remainingMs}: {timer: StudyTimer; remainingMs: number}) {
 const restPhase = timer.phase === 'focus'
  ? ((timer.completedSets + 1) % timer.config.sets === 0 ? 'longBreak' : 'shortBreak')
  : timer.phase;
 const restMinutes = timer.config[restPhase];
 // Keep very short intervals visible even with rounded ends and segment gaps.
 const split = Math.min(336, Math.max(24, 360 * timer.config.focus / (timer.config.focus + restMinutes)));
 const remaining = Math.max(0, Math.min(1, remainingMs / phaseLimit(timer)));
 const segments = [
  {name: '学習', minutes: timer.config.focus, className: 'focus', start: 3, end: split - 3, active: timer.phase === 'focus', fraction: timer.phase === 'focus' ? remaining : 0},
  {name: phaseNames[restPhase], minutes: restMinutes, className: 'break', start: split + 3, end: 357, active: timer.phase !== 'focus', fraction: timer.phase === 'focus' ? 1 : remaining},
 ];
 return <div className="pomodoro-indicator" role="group" aria-label="ポモドーロの進行状況">
  <div className="pomodoro-dial">
   <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
    {segments.map(segment => <g key={segment.className} className={`pomodoro-segment ${segment.className}`}>
     <path className="pomodoro-track" d={arc(segment.start, segment.end)}/>
     {segment.fraction > 0 && <path className="pomodoro-remaining" d={arc(segment.end - (segment.end - segment.start) * segment.fraction, segment.end)}/>}
    </g>)}
   </svg>
   <div className="pomodoro-readout">
    <span className={`pomodoro-current ${timer.phase === 'focus' ? 'focus' : 'break'}`}>{phaseNames[timer.phase]}</span>
    <output className="timer-clock" aria-live="off" aria-label="区間の残り時間">{clockText(remainingMs)}</output>
    <span className="muted">残り時間</span>
   </div>
  </div>
  <div className="pomodoro-legend">{segments.map(segment => <span key={segment.className} className={segment.className} aria-current={segment.active ? 'step' : undefined}>
   <i aria-hidden="true"/>{segment.name} {segment.minutes}分{segment.active && <small>現在</small>}
  </span>)}</div>
 </div>;
}
