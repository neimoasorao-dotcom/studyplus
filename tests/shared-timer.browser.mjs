// Isolated storage and synthetic records; every GitHub request is intercepted.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import * as A from '../lib/analysis.ts';
const {chromium}=await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:5176/studyplus/',file=process.env.STUDYPLUS_SHARED_TIMER_OFFLINE_FILE;
const pcBase=file?'http://127.0.0.1:5192/studyplus_offline.html':base;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const contexts=await Promise.all([390,1280].map(width=>browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Tokyo'})));
const key='github_pat_'+'t'.repeat(50),files=new Map(),offline=new WeakSet(),errors=[];
let timerWrites=0,failAck=false;
for(const context of contexts){
 await context.addInitScript(()=>{const original=Date.now.bind(Date);globalThis.timerTestOffset=0;Date.now=()=>original()+globalThis.timerTestOffset;});
 await context.route('https://api.github.com/**',async route=>{
  if(offline.has(context))return route.abort('internetdisconnected');
  const req=route.request(),pathname=new URL(req.url()).pathname;
  assert.equal(req.headers().authorization,'Bearer '+key);
  const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(pathname==='/repos/test/private-data')return reply({private:true,default_branch:'main'});
  const name=pathname.split('/').at(-1);assert(['studyplus-sync.json','studyplus-timer.json'].includes(name));
  const previous=files.get(name);
  if(req.method()==='PUT'){
   const body=req.postDataJSON();if((previous&&previous.sha!==body.sha)||(!previous&&body.sha))return reply({},409);
   const data=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));
   files.set(name,{sha:String(data.revision).padStart(40,'0'),data});
   if(name==='studyplus-timer.json'){timerWrites++;assert(!JSON.stringify(data).includes(key));if(failAck){failAck=false;return reply({},500);}}
   return reply({content:{sha:files.get(name).sha}},201);
  }
  if(!previous)return reply({},404);
  const raw=JSON.stringify(previous.data);return reply({type:'file',sha:previous.sha,size:Buffer.byteLength(raw),encoding:'base64',content:Buffer.from(raw).toString('base64')});
 });
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
}
if(file){const html=await readFile(file);await contexts[1].route(pcBase,r=>r.fulfill({contentType:'text/html',body:html}));await contexts[1].addInitScript(()=>{if(navigator.locks)navigator.locks.request=()=>Promise.reject(new DOMException('opaque origin','SecurityError'));});}
const [phone,pc]=await Promise.all(contexts.map(c=>c.newPage()));
function remote(){return files.get('studyplus-timer.json')?.data;}
async function wait(check){for(let i=0;i<150;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Shared timer check timed out');}
async function stored(p,name='studyplus-timer-v1',store='timer'){return p.evaluate(({name,store})=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction(store),r=tx.objectStore(store).get('main');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();};}),{name,store});}
async function wake(p){await p.evaluate(()=>window.dispatchEvent(new Event('focus')));}
async function openTimer(p){if(await p.getByRole('dialog').count()===0)await p.locator('.timer-banner').click();await p.locator('.timer-sharing').waitFor();}
async function checkTimer(p){await openTimer(p);await p.getByRole('button',{name:'共有計測を再確認',exact:true}).click();}
async function pair(p){
 if(p===phone)await p.getByRole('button',{name:'データ・設定メニュー'}).click();else await p.locator('.sync-status').click();
 await p.getByLabel('保存先リポジトリ').fill('test/private-data');await p.getByLabel('GitHubトークン',{exact:true}).fill(key);await p.getByRole('button',{name:'接続して同期を開始'}).click();await p.getByText(/^同期済み：/).waitFor();await p.keyboard.press('Escape');await wake(p);await wait(async()=>!!(await stored(p))?.sharing);
}
async function start(p,mode='ストップウォッチ'){
 await p.getByRole('button',{name:'記録を追加',exact:true}).click();await p.getByRole('button',{name:mode,exact:true}).click();await p.getByLabel('計測する科目').selectOption('math');await p.getByLabel('計測する教材').selectOption('book');
 if(mode==='ポモドーロ')await p.getByLabel('学習（分）',{exact:true}).fill('1');
 await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(()=>remote()?.timer?.mode===(mode==='ストップウォッチ'?'stopwatch':'pomodoro'));
}
try{
 for(const [p,url] of [[phone,base],[pc,pcBase]]){await p.goto(url);await p.getByRole('heading',{name:'今日の進捗',exact:true}).waitFor();}
 const d=A.emptyData();d.subjects=[{id:'math',name:'長い科目名の数学・共有計測テスト',color:'#b33c88'}];d.materials=[{id:'book',subject_id:'math',name:'長い教材名・共有計測テスト教材'}];
 await phone.locator('input[type=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await phone.getByRole('button',{name:'この内容で追加する',exact:true}).click();await phone.getByRole('dialog').waitFor({state:'hidden'});
 await pair(phone);await pair(pc);
 await start(phone);const id=remote().timer.id,phoneOwner=remote().ownerId;
 await phone.evaluate(()=>{timerTestOffset=65000;});await pc.evaluate(()=>{timerTestOffset=65000;});
 await wake(pc);await wait(async()=>(await stored(pc)).timer?.id===id);await openTimer(pc);
 assert(await pc.getByRole('button',{name:'一時停止',exact:true}).isDisabled());assert.equal((await stored(pc)).timer.materialId,'book');assert.equal((await stored(pc)).timer.subjectId,'math');
 await mkdir('/workspace/studyplus-artifacts/shared-timer',{recursive:true});
 await phone.screenshot({path:`/workspace/studyplus-artifacts/shared-timer/${file?'offline':'pages'}-phone.png`});await pc.screenshot({path:`/workspace/studyplus-artifacts/shared-timer/${file?'offline':'pages'}-pc.png`});
 if(process.env.STUDYPLUS_SHARED_TIMER_PIP==='1'){
  await pc.locator('[data-slot=dialog-close]').click();await pc.getByRole('button',{name:'計測を小窓で表示',exact:true}).click();
  await wait(()=>pc.evaluate(()=>!!window.documentPictureInPicture?.window?.document.querySelector('.timer-banner-time')));
  await pc.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}));
  await phone.getByRole('button',{name:'一時停止',exact:true}).click();await wait(()=>remote().timer.status==='paused');await wake(pc);
  await wait(()=>pc.evaluate(()=>window.documentPictureInPicture.window.document.querySelector('.timer-banner')?.dataset.status==='paused'));
  await phone.getByRole('button',{name:'計測を再開',exact:true}).click();await wait(()=>remote().timer.status==='running');await wake(pc);
  await wait(()=>pc.evaluate(()=>window.documentPictureInPicture.window.document.querySelector('.timer-banner')?.dataset.status==='running'));
  assert.equal(await pc.evaluate(()=>window.documentPictureInPicture.window.document.querySelectorAll('button').length),0);
  await pc.evaluate(()=>{delete document.visibilityState;});await openTimer(pc);
 }
 const unchanged=timerWrites;await new Promise(r=>setTimeout(r,1100));assert.equal(timerWrites,unchanged,'Ticks never send writes');
 await pc.getByRole('button',{name:'この端末で操作する'}).click();await wait(()=>remote().ownerId!==phoneOwner);const pcOwner=remote().ownerId;
 await checkTimer(phone);await wait(async()=>!(await stored(phone)).sharing.pending&&(await stored(phone)).sharing.base.ownerId===pcOwner);assert(await phone.getByRole('button',{name:'一時停止',exact:true}).isDisabled());
 await pc.getByRole('button',{name:'一時停止',exact:true}).click();await wait(()=>remote().timer.status==='paused');await checkTimer(phone);await wait(async()=>(await stored(phone)).timer.status==='paused');assert.equal((await stored(pc)).timer.studyMs,(await stored(phone)).timer.studyMs);
 await pc.getByRole('button',{name:'計測を再開',exact:true}).click();await wait(()=>remote().timer.status==='running');await checkTimer(phone);
 // Offline old owner changes must survive a handoff and never overwrite it.
 offline.add(contexts[1]);await contexts[1].setOffline(true);await pc.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await stored(pc)).sharing.pending?.timer?.status==='paused');
 await phone.getByRole('button',{name:'この端末で操作する'}).click();await wait(()=>remote().ownerId===phoneOwner);const handoff=JSON.stringify(remote());
 offline.delete(contexts[1]);await contexts[1].setOffline(false);await checkTimer(pc);await wait(async()=>!!(await stored(pc)).sharing.issue);assert.equal(JSON.stringify(remote()),handoff);assert.equal((await stored(pc)).sharing.pending.timer.status,'paused');
 const downloadPromise=pc.waitForEvent('download');await pc.getByRole('button',{name:'未送信・保管した計測をJSON出力'}).click();const backup=JSON.parse(await readFile(await (await downloadPromise).path(),'utf8'));assert.equal(backup.pending.timer.status,'paused');assert(!JSON.stringify(backup).includes(key));
 await pc.getByRole('button',{name:'端末内の計測を保管して共有状態を表示'}).click();await wait(async()=>!(await stored(pc)).sharing.issue);assert.equal((await stored(pc)).sharing.archives.at(-1).pending.timer.status,'paused');assert(await pc.getByRole('button',{name:'一時停止',exact:true}).isDisabled());
 await phone.getByRole('button',{name:'終了して保存へ'}).click();await phone.locator('.manual-form').waitFor();await phone.getByLabel('学習時間の時間',{exact:true}).fill('0');await phone.getByLabel('学習時間の分',{exact:true}).fill('1');await phone.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await wait(()=>remote().terminal==='saved');
 const records=files.get('studyplus-sync.json').data.data.study_records;assert.equal(records.filter(r=>r.id===id).length,1);assert.equal(records.find(r=>r.id===id).duration_minutes,1);
 await checkTimer(pc);await wait(async()=>(await stored(pc)).timer===null);assert.equal(remote().sessionId,id);
 await pc.keyboard.press('Escape');await phone.keyboard.press('Escape');
 // Recover a write whose acknowledgement was lost without duplicating it.
 failAck=true;await start(phone,'ポモドーロ');const pomId=remote().timer.id;await wait(async()=>!!(await stored(phone)).sharing.pending);const lostAckWrites=timerWrites;await checkTimer(phone);await wait(async()=>!(await stored(phone)).sharing.pending);assert.equal(timerWrites,lostAckWrites);
 await wake(pc);await wait(async()=>(await stored(pc)).timer?.id===pomId);await openTimer(pc);assert(await pc.locator('.pomodoro-indicator').isVisible());
 // The viewer can derive interval completion before the owner publishes it.
 const beforeDeadline=timerWrites;await pc.evaluate(()=>{timerTestOffset+=61000;});await pc.getByRole('button',{name:'短休憩を開始',exact:true}).waitFor();assert.equal(timerWrites,beforeDeadline);assert.equal(remote().timer.status,'running');
 await phone.evaluate(()=>{timerTestOffset+=61000;});await wait(()=>remote().timer.status==='waiting');assert.equal(remote().timer.completedSets,1);assert.equal(remote().timer.phase,'shortBreak');assert.equal(remote().timer.studyMs,60000);
 await checkTimer(pc);await wait(async()=>(await stored(pc)).timer.status==='waiting');assert(await pc.getByRole('button',{name:'短休憩を開始',exact:true}).isDisabled());
 await phone.getByRole('button',{name:'短休憩を開始',exact:true}).click();await wait(()=>remote().timer.status==='running');assert.equal(remote().timer.studyMs,60000);
 await phone.getByRole('button',{name:'この計測を破棄',exact:true}).click();await phone.getByRole('button',{name:'計測を破棄する',exact:true}).click();await wait(()=>remote().terminal==='discarded');await checkTimer(pc);await wait(async()=>(await stored(pc)).timer===null);
 // Simultaneous starts can publish at most one active session.
 for(const p of [phone,pc]){await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();await p.getByLabel('計測する科目').selectOption('math');await p.getByLabel('計測する教材').selectOption('book');}
 const beforeRace=timerWrites;await Promise.all([phone,pc].map(p=>p.getByRole('button',{name:'計測を開始',exact:true}).click()));await wait(()=>!!remote().timer&&remote().timer.mode==='stopwatch');
 await Promise.all([phone,pc].map(checkTimer));
 await wait(async()=>{const states=await Promise.all([phone,pc].map(p=>stored(p)));return states.every(s=>s.timer?.id===remote().timer.id||s.sharing.issue);});
 assert.equal(timerWrites,beforeRace+1,'Concurrent start publishes exactly one active timer');
 // The added sharing controls fit all required viewport widths.
 for(const width of [360,390,430,1280,1440]){await pc.setViewportSize({width,height:900});assert(await pc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: page overflow`);assert(await pc.locator('.recorder-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${width}: dialog overflow`);}
 assert.deepEqual(errors,[]);await mkdir('/workspace/studyplus-artifacts/shared-timer',{recursive:true});await pc.screenshot({path:'/workspace/studyplus-artifacts/shared-timer/controls.png',fullPage:true});
 console.log('PASS shared timer '+(file?'Pages + standalone HTML':'two Pages clients')+': live timestamp display, exclusive handoff, mirrored pause/resume, offline conflict preserved/exported, terminal never resurrected, one saved record, lost ACK, Pomodoro focus/rest/waiting and five widths');
}finally{await browser.close();}
