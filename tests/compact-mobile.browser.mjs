// Isolated browser data only. No real repository or sync destination is used.
import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import * as A from '../lib/analysis.ts';
import {createTimer, defaultTimerConfig, pauseTimer} from '../lib/study-timer.ts';
const {chromium}=await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE||'playwright');
const offline=process.env.STUDYPLUS_COMPACT_OFFLINE_FILE;
const base=offline?'http://127.0.0.1:5183/studyplus_offline.html':'http://127.0.0.1:5176/studyplus/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:740},timezoneId:'Asia/Tokyo'});
const now=Date.parse('2026-10-11T10:00:00Z');
await context.addInitScript(now=>{Date.now=()=>now;},now);
if(offline){const html=await readFile(offline);await context.route(base,route=>route.fulfill({contentType:'text/html',body:html}));await context.setOffline(true);}
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
const folder='/workspace/studyplus-artifacts/compact-mobile';await mkdir(folder,{recursive:true});
async function color(p,selector,variable){return p.locator(selector).evaluate((el,variable)=>{const probe=document.createElement('span');probe.style.color=`var(${variable})`;el.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return [getComputedStyle(el).color,expected];},variable);}
try{
 const p=await context.newPage();await p.goto(base);await p.locator('.context').waitFor({state:'attached'});
 const d=A.emptyData();d.subjects=[{id:'math',name:'数学のとても長い科目名・テスト用',color:'#b33c88'}];d.materials=[{id:'book',subject_id:'math',name:'テスト教材'}];
 d.study_records=[{id:'seed',source:'manual',date:'2026-10-11',subject_id:'math',material_id:'book',duration_minutes:60}];
 await p.locator('input[type=file]').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});
 await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 for(const width of [360,375,390,430]){
  await p.setViewportSize({width,height:width===375?667:740});
  assert.equal(await p.locator('.mobile-nav button').count(),8);
  assert.equal(await p.getByRole('button',{name:'その他',exact:true}).count(),0);
  for(const [label,hash] of [['ホーム','dashboard'],['学習時間','time'],['科目','subjects'],['教材','materials'],['目標','goals'],['模試','exams'],['AI分析','ai']]){
   const button=p.locator('.mobile-nav').getByRole('button',{name:label,exact:true});
   const box=await button.boundingBox();assert(box.width>=44&&box.height>=44,`${width}: ${label} tap target`);
   await button.focus();await p.keyboard.press('Enter');await p.waitForURL('**#'+hash);
   assert.equal(await button.getAttribute('aria-current'),'page');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}:${hash}: no overflow`);
  }
  await p.locator('.mobile-nav').getByRole('button',{name:'設定',exact:true}).click();
  const dialog=p.getByRole('dialog');await dialog.getByRole('heading',{name:'データ・設定',exact:true}).waitFor();
  assert(await dialog.getByRole('heading',{name:'端末間の同期',exact:true}).isVisible());
  assert(await dialog.getByRole('button',{name:'全データをJSON出力',exact:true}).isVisible());
  await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  const dot=p.locator('.sync-dot');assert.equal(await dot.getAttribute('aria-label'),'同期未設定');
  const colors=await dot.evaluate(el=>{const probe=document.createElement('span');probe.style.background='var(--destructive)';el.append(probe);const expected=getComputedStyle(probe).backgroundColor;probe.remove();return [getComputedStyle(el).backgroundColor,expected];});assert.equal(colors[0],colors[1]);
 }
 await p.goto(base+'#dashboard');await p.locator('.context').waitFor({state:'attached'});
 for(const [mode,phase,status] of [['stopwatch','focus','running'],['stopwatch','focus','paused'],['pomodoro','focus','running'],['pomodoro','focus','paused'],['pomodoro','shortBreak','running'],['pomodoro','shortBreak','paused']]){
  let timer=createTimer(mode,'fixture-timer','2026-10-11','math','book',defaultTimerConfig,now);
  timer={...timer,phase,completedSets:phase==='focus'?0:1,studyMs:phase==='focus'?0:1500000};
  if(status==='paused')timer=pauseTimer(timer,now);
  await p.evaluate(timer=>new Promise((resolve,reject)=>{const req=indexedDB.open('studyplus-timer-v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('timer','readwrite');tx.objectStore('timer').put({revision:100,timer,config:timer.config},'main');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}),timer);
  await p.reload();await p.locator('.timer-banner').waitFor();
  for(const width of [360,375,390,430]){
   await p.setViewportSize({width,height:740});const banner=p.locator('.mobile-timer-slot .timer-banner');await banner.waitFor();
   const box=await banner.boundingBox(),add=await p.locator('.top-actions .record-add').boundingBox();
   assert(box.x+box.width<=add.x&&Math.abs(box.y-add.y)<1,'timer is left of Add in same row');
   assert(box.height>=44,'timer tap target');assert.equal(await banner.textContent(),mode==='stopwatch'?'00:00':phase==='focus'?'25:00':'05:00');
   const colors=await color(p,'.timer-banner-time',phase==='focus'?'--primary':'--chart-3');assert.equal(colors[0],colors[1]);
   assert.equal(await p.locator('.timer-banner-time').evaluate(el=>getComputedStyle(el).animationName),status==='paused'?'indicator-blink':'none');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: timer header fits`);
   if(width===390)await p.screenshot({path:`${folder}/${offline?'offline':'pages'}-${mode}-${phase}-${status}.png`});
  }
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.timer-banner-time').evaluate(el=>getComputedStyle(el).animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS compact mobile ${offline?'offline HTML (network disabled)':'Pages'}: eight keyboard-accessible nav targets at four widths, unified settings/sync dialog, red disconnected indicator, six timer states, color/blink/reduced-motion, header placement, no overflow`);
}finally{await context.close();await browser.close();}
