// Real IndexedDB + built Pages UI, isolated browser profile and test data only.
// STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/pages.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as A from '../lib/analysis.ts';
const {chromium} = await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE || 'playwright');
const offlineFile = process.env.STUDYPLUS_OFFLINE_TEST_FILE;
const base = offlineFile ? process.env.STUDYPLUS_OFFLINE_TEST_URL || pathToFileURL(offlineFile).href : process.env.STUDYPLUS_PAGES_TEST_URL || 'http://127.0.0.1:5176/studyplus/';
assert(new URL(base).protocol === 'file:' || ['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Only local test deployments are allowed');
const browser = await chromium.launch({executablePath: process.env.STUDYPLUS_CHROMIUM || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,reducedMotion:'reduce',timezoneId:'Asia/Tokyo'});
if (offlineFile) {
 await context.setOffline(true);
 // Some managed browsers forbid file://. Serve only this exact HTML from memory
 // at a loopback origin; all other network access remains disabled.
 if (new URL(base).protocol !== 'file:') {
  const html = await fs.readFile(offlineFile);
  await context.route(base, route => route.fulfill({status:200,contentType:'text/html',body:html}));
 }
}
const errors = [], apiRequests = [], networkRequests = [];
context.on('page', p => {p.on('pageerror', error => errors.push(error.message));p.on('request', request => {if(offlineFile && /^https?:/.test(request.url()) && request.url()!==base)networkRequests.push(request.url());if(new URL(request.url()).pathname==='/api/state')apiRequests.push(request.url());});});
const d=A.emptyData();d.subjects=[{id:'math',name:'数学',color:'#b33c88',ideal_ratio:1,target_days_per_week:5,weekly_target_minutes:600}];d.materials=[{id:'gold',name:'Focus Gold 数学',subject_id:'math',weekly_target_minutes:300}];d.goals.site.weekly_total_minutes=600;
const today=A.today('Asia/Tokyo');d.study_records=[{id:'fixture',source:'manual',date:today,subject_id:'math',material_id:'gold',duration_minutes:60}];
async function ready(p,hash='dashboard') {await p.goto(base+'#'+hash);await p.locator('.context').waitFor();}
async function stored(p) {return p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('studyplus-dashboard:/studyplus/',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('main');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();};}));}
async function importJSON(p,data){await p.locator('input[type=file]').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});}
async function record(p,minutes){await p.getByRole('button',{name:'この教材で記録する'}).click();const form=p.locator('.manual-form');assert.equal(await form.getByLabel('教材',{exact:true}).inputValue(),'gold');await form.getByLabel('学習時間の時間',{exact:true}).fill('0');await form.getByLabel('学習時間の分',{exact:true}).fill(String(minutes));await form.getByRole('button',{name:'保存',exact:true}).click();}
try {
 const p=await context.newPage();await ready(p);assert(await p.getByText('このブラウザに保存 · JSONでバックアップ',{exact:true}).isVisible());
 await importJSON(p,d);let state=await stored(p);assert.equal(state.revision,1);assert.equal(state.data.study_records.length,1);assert.deepEqual(state.data.subjects,d.subjects);
 await p.reload();await p.locator('.context').waitFor();assert.equal((await stored(p)).data.study_records.length,1);
 const other=await context.newPage();await ready(p,'materials');await ready(other,'materials');
 await record(p,17);await p.getByRole('dialog').waitFor({state:'hidden'});state=await stored(p);assert.equal(state.revision,2);assert.equal(state.data.study_records.at(-1).duration_minutes,17);
 await record(other,18);await other.locator('.manual-form .notice.error').waitFor();assert.equal(await other.locator('.manual-form').getByLabel('学習時間の分',{exact:true}).inputValue(),'18');assert.deepEqual(await stored(p),state);await other.getByRole('button',{name:'閉じる（保存しない）'}).click();assert(await other.getByRole('button',{name:'未保存JSONを出力',exact:true}).isVisible());
 const failure=await context.newPage();await failure.addInitScript(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Test quota failure','QuotaExceededError');};});await ready(failure,'materials');await record(failure,19);await failure.locator('.manual-form .notice.error').waitFor();assert.equal(await failure.locator('.manual-form').getByLabel('学習時間の分',{exact:true}).inputValue(),'19');assert.deepEqual(await stored(p),state);await failure.close();
 // Backups round-trip with no duplicates; existing colors/configuration survive.
 await p.getByRole('button',{name:'データ・設定メニュー'}).click();const promised=p.waitForEvent('download');await p.getByRole('button',{name:'全データをJSON出力',exact:true}).click();const download=await promised;await download.saveAs('/tmp/studyplus-pages-backup.json');const exported=JSON.parse(await fs.readFile('/tmp/studyplus-pages-backup.json','utf8'));assert.deepEqual(exported,state.data);await p.keyboard.press('Escape');await importJSON(p,exported);state=await stored(p);assert.equal(state.data.study_records.length,2);assert.deepEqual(state.data.subjects,d.subjects);
 await p.getByRole('button',{name:'データ・設定メニュー'}).click();await p.getByRole('button',{name:'科目・教材・目標の設定',exact:true}).click();await p.getByRole('button',{name:'設定を保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});state=await stored(p);assert.deepEqual(state.data.subjects,d.subjects);assert.deepEqual(state.data.materials,d.materials);
 await p.getByRole('button',{name:'データ・設定メニュー'}).click();await p.getByRole('button',{name:'科目・教材・目標の設定',exact:true}).click();await p.getByRole('button',{name:'全データを削除',exact:true}).click();const dialog=p.getByRole('dialog').last();await dialog.getByLabel('確認のため「削除」と入力してください').fill('削除');await dialog.getByRole('button',{name:'全データを削除する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});state=await stored(p);assert.equal(state.data.study_records.length,0);assert.deepEqual(state.data.subjects,d.subjects);assert.deepEqual(state.data.materials,d.materials);assert.deepEqual(state.data.goals,d.goals);
 await p.reload();await p.locator('.context').waitFor();assert.equal((await stored(p)).data.study_records.length,0);
 await importJSON(p,exported);
 for(const width of [360,390,430,1280,1440]){await p.setViewportSize({width,height:900});for(const hash of ['dashboard','materials','subjects','time','goals','exams','ai']){await ready(p,hash);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}:${hash}:overflow`);}}
 assert.deepEqual(networkRequests,[],'Offline HTML must not request network resources');assert.deepEqual(apiRequests,[],'Pages must never send data to the server endpoint');assert.deepEqual(errors,[]);
 console.log('PASS '+(offlineFile?'Offline HTML (network disabled, '+new URL(base).protocol+')':'Pages')+': native IndexedDB save/reload, atomic tab conflict, quota failure/input preservation, JSON roundtrip, settings/colors, deletion, five widths; no server requests');
}finally{await context.close();await browser.close();}
