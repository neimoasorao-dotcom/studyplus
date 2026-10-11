import {addDays, byKey, days, firstDate, goal, records, total, weekday, week, type Data} from './analysis';

export function todayHome(d:Data,date:string){
 const rs=records(d,date,date),minutes=total(rs),w=week(d,date),direct=d.goals.site.daily_targets?.[date],pattern=d.goals.site.daily_pattern?.[weekday(date)];
 const before=total(records(d,w.start,addDays(date,-1))),weekly=goal(d);
 const target=typeof direct==='number'&&Number.isInteger(direct)&&direct>0&&direct<=1440?direct:typeof pattern==='number'&&Number.isFinite(pattern)&&pattern>=0&&pattern<=1440?pattern:weekly===null?null:Math.max(0,weekly-before)/w.remaining;
 const source=target===null?'目標未設定':typeof direct==='number'&&Number.isInteger(direct)&&direct>0&&direct<=1440?'今日の目標':typeof pattern==='number'&&Number.isFinite(pattern)&&pattern>=0&&pattern<=1440?'曜日別の目安':'週目標からの目安';
 const first=firstDate(d),a=addDays(date,-7),b=addDays(date,-1),baseline=first&&first<=b?days(d,first>a?first:a,b):[];
 const count=baseline.length,average=count?total(baseline.map(x=>({duration_minutes:x.minutes})))/count:null;
 const subjectMinutes=byKey(rs,'subject_id'),weeklyRs=records(d,w.start,date),weeklyMinutes=byKey(weeklyRs,'subject_id'),weekTotal=total(weeklyRs);
 const subjects=d.subjects.map(s=>({...s,minutes:subjectMinutes[s.id]||0,materials:Object.entries(byKey(rs.filter(r=>r.subject_id===s.id),'material_id')).map(([id,minutes])=>({id,name:d.materials.find(m=>m.id===id)?.name||'教材未設定',minutes})),last:records(d,first||date,date).filter(r=>r.subject_id===s.id).map(r=>r.date).sort().at(-1)||''}));
 const unknown=rs.filter(r=>!d.subjects.some(s=>s.id===r.subject_id));if(unknown.length)subjects.push({id:'unknown',name:'科目未設定',color:'#64748b',minutes:total(unknown),materials:[],last:''});
 const ratiosReady=Math.abs(d.subjects.reduce((n,s)=>n+(Number(s.ideal_ratio)||0),0)-1)<.00001;
 const candidates=subjects.filter(s=>s.id!=='unknown').map(s=>{const done=weeklyMinutes[s.id]||0,target=Number(s.weekly_target_minutes)||0;const deficit=target>0?Math.max(0,target-done)/target:ratiosReady&&weekTotal>0?Math.max(0,(s.ideal_ratio||0)-done/weekTotal):0;return {...s,deficit,remainingMinutes:target>0?Math.max(0,target-done):null,reason:target>0?`今週の科目目標まであと${Math.max(0,target-done)}分`:'今週の学習配分が理想比率より少なめ'};}).filter(s=>s.deficit>0).sort((a,b)=>b.deficit-a.deficit||a.last.localeCompare(b.last));
 return {rs,minutes,target,source,remaining:target===null?null:Math.max(0,target-minutes),achieved:target!==null&&minutes>=target,average,count,subjects,candidate:candidates[0]||null,trend:days(d,addDays(date,-6),date),week:w};
}
