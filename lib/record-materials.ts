import {type Data,validRecord,total,today} from './analysis';
import {sortMaterialRows,validMaterialSort,type MaterialSort} from './material-sort';
export function recordMaterials(data:Data,date=today(data.profile.timezone),order=data.profile.record_material_sort){
 if(!validMaterialSort(order))return data.materials;
 return sortMaterialRows(data.materials.map(m=>{const rs=data.study_records.filter(r=>validRecord(r)&&r.material_id===m.id&&r.date<=date);return {material:m,name:m.name,minutes:total(rs),last:rs.map(r=>r.date).sort().at(-1)};}),order as MaterialSort).map(r=>r.material);
}
