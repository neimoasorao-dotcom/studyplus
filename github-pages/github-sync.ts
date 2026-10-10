import {validateSyncData} from '../lib/sync-merge';
import type {Data} from '../lib/analysis';

export type GitHubTarget = {repository: string; branch: string; key: string};
export const syncFile = 'studyplus-sync.json';
export function validateGitHubTarget(repository: string, branch: string, key: string) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) throw new Error('保存先は「ユーザー名/リポジトリ名」で指定してください。');
  if (!branch || branch.length > 200 || /[\s~^:?*\[\\]|\.\.|@\{|\/\/|^\/|\/$|\.lock$|\.$/.test(branch)) throw new Error('ブランチ名を確認してください。');
  if (!/^github_pat_[A-Za-z0-9_]{20,255}$/.test(key)) throw new Error('Fine-grained personal access token（github_pat_から始まる値）を入力してください。');
}
export function encodeGitHubJSON(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function decodeGitHubJSON(content: string): unknown {
  if (content.length > 34000000) throw new Error('共有ファイルが大きすぎます。同期は中止しました。');
  const binary = atob(content.replace(/\s/g, ''));
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
}
type Remote = {revision: number; data: Data | null; sha?: string};
async function api(target: GitHubTarget, path: string, init?: RequestInit) {
  const response = await fetch('https://api.github.com/repos/' + target.repository + path, {...init, headers: {Authorization: 'Bearer ' + target.key, Accept: path.startsWith('/contents/') ? 'application/vnd.github.object+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init ? {'Content-Type': 'application/json'} : {})}, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)});
  if (response.ok || (!init && response.status === 404)) return response;
  if (response.status === 401) throw new Error('GitHubトークンが無効、または期限切れです。同期を解除して新しいトークンを設定してください。');
  if ([409, 422].includes(response.status)) throw new Error('共有ファイルが更新されたか、書込条件を満たしていません。再度同期し、ブランチ設定も確認してください。');
  if (response.status === 403 || response.status === 429) throw new Error('GitHubへのアクセスが制限されています。トークンのContents権限、利用制限・リポジトリ設定を確認してください。');
  throw new Error('GitHubに接続できません。端末内の記録は保持されています。');
}
async function privateRepository(target: GitHubTarget) {
  const r = await api(target, '');
  if (!r.ok) throw new Error('非公開リポジトリが見つかりません。トークンの対象リポジトリを確認してください。');
  const metadata = await r.json() as {private?: boolean; default_branch?: string};
  if (metadata.private !== true) throw new Error('学習データの保存先は非公開リポジトリにしてください。送信は中止しました。');
  if (metadata.default_branch !== target.branch) {
    const branch = await api(target, '/branches/' + encodeURIComponent(target.branch));
    if (!branch.ok) throw new Error('指定したブランチがありません。READMEを作成してブランチを初期化してください。');
  }
}
export async function readGitHub(target: GitHubTarget): Promise<Remote> {
  await privateRepository(target);
  const r = await api(target, '/contents/' + syncFile + '?ref=' + encodeURIComponent(target.branch));
  if (r.status === 404) return {revision: 0, data: null};
  const file = await r.json() as {type?: string; sha?: string; content?: string; encoding?: string; size?: number};
  if (file.type !== 'file' || typeof file.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(file.sha) || !Number.isFinite(file.size) || file.size! > 24001000) throw new Error('共有ファイルの形式・サイズが不正です。');
  let content = file.content;
  // Contents API omits inline content above 1MB; use authenticated Git Blobs API.
  if (file.encoding !== 'base64' || typeof content !== 'string') {
    const blobResponse = await api(target, '/git/blobs/' + file.sha);
    if (!blobResponse.ok) throw new Error('共有ファイルを読み込めません。');
    const blob = await blobResponse.json() as {encoding?: string; content?: string; sha?: string};
    if (blob.encoding !== 'base64' || blob.sha !== file.sha || typeof blob.content !== 'string') throw new Error('共有ファイルの内容を確認できません。');
    content = blob.content;
  }
  const value = decodeGitHubJSON(content) as Partial<Remote> & {sync_version?: number};
  if (!value || value.sync_version !== 1 || !Number.isSafeInteger(value.revision) || value.revision! < 1 || !validateSyncData(value.data) || JSON.stringify(value.data).length > 8000000) throw new Error('共有JSONの形式が不正です。既存ファイルは上書きしません。');
  return {revision: value.revision!, data: value.data, sha: file.sha};
}
export async function writeGitHub(target: GitHubTarget, remote: Remote, data: Data): Promise<Remote> {
  await privateRepository(target);
  if (!validateSyncData(data) || JSON.stringify(data).length > 8000000) throw new Error('共有データの形式・サイズを確認してください。');
  const revision = remote.revision + 1;
  const response = await api(target, '/contents/' + syncFile, {method: 'PUT', body: JSON.stringify({message: 'Sync study records and settings', branch: target.branch, content: encodeGitHubJSON({sync_version: 1, revision, data}), ...(remote.sha ? {sha: remote.sha} : {})})});
  const result = await response.json() as {content?: {sha?: string}};
  if (!result.content?.sha || !/^[a-f0-9]{40,64}$/.test(result.content.sha)) throw new Error('GitHubの保存結果を確認できません。再度同期してください。');
  return {revision, data, sha: result.content.sha};
}
