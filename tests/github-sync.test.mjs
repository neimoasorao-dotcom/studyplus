import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as A from '../lib/analysis.ts';
globalThis.__validGithubData = data => data && ['subjects','materials','study_records','exam_results','imports'].every(k => Array.isArray(data[k])) && data.profile && data.goals;
const source = ts.transpileModule(readFileSync('github-pages/github-sync.ts','utf8').replace("import {validateSyncData} from '../lib/sync-merge';", 'const validateSyncData=globalThis.__validGithubData;'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readGitHub,writeGitHub,encodeGitHubJSON,decodeGitHubJSON,validateGitHubTarget} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const target={repository:'test/private-data',branch:'main',key:'github_pat_'+'a'.repeat(50)};
validateGitHubTarget(target.repository,target.branch,target.key);
assert.throws(()=>validateGitHubTarget('bad','main',target.key));assert.throws(()=>validateGitHubTarget(target.repository,'../main',target.key));
const d=A.emptyData();d.subjects=[{id:'math',name:'数学😀',color:'#cc0000'}];
assert.deepEqual(decodeGitHubJSON(encodeGitHubJSON(d)),d);
let stored=null,sha='1'.repeat(40),privateRepo=true,status=200,writeCount=0,blobReads=0,malformed=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,init={})=>{
 assert(url.startsWith('https://api.github.com/repos/test/private-data'));
 assert.equal(init.headers.Authorization,'Bearer '+target.key);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
 const path=new URL(url).pathname;
 if(status!==200)return Response.json({message:'Private upstream error'}, {status});
 if(path==='/repos/test/private-data')return Response.json({private:privateRepo,default_branch:'main'});
 if(path.includes('/branches/'))return Response.json({}, {status:404});
 if(path.includes('/git/blobs/')){blobReads++;return Response.json({sha,encoding:'base64',content:encodeGitHubJSON(stored)});}
 assert(path.endsWith('/contents/studyplus-sync.json'));
 assert.equal(init.headers.Accept,'application/vnd.github.object+json');
 if(init.method==='PUT'){
  const body=JSON.parse(init.body);assert.equal(body.branch,'main');
  if((stored&&body.sha!==sha)||(!stored&&body.sha))return Response.json({}, {status:409});
  stored=decodeGitHubJSON(body.content);sha=String(stored.revision).padStart(40,'0');writeCount++;
  return Response.json({content:{sha}}, {status:201});
 }
 if(!stored)return Response.json({}, {status:404});
 const body=malformed?{study_records:[]}:stored,bytes=new TextEncoder().encode(JSON.stringify(body)).length;
 return Response.json({type:'file',sha,size:bytes,encoding:bytes>1000000?'none':'base64',content:bytes>1000000?'':encodeGitHubJSON(body)});
};
try {
 const empty=await readGitHub(target);assert.deepEqual(empty,{revision:0,data:null});
 await writeGitHub(target,empty,d);let remote=await readGitHub(target);assert.deepEqual(remote.data,d);assert.equal(remote.revision,1);
 await assert.rejects(()=>writeGitHub(target,empty,d),/更新/);assert.equal(writeCount,1,'Stale writes must not overwrite');
 const large=structuredClone(d);large.extra='学習😀'.repeat(120000);await writeGitHub(target,remote,large);remote=await readGitHub(target);assert.deepEqual(remote.data,large);assert.equal(blobReads,1);
 privateRepo=false;await assert.rejects(()=>readGitHub(target),/非公開/);await assert.rejects(()=>writeGitHub(target,remote,d),/非公開/);assert.equal(writeCount,2);privateRepo=true;
 malformed=true;stored=d;await assert.rejects(()=>readGitHub(target),/形式/);malformed=false;
 status=401;await assert.rejects(()=>readGitHub(target),/期限切れ/);status=403;await assert.rejects(()=>readGitHub(target),/制限/);status=404;await assert.rejects(()=>readGitHub(target),/見つかりません/);
 console.log('PASS GitHub sync: private-only repository, authenticated requests, first creation, SHA conflicts, UTF-8/base64, >1MB blobs, malformed-file rejection, expired token and permission errors');
}finally{globalThis.fetch=originalFetch;}
