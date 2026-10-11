import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createTimer,defaultTimerConfig,pauseTimer,validateTimer} from '../lib/study-timer.ts';
function moduleURL(source){return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');}
globalThis.__validTimer=validateTimer;
const modelURL=moduleURL(readFileSync('lib/shared-timer.ts','utf8').replace("import {validateTimer, type StudyTimer} from './study-timer';",'const validateTimer=globalThis.__validTimer;'));
const M=await import(modelURL);
const timer=createTimer('stopwatch','timer-test','2026-10-11','math','book',defaultTimerConfig,1000);
const base={...M.emptySharedTimer(),revision:1,epoch:1,ownerId:'phone',sessionId:timer.id,timer,updatedAt:1000};
const pending={...base,revision:2,timer:pauseTimer(timer,66000),updatedAt:66000};
const sharing={deviceId:'phone',target:'test/private-data:main',base,pending};
assert(M.validTimerSharing(sharing));assert(!M.validTimerSharing({...sharing,deviceId:'pc'}));assert(!M.validTimerSharing({...sharing,archives:[{at:1,timer:{},pending:null}]}));
assert(M.validSharedTimer(base));assert(M.timerControlled(sharing));assert(!M.timerControlled({...sharing,deviceId:'pc'}));
assert.equal(M.planTimerSync(sharing,base),'write');assert.equal(M.planTimerSync(sharing,pending),'accept','Lost ACK must be acknowledged without another write');
const handedOff={...base,revision:2,epoch:2,ownerId:'pc'};
assert.equal(M.planTimerSync(sharing,handedOff),'conflict','Offline old-owner changes cannot overwrite handoff');
assert.equal(M.planTimerSync(sharing,{...base,ownerId:'pc'}),'conflict','Same revision with different content cannot be overwritten');
for(const bad of [{revision:-1},{epoch:1.5},{ownerId:null},{sessionId:'wrong'},{terminal:'saved'},{timer:{}}])assert(!M.validSharedTimer({...base,...bad}));
const tombstone={...base,revision:3,timer:null,terminal:'saved'};assert(M.validSharedTimer(tombstone));assert.equal(M.planTimerSync(sharing,tombstone),'conflict','Completed sessions never resurrect');
globalThis.__validGithubData=()=>true;
const githubURL=moduleURL(readFileSync('github-pages/github-sync.ts','utf8').replace("import {validateSyncData} from '../lib/sync-merge';",'const validateSyncData=globalThis.__validGithubData;'));
const transportURL=moduleURL(readFileSync('github-pages/github-timer.ts','utf8').replace("from './github-sync'",`from '${githubURL}'`).replace("from '../lib/shared-timer'",`from '${modelURL}'`));
const G=await import(transportURL),github=await import(githubURL);
const target={repository:'test/private-data',branch:'main',key:'github_pat_'+'x'.repeat(50)};
let saved=null,sha='1'.repeat(40),writes=0,isPrivate=true,invalid=false;
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
 const pathname=new URL(url).pathname;
 if(pathname==='/repos/test/private-data')return Response.json({private:isPrivate,default_branch:'main'});
 assert(pathname.endsWith('/contents/studyplus-timer.json'));
 if(init.method==='PUT'){const body=JSON.parse(init.body);if((saved&&body.sha!==sha)||(!saved&&body.sha))return Response.json({}, {status:409});saved=github.decodeGitHubJSON(body.content);sha=String(++writes).padStart(40,'0');return Response.json({content:{sha}},{status:201});}
 if(!saved)return Response.json({}, {status:404});
 return Response.json({type:'file',sha,size:100,encoding:'base64',content:github.encodeGitHubJSON(invalid?{version:1}:saved)});
};
try{
 const remote=await G.readGitHubTimer(target);assert.deepEqual(remote.state,M.emptySharedTimer());
 await G.writeGitHubTimer(target,remote,base);assert.deepEqual((await G.readGitHubTimer(target)).state,base);
 await assert.rejects(()=>G.writeGitHubTimer(target,remote,base),/更新/);assert.equal(writes,1);
 await assert.rejects(()=>G.writeGitHubTimer(target,{state:base,sha},tombstone),/更新番号/);
 isPrivate=false;await assert.rejects(()=>G.readGitHubTimer(target),/非公開/);await assert.rejects(()=>G.writeGitHubTimer(target,{state:base,sha},pending),/非公開/);isPrivate=true;
 invalid=true;await assert.rejects(()=>G.readGitHubTimer(target),/形式/);assert.equal(writes,1);
 console.log('PASS shared timer: exclusive owner, offline handoff conflict, lost ACK, terminal protection, validation, separate file, private-only SHA writes and malformed rejection');
}finally{globalThis.fetch=fetchOriginal;}
