import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import * as A from '../lib/analysis.ts';
const {chromium}=await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE||'playwright');
const file=process.env.STUDYPLUS_TIMER_OFFLINE_FILE;
const base=file?'http://127.0.0.1:5182/studyplus_offline.html':'http://127.0.0.1:5176/studyplus/';
let server;if(file){const html=await readFile(file);server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});await new Promise(resolve=>server.listen(5182,'127.0.0.1',resolve));}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
await context.addInitScript(()=>{
 Date.now=()=>Date.parse('2026-10-11T10:00:00Z')+Number(localStorage.getItem('timer-test-offset')||0);
 const put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(value,...rest){if(window.failTimerWrite&&this.transaction.db.name==='studyplus-timer-v1')throw new DOMException('Timer quota test','QuotaExceededError');if(window.failTimerClear&&this.transaction.db.name==='studyplus-timer-v1'&&value.timer===null)throw new DOMException('Timer cleanup quota test','QuotaExceededError');return put.call(this,value,...rest);};
});
if(file){const html=await readFile(file);await context.route(base,route=>route.fulfill({status:200,contentType:'text/html',body:html}));await context.setOffline(true);}
const errors=[],requests=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')requests.push(r.url());});});
async function state(p,dbName='studyplus-dashboard:/studyplus/',storeName='state'){return p.evaluate(({dbName,storeName})=>new Promise((resolve,reject)=>{const r=indexedDB.open(dbName);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(storeName),q=tx.objectStore(storeName).get('main');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};}),{dbName,storeName});}
const timer=p=>state(p,'studyplus-timer-v1','timer');
async function wait(check){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timer wait timed out');}
async function advance(p,ms){await p.evaluate(ms=>localStorage.setItem('timer-test-offset',String(Number(localStorage.getItem('timer-test-offset')||0)+ms)),ms);await new Promise(r=>setTimeout(r,350));}
async function open(p){await p.getByRole('button',{name:'この教材で記録する',exact:true}).click();await p.getByRole('group',{name:'記録方法'}).waitFor();}
async function close(p){await p.getByRole('button',{name:'画面を閉じる（計測・下書きを保持）',exact:true}).click();}
async function discard(p){await p.getByRole('button',{name:'この計測を破棄',exact:true}).click();await p.getByRole('button',{name:'計測を破棄する',exact:true}).click();await wait(async()=>!(await timer(p)).timer);await p.keyboard.press('Escape');}
try{
 const p=await context.newPage();await p.goto(base+'#materials');await p.locator('.context').waitFor();
 const d=A.emptyData();d.subjects=[{id:'math',name:'数学',ideal_ratio:1,color:'#b33c88'}];d.materials=[{id:'book',name:'数学の非常に長い教材名'.repeat(4),subject_id:'math'}];
 await p.locator('input[type=file]').setInputFiles({name:'timer-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 await open(p);await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();assert.equal(await p.getByLabel('計測する教材').inputValue(),'book');assert.equal(await p.getByLabel('計測する科目').inputValue(),'math');
 // Denied draft writes must never start an unpersisted timer.
 await p.evaluate(()=>{window.failTimerWrite=true;});await p.getByRole('button',{name:'計測を開始',exact:true}).click();await p.locator('.timer-panel [role=alert]').waitFor();assert.equal((await timer(p)),undefined);
 await p.evaluate(()=>{window.failTimerWrite=false;});await p.getByRole('button',{name:'最新の計測を再読込',exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p))?.timer?.status==='running');
 await advance(p,65000);await p.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='paused');assert.equal((await timer(p)).timer.studyMs,65000);
 await advance(p,300000);assert.equal((await timer(p)).timer.studyMs,65000);
 await p.getByRole('button',{name:'計測を再開',exact:true}).click();await advance(p,30000);await close(p);await p.locator('.timer-banner').waitFor();await p.reload();await p.locator('.timer-banner').waitFor();await p.locator('.timer-banner').click();await p.getByRole('button',{name:'終了して保存へ',exact:true}).click();await p.locator('.manual-form').waitFor();assert.equal(await p.getByLabel('学習時間の分',{exact:true}).inputValue(),'2');
 const id=(await timer(p)).timer.id;
 // If learning save succeeds but draft cleanup fails, refresh/retry must not
 // create a second record with the same fixed session ID.
 await p.evaluate(()=>{window.failTimerClear=true;});await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.locator('.manual-form [role=alert]').waitFor();assert.equal((await state(p)).data.study_records.length,1);
 await p.evaluate(()=>{window.failTimerClear=false;});await p.reload();await p.locator('.timer-banner').click();await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await state(p)).data.study_records.length,1);assert.equal((await state(p)).data.study_records[0].source_id,id);assert.equal((await timer(p)).timer,null);
 await open(p);await p.getByRole('button',{name:'ポモドロ',exact:true}).click();
 await p.getByLabel('学習（分）',{exact:true}).fill('1');await p.getByLabel('短休憩（分）',{exact:true}).fill('1');await p.getByLabel('長休憩（分）',{exact:true}).fill('2');await p.getByLabel('長休憩までのセット数',{exact:true}).fill('2');await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='running');
 await advance(p,10*60000);await wait(async()=>(await timer(p)).timer.status==='waiting');let t=(await timer(p)).timer;assert.equal(t.completedSets,1);assert.equal(t.studyMs,60000);assert.equal(t.phase,'shortBreak');
 await p.getByRole('button',{name:'短休憩を開始',exact:true}).click();await advance(p,10*60000);await wait(async()=>(await timer(p)).timer.status==='waiting');assert.equal((await timer(p)).timer.studyMs,60000);assert.equal((await timer(p)).timer.phase,'focus');
 await p.getByRole('button',{name:'学習を開始',exact:true}).click();await advance(p,60000);await wait(async()=>(await timer(p)).timer.status==='waiting');assert.equal((await timer(p)).timer.phase,'longBreak');assert.equal((await timer(p)).timer.completedSets,2);assert.equal((await timer(p)).timer.studyMs,120000);
 await close(p);const other=await context.newPage();await other.goto(base+'#materials');await other.locator('.timer-banner').waitFor();await other.locator('.timer-banner').click();await other.getByRole('button',{name:'長休憩を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='running');await p.locator('.timer-banner').click();await p.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='paused');await close(p);await other.reload();await other.locator('.timer-banner').click();await other.getByRole('button',{name:'計測を再開',exact:true}).waitFor();await other.close();
 await p.locator('.timer-banner').click();await p.getByRole('button',{name:'終了して保存へ',exact:true}).click();await p.locator('.manual-form').waitFor();assert.equal(await p.getByLabel('学習時間の分',{exact:true}).inputValue(),'2');
 for(const width of [360,390,430,1280,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await p.getByRole('dialog').boundingBox();assert(box.x>=-1&&box.x+box.width<=width+1,`${width}:dialog bounds`);await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).scrollIntoViewIfNeeded();assert(await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).isVisible());}
 await mkdir('/workspace/studyplus-artifacts/timers',{recursive:true});await p.setViewportSize({width:390,height:900});await p.screenshot({path:'/workspace/studyplus-artifacts/timers/review-390.png'});
 // Distinct sessions with identical minutes require explicit duplicate confirmation.
 await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByLabel('別の記録として追加する').check();await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await state(p)).data.study_records.length,2);assert.equal((await state(p)).data.study_records[1].timer.completed_sets,2);
 await open(p);await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer);await discard(p);assert.equal((await state(p)).data.study_records.length,2);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS timers '+(file?'standalone HTML':'Pages')+': material/subject inheritance, denied storage, pause/resume/reload, fixed-ID cleanup recovery, Pomodoro focus/rest/long break, cross-tab state, five widths, confirmation/save/discard; no external requests');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
