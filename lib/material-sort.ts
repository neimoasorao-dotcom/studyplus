export const materialSortOptions=[['time_desc','学習時間が長い順'],['time_asc','学習時間が短い順'],['name','教材名順'],['recent','最近勉強した順']] as const;
export type MaterialSort=typeof materialSortOptions[number][0];
export const validMaterialSort=(value:any):value is MaterialSort=>materialSortOptions.some(([key])=>key===value);
export function sortMaterialRows<T extends {name:string;minutes:number;last?:string}>(rows:T[],order:MaterialSort='time_desc'):T[]{
 return rows.map((row,index)=>({row,index})).sort((a,b)=>{
  let delta=0;
  if(order==='name')delta=a.row.name.localeCompare(b.row.name,'ja',{numeric:true});
  else if(order==='recent')delta=(b.row.last||'').localeCompare(a.row.last||'');
  else delta=order==='time_asc'?a.row.minutes-b.row.minutes:b.row.minutes-a.row.minutes;
  return delta||a.index-b.index;
 }).map(({row})=>row);
}
