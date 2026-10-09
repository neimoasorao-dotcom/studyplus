import {database} from '@/lib/storage';
import {clearLearningData} from '@/lib/data-management';

export async function DELETE(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'不正な送信元です'},{status:403});
 try{
  const {revision,confirmation}=await req.json() as any;
  if(!Number.isInteger(revision)||revision<0||confirmation!=='削除')return Response.json({error:'確認欄に「削除」と入力してください。'},{status:400});
  const db=database();
  await db.prepare('INSERT OR IGNORE INTO dashboard_state (id, revision) VALUES (?, ?)').bind('main',0).run();
  const {results:rows}=await db.prepare('SELECT s.revision, c.body FROM dashboard_state s LEFT JOIN dashboard_chunks c ON c.revision = s.revision WHERE s.id = ? ORDER BY c.part').bind('main').all<{revision:number;body:string|null}>();
  const conflict=()=>Response.json({error:'他の端末で更新されています。再読み込みして削除対象を確認してください。'},{status:409});
  if(rows[0].revision!==revision)return conflict();
  const data=clearLearningData(revision===0?undefined:JSON.parse(rows.map(p=>p.body||'').join('')));
  const body=JSON.stringify(data),next=revision+1,ops=[];
  for(let i=0;i<body.length;i+=100000)ops.push(db.prepare('INSERT INTO dashboard_chunks (revision, part, body) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM dashboard_state WHERE id = ? AND revision = ?)').bind(next,i/100000,body.slice(i,i+100000),'main',revision));
  // Purge prior copies and switch the active revision in the same transaction.
  ops.push(db.prepare('DELETE FROM dashboard_chunks WHERE revision <= ? AND EXISTS (SELECT 1 FROM dashboard_state WHERE id = ? AND revision = ?)').bind(revision,'main',revision));
  ops.push(db.prepare('UPDATE dashboard_state SET revision = ? WHERE id = ? AND revision = ?').bind(next,'main',revision));
  const result=await db.batch(ops);
  if(!result[result.length-1].meta.changes)return conflict();
  return Response.json({revision:next,data});
 }catch(e){console.error(e);return Response.json({error:'削除できませんでした。再試行してください。'},{status:503});}
}
export async function GET(){try{const db=database();const result=await db.prepare('SELECT s.revision, c.body FROM dashboard_state s LEFT JOIN dashboard_chunks c ON c.revision = s.revision WHERE s.id = ? ORDER BY c.part').bind('main').all<{revision:number;body:string|null}>();const rows=result.results;if(!rows.length||rows[0].revision===0)return Response.json({revision:0,data:null},{headers:{'Cache-Control':'no-store'}});return Response.json({revision:rows[0].revision,data:JSON.parse(rows.map(p=>p.body||'').join(''))},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'保存データを読み込めません。再読み込みしてください。'},{status:503});}}
export async function PUT(req:Request){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'不正な送信元です'},{status:403});try{const {data,revision}=await req.json() as any;if(!data||!Array.isArray(data.study_records)||!Array.isArray(data.subjects)||!Number.isInteger(revision)||revision<0)return Response.json({error:'データ形式が不正です'},{status:400});const body=JSON.stringify(data);if(body.length>8000000)return Response.json({error:'データが大きすぎます（800万文字まで）。未保存のデータをJSON出力して保管してください。'},{status:413});const db=database();await db.prepare('INSERT OR IGNORE INTO dashboard_state (id, revision) VALUES (?, ?)').bind('main',0).run();const next=revision+1,ops=[];for(let i=0;i<body.length;i+=100000)ops.push(db.prepare('INSERT INTO dashboard_chunks (revision, part, body) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM dashboard_state WHERE id = ? AND revision = ?)').bind(next,i/100000,body.slice(i,i+100000),'main',revision));ops.push(db.prepare('UPDATE dashboard_state SET revision = ? WHERE id = ? AND revision = ?').bind(next,'main',revision));const result=await db.batch(ops);if(!result[result.length-1].meta.changes)return Response.json({error:'他の端末で更新されています。未保存JSONを出力してから再読み込みし、再度取り込んでください。'},{status:409});try{await db.prepare('DELETE FROM dashboard_chunks WHERE revision < ?').bind(next-1).run();}catch(e){console.error('old revision cleanup',e);}return Response.json({revision:next});}catch(e){console.error(e);return Response.json({error:'保存できませんでした。入力内容を残しています。再試行してください。'},{status:503});}}
