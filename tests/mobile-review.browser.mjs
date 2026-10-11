// Local builds, isolated synthetic data only. Never connect a real sync provider.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import * as A from '../lib/analysis.ts';
const {chromium}=await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE||'playwright');
const before=process.env.STUDYPLUS_REVIEW_CAPTURE==='before';
const out='/workspace/studyplus-artifacts/mobile-review';await mkdir(out,{recursive:true});
const base=process.env.STUDYPLUS_REVIEW_BASE_URL||'http://127.0.0.1:5176/studyplus/';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const data=A.emptyData();data.updated_at='2026-10-11T19:00:00+09:00';
data.subjects=[{id:'math',name:'数学・基礎から応用までの非常に長い科目名',color:'#b33c88',ideal_ratio:.5},{id:'physics',name:'物理',color:'#15845a',ideal_ratio:.5}];
data.materials=[{id:'book',name:'数学の基礎から応用まで学ぶ演習教材',subject_id:'math'},{id:'physics-book',name:'物理演習',subject_id:'physics'}];
const record=(id,date,subject_id,material_id,duration_minutes)=>({id,source:'manual',source_id:id,date,subject_id,material_id,duration_minutes});
data.study_records=[record('current','2026-10-11','math','book',170),record('last','2026-10-04','math','book',60),record('negative','2026-10-04','physics','physics-book',110),...Array.from({length:6},(_,i)=>record('older-'+i,A.addDays('2026-09-27',-i*7),'math','book',100+i*10))];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const c=await browser.newContext({viewport:{width:360,height:740},timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
await c.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[NativeDate.parse('2026-10-11T10:00:00Z')+Number(localStorage.getItem('review-offset')||0)]));}static now(){return NativeDate.parse('2026-10-11T10:00:00Z')+Number(localStorage.getItem('review-offset')||0);}};});
const errors=[],external=[];c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});});
const p=await c.newPage();
async function wait(check){for(let i=0;i<100;i++){if(await check())return;await p.waitForTimeout(50);}throw Error('Review wait timed out');}
async function state(){return p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('studyplus-dashboard:/studyplus/');r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('main');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};}));}
async function seed(){await p.evaluate(data=>new Promise((resolve,reject)=>{const r=indexedDB.open('studyplus-dashboard:/studyplus/',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put({revision:1,data},'main');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};}),data);await p.reload();await p.locator('.context').waitFor();}
async function page(hash){await p.evaluate(hash=>{location.hash=hash;},hash);await wait(()=>p.locator('h1').textContent().then(t=>t===({materials:'教材分析',subjects:'科目分析',dashboard:'Dashboard',time:'学習時間',goals:'目標管理',exams:'模試分析',ai:'AI分析'}[hash])));await p.waitForTimeout(80);}
async function shot(name,compare=false){
 await p.mouse.move(0,0);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);
 const path=`${out}/${before?'before':'after'}-${name}.png`;await p.screenshot({path,animations:'disabled'});
 if(compare){
  const geometry=await p.evaluate(()=>[...document.querySelectorAll('h1,h2,button,.pick,.stats,.panel,.chart,.metric-group,table,.timer-banner')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,rect:[r.x,r.y,r.width,r.height],font:[s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight],spacing:[s.padding,s.margin],colors:[s.color,s.backgroundColor,s.borderColor]};}));
  const expected=`${out}/before-${name}.json`;
  if(before)await writeFile(expected,JSON.stringify(geometry));else{
   assert.deepEqual(geometry,JSON.parse(await readFile(expected,'utf8')),`${name}: desktop/tablet geometry and styles unchanged`);
   const comparison=JSON.parse(execFileSync('python3',['-c',`import json,sys
from PIL import Image,ImageChops
a=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');d=ImageChops.difference(a,b)
print(json.dumps({'pixels':sum(p!=(0,0,0) for p in d.getdata()),'maxChannel':max(v[1] for v in d.getextrema())}))`,`${out}/before-${name}.png`,path],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
   assert(comparison.pixels<=50&&comparison.maxChannel<=2,`${name}: screenshot differs beyond edge antialiasing: ${JSON.stringify(comparison)}`);
  }
 }
}
async function start(mode){await page('materials');await p.getByRole('button',{name:/^(この教材で)?記録する$/,exact:true}).click();await p.getByRole('button',{name:mode,exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).click();await p.getByRole('button',{name:'一時停止',exact:true}).waitFor();await p.getByRole('button',{name:'画面を閉じる（計測・下書きを保持）',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await p.locator('.timer-banner').waitFor();}
async function discard(){await p.locator('.timer-banner').click();await p.getByRole('button',{name:'この計測を破棄',exact:true}).click();await p.getByRole('button',{name:'計測を破棄する',exact:true}).click();await p.getByRole('button',{name:'計測を開始',exact:true}).waitFor();await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});}
try {
 await p.goto(base+'#materials');await p.locator('.context').waitFor();await seed();
 for(const [width,height] of [[360,740],[375,667],[390,740],[430,740]]){
  await p.setViewportSize({width,height});await page('materials');await p.locator('.entity-summary').waitFor();await shot(`S-01-${width}x${height}`);
  if(!before){const button=await p.getByRole('button',{name:'この教材で記録する',exact:true}).boundingBox(),nav=await p.locator('.mobile-nav').boundingBox();assert(button.y>=0&&button.y+button.height<=nav.y,`${width}x${height}: complete record button above bottom nav`);const card=p.locator('.entity-summary');const order=await card.evaluate(el=>[...el.children].map(n=>n.className));assert(order.indexOf('primary entity-record')<order.indexOf('compact-trend'),'record before chart');}
  await page('subjects');await p.locator('.entity-summary').waitFor();await shot(`S-06-${width}`);
  const diff=p.locator('.entity-summary .stats>div').filter({has:p.locator('dt',{hasText:'前週比'})});if(!before)assert.equal(await diff.locator('strong').textContent(),'+1h 50m');await p.getByRole('combobox',{name:'分析する科目'}).click();await p.getByRole('option',{name:'物理',exact:true}).click();if(!before)assert.equal(await diff.locator('strong').textContent(),'−1h 50m');
  await p.getByRole('button',{name:'その他',exact:true}).click();await p.getByRole('dialog').waitFor();await shot(`S-05-${width}`);
  if(!before){const close=p.getByRole('button',{name:'閉じる',exact:true});const cb=await close.boundingBox(),title=await p.getByRole('heading',{name:'その他のページ'}).boundingBox(),first=await p.getByRole('dialog').getByRole('button',{name:'目標',exact:true}).boundingBox();assert(cb.width>=44&&cb.height>=44);assert(cb.y+cb.height<=first.y&&title.x+title.width<=cb.x,'close fits title row above first item');await close.focus();await p.keyboard.press('Enter');}else await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
 }
 // Every page at desktop widths; affected pages also at tablet widths.
 for(const width of [768,1024,1280,1440]){await p.setViewportSize({width,height:900});for(const hash of width>=1280?['dashboard','materials','subjects','time','goals','exams','ai']:['materials','subjects']){await page(hash);await shot(`desktop-${width}-${hash}`,true);}}
 await p.setViewportSize({width:390,height:740});await start('ポモドーロ');await p.evaluate(()=>localStorage.setItem('review-offset','600000'));await p.waitForTimeout(350);
 for(const width of [360,390,430]){await p.setViewportSize({width,height:740});await p.locator('main .timer-banner').waitFor();await p.evaluate(()=>scrollTo(0,0));await shot(`S-02-${width}`);await p.evaluate(()=>scrollTo(0,600));await p.waitForTimeout(100);await shot(`S-02-scrolled-${width}`);
  if(!before){const b=await p.locator('.timer-banner').boundingBox(),nav=await p.locator('.mobile-nav').boundingBox();assert(b.y===0&&b.height>=44&&b.height<=46&&b.y+b.height<nav.y,'sticky one-line bar');assert.match(await p.locator('.timer-banner').textContent(),/学習.*15:00/);const open=await p.locator('.timer-banner-open').boundingBox();assert(open.width>=44&&open.height>=44);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const tabs=await p.locator('.analysis-tabs').boundingBox();assert(tabs.y>=b.y+b.height,'tabs below timer');}
 }
 for(const width of [768,1024,1280,1440]){await p.setViewportSize({width,height:900});await p.locator('.sidebar-timer-slot .timer-banner').waitFor();await p.evaluate(()=>scrollTo(0,0));await shot(`desktop-${width}-timer`,true);}
 await p.setViewportSize({width:390,height:740});await discard();await start('ストップウォッチ');await p.evaluate(()=>localStorage.setItem('review-offset','665000'));await p.waitForTimeout(350);await p.evaluate(()=>scrollTo(0,500));if(!before)assert.match(await p.locator('.timer-banner').textContent(),/経過.*01:05/);await discard();
 for(const width of [360,390,430]){await p.setViewportSize({width,height:740});for(const hash of ['dashboard','materials','subjects','time','goals','exams','ai']){await page(hash);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}:${hash}:overflow`);}}
 assert.deepEqual((await state()).data,data,'review and discarded timers never change learning data');
 // Same record creation, JSON export and deletion before/after; compare payloads and aggregates.
 await page('materials');await p.getByRole('button',{name:'この教材で記録する',exact:true}).click();await p.getByLabel('学習時間の分',{exact:true}).fill('17');await p.locator('.manual-form').getByRole('button',{name:'保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 const saved=(await state()).data,added=saved.study_records.at(-1);assert.equal(added.duration_minutes,17);assert.equal(added.material_id,'book');assert.equal(A.total(A.records(saved,'2026-01-01','2026-10-11')),A.total(A.records(data,'2026-01-01','2026-10-11'))+17);
 const stable=structuredClone(saved);for(const r of stable.study_records){if(!data.study_records.some(original=>original.id===r.id)){delete r.id;delete r.source_id;}}
 await p.getByRole('button',{name:'データ・設定メニュー'}).click();const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'全データをJSON出力',exact:true}).click();const download=await downloadPromise;assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),saved);await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'データ・設定メニュー'}).click();await p.getByRole('button',{name:'科目・教材・目標の設定',exact:true}).click();await p.getByRole('button',{name:'全データを削除',exact:true}).click();await p.getByLabel('確認のため「削除」と入力してください').fill('削除');await p.getByRole('button',{name:'全データを削除する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});const deleted=(await state()).data;assert.equal(deleted.study_records.length,0);assert.deepEqual(deleted.subjects,data.subjects);assert.deepEqual(deleted.materials,data.materials);
 const result={saved:stable,deleted,total:A.total(A.records(saved,'2026-01-01','2026-10-11'))};if(before)await writeFile(`${out}/before-data.json`,JSON.stringify(result));else assert.deepEqual(result,JSON.parse(await readFile(`${out}/before-data.json`,'utf8')),'save/delete/aggregates unchanged');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`PASS mobile review ${before?'baseline captured':'required S-01/S-02/S-05/S-06, desktop/tablet unchanged geometry and screenshot comparisons, unchanged save/delete/JSON/aggregates'}: ${out}`);
}finally{await browser.close();}
