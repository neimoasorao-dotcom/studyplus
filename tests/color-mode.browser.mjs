// Isolated browser profiles and synthetic data only.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import * as A from '../lib/analysis.ts';
const {chromium}=await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE||'playwright');
const file=process.env.STUDYPLUS_COLOR_OFFLINE_FILE,base=file?'http://127.0.0.1:5198/studyplus_offline.html':'http://127.0.0.1:5176/studyplus/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:740},hasTouch:true,isMobile:true,colorScheme:'dark',timezoneId:'Asia/Tokyo'});
if(file){const html=await readFile(file);await context.route(base,r=>r.fulfill({contentType:'text/html',body:html}));await context.setOffline(true);}
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
async function wait(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Color-mode wait timed out');}
async function state(p){return p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('studyplus-dashboard:/studyplus/',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('main');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};}));}
async function mode(p,expected,resolved){await wait(()=>p.evaluate(({expected,resolved})=>document.documentElement.dataset.colorMode===expected&&document.documentElement.dataset.resolvedColorMode===resolved,{expected,resolved}));assert.equal(await p.locator('.color-mode-toggle').getAttribute('data-mode'),expected);assert.equal(await p.locator('.color-mode-toggle').textContent(),'');}
function contrast(a,b){const luminance=s=>{const rgb=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try{
 // Verify the head bootstrap without executing the React bundle.
 const beforePaint=await browser.newContext({colorScheme:'light'});
 await beforePaint.addInitScript(()=>localStorage.setItem('studyplus.colorMode','dark'));
 const bootHTML=(await readFile(file||'dist-pages/index.html','utf8')).replace(/<script\b(?=[^>]*type="module")[^>]*>[\s\S]*?<\/script>/g,'');
 await beforePaint.route(base,r=>r.fulfill({contentType:'text/html',body:bootHTML}));
 const early=await beforePaint.newPage();await early.goto(base);assert.equal(await early.evaluate(()=>document.documentElement.dataset.resolvedColorMode),'dark');assert.equal(await early.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(17, 21, 28)');assert.equal(await early.locator('.color-mode-toggle').count(),0);await beforePaint.close();
 const p=await context.newPage();await p.goto(base);await p.getByRole('heading',{name:'今日の進捗',exact:true}).waitFor();await mode(p,'system','dark');
 const d=A.emptyData();d.subjects=[{id:'math',name:'数学・長い科目名のテスト',color:'#b33c88',ideal_ratio:1,target_days_per_week:5}];d.materials=[{id:'book',name:'長い教材名のテスト'.repeat(3),subject_id:'math'}];d.study_records=[{id:'today',date:A.today(),subject_id:'math',material_id:'book',duration_minutes:60}];d.goals.site.weekly_total_minutes=1000;
 await p.locator('input[type=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});const original=JSON.stringify((await state(p)).data);
 const toggle=p.locator('.color-mode-toggle');await toggle.click();await mode(p,'light','light');await toggle.click();await mode(p,'dark','dark');await p.reload();await p.getByRole('heading',{name:'今日の進捗',exact:true}).waitFor();await mode(p,'dark','dark');assert.equal(await p.evaluate(()=>localStorage.getItem('studyplus.colorMode')),'dark');
 await p.emulateMedia({colorScheme:'light'});await mode(p,'dark','dark');await toggle.click();await mode(p,'system','light');await p.emulateMedia({colorScheme:'dark'});await mode(p,'system','dark');
 assert.equal(JSON.stringify((await state(p)).data),original,'Appearance never changes learning data/settings');
 await mkdir('/workspace/studyplus-artifacts/color-mode',{recursive:true});
 for(const width of [360,390,430,1280,1440]){
  await p.setViewportSize({width,height:900});
  for(const m of ['light','dark']){
   while(await toggle.getAttribute('data-mode')!==m)await toggle.click();await mode(p,m,m);
   for(const page of ['dashboard','materials','subjects','time','goals','exams','ai']){await p.goto(base+'#'+page);await p.locator('.context').waitFor({state:'attached'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${m}/${page}: overflow`);}
   await p.goto(base+'#dashboard');await p.getByRole('heading',{name:'今日の進捗',exact:true}).waitFor();await p.screenshot({path:`/workspace/studyplus-artifacts/color-mode/${file?'offline':'pages'}-${m}-${width}.png`,fullPage:true});
  }
 }
 const textColors=await p.evaluate(()=>{const root=getComputedStyle(document.documentElement),probe=document.createElement('span');document.body.append(probe);const color=name=>{probe.style.color=`var(${name})`;return getComputedStyle(probe).color;};const values=['--foreground','--muted-foreground','--card','--background','--primary','--primary-foreground','--warning','--success','--destructive'].map(color);probe.remove();return values;});
 assert(contrast(textColors[0],textColors[2])>=7,'dark foreground contrast');assert(contrast(textColors[1],textColors[2])>=4.5,'dark supporting text contrast');assert(contrast(textColors[4],textColors[5])>=4.5,'primary button contrast');for(const color of textColors.slice(6))assert(contrast(color,textColors[2])>=4.5,'role color contrast');
 // Native input dialogs inherit the selected palette.
 await p.getByRole('button',{name:'記録を追加',exact:true}).click();await p.locator('.manual-form').waitFor();assert.equal(await p.getByRole('dialog').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(27, 32, 41)');await p.keyboard.press('Escape');
 // Another tab follows saved mode changes and keyboard activation works.
 const other=await context.newPage();await other.goto(base);await other.locator('.color-mode-toggle').waitFor();await toggle.focus();await p.keyboard.press('Enter');await mode(p,'system','dark');await mode(other,'system','dark');await toggle.press('Enter');await mode(p,'light','light');await mode(other,'light','light');await other.close();
 // PiP updates immediately on manual and system changes.
 await p.setViewportSize({width:1280,height:900});await p.getByRole('button',{name:'記録を追加',exact:true}).click();await p.getByRole('button',{name:'ストップウォッチ',exact:true}).click();await p.getByLabel('計測する科目').selectOption('math');await p.getByLabel('計測する教材').selectOption('book');await p.getByRole('button',{name:'計測を開始',exact:true}).click();await p.locator('[data-slot=dialog-close]').click();await p.getByRole('button',{name:'計測を小窓で表示',exact:true}).click();
 await wait(()=>p.evaluate(()=>!!window.documentPictureInPicture?.window?.document.querySelector('.timer-banner-time')));await toggle.click();await mode(p,'dark','dark');await wait(()=>p.evaluate(()=>window.documentPictureInPicture.window.document.documentElement.classList.contains('dark')));
 const colorPair=await p.evaluate(()=>{const win=window.documentPictureInPicture.window;return [getComputedStyle(document.querySelector('.sidebar-timer-slot .timer-banner-time')).color,win.getComputedStyle(win.document.querySelector('.timer-banner-time')).color];});assert.equal(colorPair[0],colorPair[1]);await toggle.click();await mode(p,'system','dark');await p.emulateMedia({colorScheme:'light'});await mode(p,'system','light');await wait(()=>p.evaluate(()=>!window.documentPictureInPicture.window.document.documentElement.classList.contains('dark')));await p.evaluate(()=>window.documentPictureInPicture.window.close());
 // Storage restrictions cannot break mode switching.
 await p.evaluate(()=>{const setter=Storage.prototype.setItem;Storage.prototype.setItem=function(key,...args){if(key==='studyplus.colorMode')throw new DOMException('test quota','QuotaExceededError');return setter.call(this,key,...args);};});await toggle.click();await mode(p,'light','light');await toggle.click();await mode(p,'dark','dark');
 assert.deepEqual(errors,[]);console.log('PASS '+(file?'standalone HTML':'Pages')+' color modes: icon-only cycle, preference/reload, system changes, explicit override, no data changes, 7 pages × 5 widths × 2 modes, contrast, input dialogs, tab/keyboard sync, real PiP and denied storage');
}finally{await browser.close();}
