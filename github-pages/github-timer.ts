import {api, privateRepository, encodeGitHubJSON, decodeGitHubJSON, type GitHubTarget} from './github-sync';
import {emptySharedTimer, validSharedTimer, type SharedTimer} from '../lib/shared-timer';

export const timerSyncFile='studyplus-timer.json';
export type RemoteTimer={state:SharedTimer;sha?:string};
export async function readGitHubTimer(target:GitHubTarget):Promise<RemoteTimer>{
 await privateRepository(target);
 const r=await api(target,'/contents/'+timerSyncFile+'?ref='+encodeURIComponent(target.branch));
 if(r.status===404)return {state:emptySharedTimer()};
 const file=await r.json() as {type?:string;sha?:string;encoding?:string;content?:string;size?:number};
 if(file.type!=='file'||!file.sha||!/^[a-f0-9]{40,64}$/.test(file.sha)||file.encoding!=='base64'||typeof file.content!=='string'||!Number.isSafeInteger(file.size)||file.size!<0||file.size!>1000000)throw Error('共有計測ファイルの形式を確認できません。上書きしていません。');
 const state=decodeGitHubJSON(file.content);
 if(!validSharedTimer(state))throw Error('共有計測の形式が不正です。上書きしていません。');
 return {state,sha:file.sha};
}
export async function writeGitHubTimer(target:GitHubTarget,remote:RemoteTimer,state:SharedTimer){
 if(!validSharedTimer(state)||state.revision!==remote.state.revision+1)throw Error('共有計測の更新番号が不正です。');
 await privateRepository(target);
 const r=await api(target,'/contents/'+timerSyncFile,{method:'PUT',body:JSON.stringify({message:'Update shared study timer',branch:target.branch,content:encodeGitHubJSON(state),...(remote.sha?{sha:remote.sha}:{})})});
 const result=await r.json() as {content?:{sha?:string}};
 if(!result.content?.sha||!/^[a-f0-9]{40,64}$/.test(result.content.sha))throw Error('共有計測の保存結果を確認できません。再確認してください。');
}
