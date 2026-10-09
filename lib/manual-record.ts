import {type Data,validDate} from './analysis';

export type RecordInput={date:string;material_id:string;subject_id:string;hours:string;minutes:string;content:string;comment:string;start_time:string;end_time:string};
export function initialRecord(date:string,data:Data,materialId=''):RecordInput{
 const material=data.materials.find(m=>m.id===materialId);
 const subject=data.subjects.some(s=>s.id===material?.subject_id)?material.subject_id:'';
 return {date,material_id:material?.id||'',subject_id:subject,hours:'0',minutes:'30',content:'',comment:'',start_time:'',end_time:''};
}
export function buildManualRecord(input:RecordInput,data:Data,today:string,id:string){
 if(!validDate(input.date)||input.date>today)throw Error('日付は今日以前の有効な日付を指定してください。');
 if(!data.subjects.some(s=>s.id===input.subject_id))throw Error('科目を選択してください。');
 if(input.material_id&&!data.materials.some(m=>m.id===input.material_id))throw Error('教材を選び直してください。');
 if(!/^\d+$/.test(input.hours)||!/^\d+$/.test(input.minutes))throw Error('学習時間は時間・分ともに整数で入力してください。');
 const hours=Number(input.hours),minutes=Number(input.minutes),duration=hours*60+minutes;
 if(minutes>59||!Number.isSafeInteger(duration)||duration<1||duration>1440)throw Error('学習時間は1分〜24時間、分は0〜59で入力してください。');
 for(const time of [input.start_time,input.end_time])if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('時刻は00:00〜23:59で入力してください。');
 return {id,source:'manual',source_id:id,date:input.date,material_id:input.material_id||null,subject_id:input.subject_id,duration_minutes:duration,start_time:input.start_time||null,end_time:input.end_time||null,content:input.content.trim()||null,comment:input.comment.trim()||null};
}
export function manualDuplicateCount(data:Data,record:ReturnType<typeof buildManualRecord>){
 return data.study_records.filter(r=>r.date===record.date&&(r.material_id||null)===record.material_id&&r.subject_id===record.subject_id&&r.duration_minutes===record.duration_minutes).length;
}
export function nextRecord(input:RecordInput):RecordInput{return {...input,hours:'0',minutes:'',content:'',comment:'',start_time:'',end_time:''};}
