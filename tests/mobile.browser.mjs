// Optional Chromium regression checks. Run against a local dev server only:
// STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/mobile.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as A from '../lib/analysis.ts';
import {registerHooks} from 'node:module';
registerHooks({resolve(spec,context,next){if(spec==='./analysis'&&context.parentURL?.endsWith('/lib/data-management.ts'))return next(new URL('./analysis.ts',context.parentURL).href,context);return next(spec,context);}});
const {clearLearningData}=await import('../lib/data-management.ts');
const {chromium} = await import(process.env.STUDYPLUS_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STUDYPLUS_TEST_URL || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Browser tests must use a local server');
const output = process.env.STUDYPLUS_TEST_OUTPUT || '/tmp/studyplus-browser-results';
await fs.mkdir(output, {recursive:true});
const source = A.emptyData();source.updated_at='2026-10-09T03:00:00Z';
source.subjects=[{id:'math',name:'数学',color:'#b33c88',ideal_ratio:.5,target_days_per_week:5,weekly_target_minutes:600},{id:'en',name:'英語',color:'#3D7D78',ideal_ratio:.5,target_days_per_week:5,weekly_target_minutes:600}];
source.materials=[{id:'gold',name:'Focus Gold 数学',subject_id:'math',weekly_target_minutes:300},{id:'leap',name:'必携英単語LEAP',subject_id:'en',weekly_target_minutes:300},{id:'long',name:'とても長い教材名・大学入試対策用の詳細な学習教材（第123巻・問題と解説）',subject_id:'math'}];
source.goals.site.weekly_total_minutes=1400;
for(const [i,date] of A.dates('2026-07-01','2026-10-09').entries())for(const [j,s] of source.subjects.entries())source.study_records.push({id:date+s.id,source:'manual',date,subject_id:s.id,material_id:j?'leap':'gold',duration_minutes:50+(i%7)*10,start_time:'18:00',content:'復習'});
source.exam_results=[{id:'exam',date:'2026-09-01',name:'テスト模試',subject_id:'math',score:70,deviation:58}];
const browser=await chromium.launch({executablePath:process.env.STUDYPLUS_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],results=[];
async function setup(width,data=source){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce',timezoneId:'Asia/Tokyo'});
 let state=structuredClone(data),revision=1,failSave=false;
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-10-09T03:00:00Z')});
 // Never send a read or write to a real learning-data store.
 await p.route('**/api/state',async route=>{
  const request=route.request();
  if(request.method()==='GET')return route.fulfill({json:{data:state,revision}});
  const body=request.postDataJSON();
  if(failSave)return route.fulfill({status:503,json:{error:'テスト用の保存失敗'}});
  if(body.revision!==revision)return route.fulfill({status:409,json:{error:'保存競合'}});
  state=request.method()==='DELETE'?clearLearningData(state):body.data;revision++;
  await route.fulfill({json:{data:state,revision}});
 });
 return {context,p,get state(){return state;},set failSave(v){failSave=v;}};
}
async function ready(p,name){await p.goto(`${base}/#${name}`);await p.locator('.context').waitFor();await p.waitForTimeout(200);}
async function layout(p,width,label){
 const metrics=await p.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert(metrics.width<=width+1,`${label}: page overflow ${metrics.width}/${width}`);
 results.push(label);
}
try{
 for(const width of [360,390,430,1280,1440]){
  const {context,p}=await setup(width);
  for(const name of ['dashboard','materials','subjects','time','week','condition','balance','stability','long','goals','exams','ai']){
   await ready(p,name);await layout(p,width,`${width}:${name}:initial`);
   if(width<768){
    const tabs=p.getByRole('tablist',{name:'ページ内の表示'}).getByRole('tab');
    for(let i=0;i<await tabs.count();i++){
     await tabs.nth(i).click();await p.waitForTimeout(100);await layout(p,width,`${width}:${name}:tab-${i}`);
     // Open fine-grained tables/logic to verify they remain reachable and contained.
     const summaries=p.locator('.analysis-content:not([hidden]) details:not(details details)>summary');
     for(let j=0;j<await summaries.count();j++){await summaries.nth(j).click();}
     await layout(p,width,`${width}:${name}:expanded-${i}`);
    }
    await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const footer=await p.locator('main footer').boundingBox(),nav=await p.locator('.mobile-nav').boundingBox();
    assert(footer.y+footer.height<=nav.y,`${name}: footer obscured by nav`);
   }else{
    assert.equal(await p.locator('.mobile-analysis').count(),0);
    assert.equal(await p.getByRole('button',{name:'データ・設定メニュー'}).isVisible(),false);
   }
  }
  await context.close();console.log('PASS layout width',width);
 }
 const session=await setup(390),{p,context}=session;
 await ready(p,'materials');
 assert.equal(await p.locator('.top-actions .record-add').isVisible(),false);
 await p.getByRole('combobox',{name:'分析する教材'}).click();await p.getByRole('option',{name:'Focus Gold 数学',exact:true}).click();
 await p.getByRole('combobox',{name:'教材の並び順'}).click();await p.getByRole('option',{name:'学習時間が短い順',exact:true}).click();
 assert.equal(await p.locator('.entity-summary h2').textContent(),'Focus Gold 数学');
 assert.equal(await p.evaluate(()=>localStorage.getItem('studyplus.materialSort')),'time_asc');
 await p.reload();await p.locator('.context').waitFor();assert.equal(await p.getByRole('combobox',{name:'教材の並び順'}).textContent(),'時間↑');
 await p.getByRole('combobox',{name:'分析する教材'}).click();await p.getByRole('option',{name:'Focus Gold 数学',exact:true}).click();
 await p.getByRole('tab',{name:'記録・詳細',exact:true}).click();
 await p.getByRole('combobox',{name:'分析する教材'}).click();await p.getByRole('option',{name:source.materials[2].name,exact:true}).click();
 assert.equal(await p.getByRole('tab',{name:'概要',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await p.evaluate(()=>window.scrollY),0);await layout(p,390,'long material name');
 await p.getByRole('button',{name:'この教材で記録する'}).click();
 const form=p.locator('.manual-form');
 assert.equal(await form.getByLabel('教材',{exact:true}).inputValue(),'long');
 assert.equal(await form.getByLabel('科目',{exact:true}).inputValue(),'math');
 await form.getByLabel('学習時間の時間',{exact:true}).fill('0');await form.getByLabel('学習時間の分',{exact:true}).fill('25');
 // Resize while focused: exercises visualViewport sizing and a scrollable short sheet.
 await p.setViewportSize({width:390,height:450});
 const sheet=await p.locator('.manual-dialog').boundingBox();assert(sheet.y>=0&&sheet.y+sheet.height<=451);
 await form.getByRole('button',{name:'保存して続ける',exact:true}).click();await p.getByText('記録を追加しました',{exact:true}).waitFor();
 assert.equal(session.state.study_records.length,source.study_records.length+1);
 assert.equal(session.state.study_records.at(-1).material_id,'long');assert.equal(session.state.study_records.at(-1).subject_id,'math');
 assert.deepEqual(session.state.study_records.slice(0,-1),source.study_records);
 assert.deepEqual(session.state.subjects,source.subjects);
 // Failed saves preserve input; reopening/reloading the page preserves successful records.
 await form.getByLabel('学習時間の分',{exact:true}).fill('26');session.failSave=true;
 await form.getByRole('button',{name:'保存',exact:true}).click();await form.getByRole('alert').waitFor();
 assert.equal(await form.getByLabel('学習時間の分',{exact:true}).inputValue(),'26');session.failSave=false;
 await form.getByRole('button',{name:'閉じる（保存しない）'}).click();await p.setViewportSize({width:390,height:900});
 await p.reload();await p.locator('.context').waitFor();assert.equal(session.state.study_records.length,source.study_records.length+1);
 // Keyboard access to the supplemental menu and in-page tabs.
 const menu=p.getByRole('button',{name:'データ・設定メニュー'});await menu.focus();await p.keyboard.press('Enter');
 await p.getByRole('dialog').waitFor();await p.getByText('更新日時・表示の詳細',{exact:true}).click();assert(await p.getByText('Asia/Tokyo',{exact:true}).isVisible());
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'全データをJSON出力',exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(output,'roundtrip.json'));
 const exported=JSON.parse(await fs.readFile(path.join(output,'roundtrip.json'),'utf8'));assert.deepEqual(exported,session.state);
 await p.getByRole('button',{name:'JSONを読み込む',exact:true}).click();await p.locator('input[type=file]').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await p.getByRole('button',{name:'この内容で追加する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(session.state.study_records.length,exported.study_records.length);
 await menu.click();await p.getByRole('button',{name:'科目・教材・目標の設定',exact:true}).click();await p.getByRole('button',{name:'設定を保存',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(session.state.subjects,source.subjects);
 await ready(p,'time');await p.getByRole('tab',{name:'概要',exact:true}).focus();await p.keyboard.press('ArrowRight');assert.equal(await p.getByRole('tab',{name:'分析',exact:true}).getAttribute('aria-selected'),'true');
 await p.keyboard.press('End');assert.equal(await p.getByRole('tab',{name:'記録・詳細',exact:true}).getAttribute('aria-selected'),'true');
 await menu.click();await p.getByRole('button',{name:'科目・教材・目標の設定',exact:true}).click();await p.getByRole('button',{name:'全データを削除',exact:true}).click();
 const dialog=p.getByRole('dialog').last();await dialog.getByLabel('確認のため「削除」と入力してください').fill('削除');await dialog.getByRole('button',{name:'全データを削除する',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(session.state.study_records.length,0);assert.deepEqual(session.state.subjects,source.subjects);assert.deepEqual(session.state.materials,source.materials);assert.deepEqual(session.state.goals,source.goals);
 await context.close();console.log('PASS material/sort/record/save failure/reload/JSON/settings/delete/keyboard');
 for(const mode of ['empty','many']){
  const data=mode==='empty'?A.emptyData():structuredClone(source);
  if(mode==='many'){data.subjects[0].name=source.materials[2].name;data.goals.site.weekly_total_minutes=null;data.study_records=Array.from({length:5},(_,i)=>source.study_records.map(r=>({...r,id:r.id+'-'+i,content:source.materials[2].name}))).flat();}
  const {context,p}=await setup(360,data);
  for(const name of ['dashboard','materials','subjects','time','goals','exams','ai']){await ready(p,name);await layout(p,360,`${mode}:${name}`);const tabs=p.getByRole('tablist',{name:'ページ内の表示'}).getByRole('tab');for(let i=0;i<await tabs.count();i++){await tabs.nth(i).click();await layout(p,360,`${mode}:${name}:${i}`);}}
  await context.close();console.log('PASS fixture',mode);
 }
 assert.deepEqual(errors,[],'Browser runtime errors');
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({checks:results.length,results,errors},null,2));console.log('PASS',results.length,'browser checks');
}finally{await browser.close();}
