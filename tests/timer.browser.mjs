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
async function checkRecorderLayout(p) {
 for (const width of [360,390,430,1280,1440]) {
  await p.setViewportSize({width,height:900});
  await p.getByRole('dialog').evaluate(el=>{el.scrollTop=0;});
  const layout=await p.getByRole('dialog').evaluate(dialog=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return {dialog:rect(dialog),header:rect(dialog.querySelector('[data-slot=dialog-header]')),group:rect(dialog.querySelector('.recorder-methods')),close:rect(dialog.querySelector('[data-slot=dialog-close]')),buttons:[...dialog.querySelectorAll('.recorder-methods button')].map(el=>{const range=document.createRange();range.selectNodeContents(el);return {...rect(el),text:rect(range),font:parseFloat(getComputedStyle(el).fontSize)};})};
  });
  assert(layout.dialog.x>=-1&&layout.dialog.right<=width+1,`${width}: dialog fits`);
  assert(layout.group.y>=layout.header.bottom+4,`${width}: method selector is below heading`);
  assert(layout.close.bottom<=layout.group.y,`${width}: close does not overlap selector`);
  for(const button of layout.buttons){
   assert.equal(button.y,layout.buttons[0].y,`${width}: methods are in one row`);
   assert(button.height>=44,`${width}: tap target`);
   assert(button.text.x>=button.x&&button.text.right<=button.right,`${width}: label fits`);
   assert(button.text.height<button.font*2,`${width}: no multiline label`);
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: page fits`);
 }
 await p.setViewportSize({width:390,height:900});
}
async function checkClosedTimerPlacement(p) {
 const saved=(await timer(p)).timer;
 for(const width of [360,390,430,767,768,1280,1440]) {
  await p.setViewportSize({width,height:900});
  const selector=width>=768?'.sidebar-timer-slot .timer-banner':'main .timer-banner';
  await p.locator(selector).waitFor();assert.equal(await p.locator('.timer-banner').count(),1,'one timer entry only');
  const banner=await p.locator(selector).boundingBox();assert(banner.x>=0&&banner.x+banner.width<=width+1);
  if(width>=768){
   assert.equal(await p.locator('main .timer-banner').count(),0,'no desktop header duplicate');
   const settings=await p.locator('[data-slot=sidebar-footer]').getByRole('button',{name:'設定',exact:true}).boundingBox();
   assert(banner.y+banner.height<=settings.y&&settings.y-banner.y-banner.height<=12,'timer is immediately above Settings');
   await p.evaluate(()=>scrollTo(0,500));const scrolled=await p.locator(selector).boundingBox();assert.equal(scrolled.y,banner.y,'sidebar timer stays visible when content scrolls');
  }
  if(width<=767){
   const settings=await p.getByRole('button',{name:'データ・設定メニュー'}).boundingBox();
   assert(banner.y>=settings.y-1&&banner.y+banner.height<=settings.y+settings.height+1,'timer is in header row');
   assert(banner.x+banner.width<=settings.x,'timer is left of header actions');
   assert.match(await p.locator('.timer-banner-time').textContent(),/^\d+:\d{2}(?::\d{2})?$/,'only time is displayed');
   await p.emulateMedia({reducedMotion:'no-preference'});
   assert.equal(await p.locator('.timer-banner-time').evaluate(el=>getComputedStyle(el).animationName),saved.status==='paused'?'indicator-blink':'none');
   await p.emulateMedia({reducedMotion:'reduce'});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone header fits');
  }
  assert.equal((await timer(p)).timer.id,saved.id,'resizing never restarts the timer');
 }
 await p.setViewportSize({width:1280,height:600});await p.locator('.sidebar-timer-slot .timer-banner').waitFor();
 const small=await p.locator('.timer-banner').boundingBox();assert(small.y>=0&&small.y+small.height<=600,'short desktop screen fits');
 await mkdir('/workspace/studyplus-artifacts/timers',{recursive:true});await p.screenshot({path:'/workspace/studyplus-artifacts/timers/sidebar-timer-1280.png'});
 await p.locator('.timer-banner').focus();await p.keyboard.press('Enter');await p.getByRole('dialog').waitFor();
 assert.equal(await p.locator('.timer-banner').count(),0,'entry hides while recorder is open');assert.equal((await timer(p)).timer.id,saved.id,'reopens existing timer');
 assert.match(await p.locator('.timer-target').textContent(),/数学の非常に長い教材名/);
 await close(p);await p.getByRole('dialog').waitFor({state:'hidden'});await p.setViewportSize({width:390,height:900});await p.locator('main .timer-banner').waitFor();
}
async function remainingArc(p,phase){return p.locator(`.pomodoro-segment.${phase} .pomodoro-remaining`).evaluate(path=>path.getTotalLength());}
try{
 const p=await context.newPage();await p.goto(base+'#materials');await p.locator('.context').waitFor({state:'attached'});
 const d=A.emptyData();d.subjects=[{id:'math',name:'数学',ideal_ratio:1,color:'#b33c88'}];d.materials=[{id:'book',name:'数学の非常に長い教材名'.repeat(4),subject_id:'math'}];
 await p.locator('input[type=file]').setInputFiles({name:'timer-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 await open(p);await checkRecorderLayout(p);await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();assert.equal(await p.getByLabel('計測する教材').inputValue(),'book');assert.equal(await p.getByLabel('計測する科目').inputValue(),'math');
 // Denied draft writes must never start an unpersisted timer.
 await p.evaluate(()=>{window.failTimerWrite=true;});await p.getByRole('button',{name:'計測を開始',exact:true}).click();await p.locator('.timer-panel [role=alert]').waitFor();assert.equal((await timer(p)),undefined);
 await p.evaluate(()=>{window.failTimerWrite=false;});await p.getByRole('button',{name:'最新の計測を再読込',exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p))?.timer?.status==='running');
 await advance(p,65000);await p.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='paused');assert.equal((await timer(p)).timer.studyMs,65000);
 await advance(p,300000);assert.equal((await timer(p)).timer.studyMs,65000);
 await p.getByRole('button',{name:'計測を再開',exact:true}).click();await advance(p,30000);await close(p);await p.locator('.timer-banner').waitFor();await checkClosedTimerPlacement(p);await p.reload();await p.locator('.timer-banner').waitFor();await p.locator('.timer-banner').click();await p.getByRole('button',{name:'終了して保存へ',exact:true}).click();await p.locator('.manual-form').waitFor();assert.equal(await p.getByLabel('学習時間の分',{exact:true}).inputValue(),'2');
 const id=(await timer(p)).timer.id;
 // If learning save succeeds but draft cleanup fails, refresh/retry must not
 // create a second record with the same fixed session ID.
 await p.evaluate(()=>{window.failTimerClear=true;});await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.locator('.manual-form [role=alert]').waitFor();assert.equal((await state(p)).data.study_records.length,1);
 await p.evaluate(()=>{window.failTimerClear=false;});await p.reload();await p.locator('.timer-banner').click();await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await state(p)).data.study_records.length,1);assert.equal((await state(p)).data.study_records[0].source_id,id);assert.equal((await timer(p)).timer,null);
 await open(p);await p.getByRole('button',{name:'ポモドーロ',exact:true}).click();await checkRecorderLayout(p);
 await p.getByLabel('学習（分）',{exact:true}).fill('1');await p.getByLabel('短休憩（分）',{exact:true}).fill('1');await p.getByLabel('長休憩（分）',{exact:true}).fill('2');await p.getByLabel('長休憩までのセット数',{exact:true}).fill('2');await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='running');
 await p.getByRole('group',{name:'ポモドーロの進行状況',exact:true}).waitFor();
 await checkRecorderLayout(p);
 const colors=await p.locator('.pomodoro-remaining').evaluateAll(paths=>paths.map(path=>getComputedStyle(path).stroke));assert.equal(colors.length,2);assert.notEqual(colors[0],colors[1]);
 assert.equal(await p.locator('.pomodoro-current').textContent(),'学習');assert.match(await p.locator('.pomodoro-legend [aria-current=step]').textContent(),/学習 1分現在/);
 const fullFocus=await remainingArc(p,'focus');await advance(p,30000);assert(Math.abs(await remainingArc(p,'focus')/fullFocus-.5)<.01,'focus arc follows remaining time');
 await p.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='paused');const pausedArc=await remainingArc(p,'focus');await advance(p,120000);assert.equal(await remainingArc(p,'focus'),pausedArc,'paused arc stays fixed');
 await close(p);await p.reload();await p.locator('.timer-banner').click();assert.equal(await remainingArc(p,'focus'),pausedArc,'restored arc stays fixed');
 await p.getByRole('button',{name:'計測を再開',exact:true}).click();
 await advance(p,10*60000);await wait(async()=>(await timer(p)).timer.status==='waiting');assert.equal(await p.locator('.pomodoro-current').textContent(),'短休憩');assert.equal(await p.locator('.pomodoro-segment.focus .pomodoro-remaining').count(),0);let t=(await timer(p)).timer;assert.equal(t.completedSets,1);assert.equal(t.studyMs,60000);assert.equal(t.phase,'shortBreak');
 await p.getByRole('button',{name:'短休憩を開始',exact:true}).click();const fullRest=await remainingArc(p,'break');await advance(p,30000);assert(Math.abs(await remainingArc(p,'break')/fullRest-.5)<.01,'rest arc follows remaining time');await advance(p,10*60000);await wait(async()=>(await timer(p)).timer.status==='waiting');assert.equal((await timer(p)).timer.studyMs,60000);assert.equal((await timer(p)).timer.phase,'focus');
 await p.getByRole('button',{name:'学習を開始',exact:true}).click();await advance(p,60000);await wait(async()=>(await timer(p)).timer.status==='waiting');assert.equal((await timer(p)).timer.phase,'longBreak');assert.equal((await timer(p)).timer.completedSets,2);assert.equal(await p.locator('.pomodoro-current').textContent(),'長休憩');assert.match(await p.locator('.pomodoro-legend [aria-current=step]').textContent(),/長休憩 2分現在/);assert.equal(await p.getByLabel('区間の残り時間',{exact:true}).textContent(),'02:00');assert.equal((await timer(p)).timer.studyMs,120000);
 await close(p);const other=await context.newPage();await other.goto(base+'#materials');await other.locator('.timer-banner').waitFor();await other.locator('.timer-banner').click();await other.getByRole('button',{name:'長休憩を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='running');await p.locator('.timer-banner').click();await p.getByRole('button',{name:'一時停止',exact:true}).click();await wait(async()=>(await timer(p)).timer.status==='paused');await close(p);await other.reload();await other.locator('.timer-banner').click();await other.getByRole('button',{name:'計測を再開',exact:true}).waitFor();await other.close();
 await p.locator('.timer-banner').click();await p.getByRole('button',{name:'終了して保存へ',exact:true}).click();await p.locator('.manual-form').waitFor();assert.equal(await p.getByLabel('学習時間の分',{exact:true}).inputValue(),'2');
 await checkRecorderLayout(p);assert.equal(await p.locator('.pomodoro-indicator').count(),0);
 for(const width of [360,390,430,1280,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await p.getByRole('dialog').boundingBox();assert(box.x>=-1&&box.x+box.width<=width+1,`${width}:dialog bounds`);await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).scrollIntoViewIfNeeded();assert(await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).isVisible());}
 await mkdir('/workspace/studyplus-artifacts/timers',{recursive:true});await p.setViewportSize({width:390,height:900});await p.screenshot({path:'/workspace/studyplus-artifacts/timers/review-390.png'});
 // Distinct sessions with identical minutes require explicit duplicate confirmation.
 await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByLabel('別の記録として追加する').check();await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await state(p)).data.study_records.length,2);assert.equal((await state(p)).data.study_records[1].timer.completed_sets,2);
 await open(p);await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).click();await wait(async()=>(await timer(p)).timer);await discard(p);assert.equal((await state(p)).data.study_records.length,2);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS timers '+(file?'standalone HTML':'Pages')+': material/subject inheritance, denied storage, pause/resume/reload, fixed-ID cleanup recovery, Pomodoro colored focus/rest arcs, countdown/pause/restore, short/long break, cross-tab state, selector layout at five widths, desktop sidebar/mobile banner placement and keyboard reopen, confirmation/save/discard; no external requests');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
