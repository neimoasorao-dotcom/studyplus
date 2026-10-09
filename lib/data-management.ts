import {emptyData, type Data} from './analysis';

// Keep only configuration and independently entered exam results. Imported
// extensions may contain copies of records, so do not carry unknown root keys.
export function clearLearningData(data:Data=emptyData()):Data {
 const cleared=emptyData();
 for(const key of ['schema_version','profile','subjects','materials','exam_results','goals','settings','goal_history']) {
  if(Object.hasOwn(data,key))cleared[key]=structuredClone(data[key]);
 }
 cleared.updated_at=new Date().toISOString();
 return cleared;
}
