// Run on the user's PC. Cloudflare credentials stay in Wrangler's normal login.
import {spawnSync} from 'node:child_process';
import {randomBytes, createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const dir = path.join(root, '.sites-runtime/sync-deploy');
const setupFile = path.join(dir, 'setup.json');
const configFile = path.join(dir, 'wrangler.jsonc');
let accountId;
function run(args, {capture = false, input} = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], {cwd: root, encoding: 'utf8', env: {...process.env, WRANGLER_SEND_METRICS: 'false', ...(accountId ? {CLOUDFLARE_ACCOUNT_ID: accountId} : {})}, stdio: input !== undefined ? ['pipe', 'inherit', 'inherit'] : capture ? ['inherit', 'pipe', 'pipe'] : 'inherit', input});
  if (r.error || r.status !== 0) throw new Error(r.error?.message || (capture ? r.stderr || r.stdout : 'Cloudflareコマンドに失敗しました。'));
  return (r.stdout || '') + (r.stderr || '');
}
try {
  await mkdir(dir, {recursive: true});
  let identity = run(['whoami'], {capture: true});
  if (/not authenticated|not logged in/i.test(identity)) {run(['login']); identity = run(['whoami'], {capture: true});}
  const ids = [...new Set(identity.match(/\b[a-f0-9]{32}\b/g) || [])];
  if (ids.length === 1) accountId = ids[0];
  else {
    const terminal = createInterface({input: process.stdin, output: process.stdout});
    accountId = (await terminal.question('利用するCloudflareアカウントID（32桁）: ')).trim(); terminal.close();
    if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error('アカウントIDを確認してください。');
  }
  let setup;
  try {setup = JSON.parse(await readFile(setupFile, 'utf8'));} catch (e) {if (e.code !== 'ENOENT') throw e;}
  if (setup && setup.accountId !== accountId) throw new Error('前回と異なるCloudflareアカウントです。元のアカウントで実行してください。');
  if (!setup) {
    const suffix = randomBytes(4).toString('hex');
    setup = {accountId, name: 'studyplus-sync-' + suffix, key: randomBytes(32).toString('base64url')};
    await writeFile(setupFile, JSON.stringify(setup, null, 2), {mode: 0o600});
  }
  if (!setup.databaseId) {
    const output = run(['d1', 'create', setup.name], {capture: true});
    const id = output.match(/database_id["']?\s*[:=]\s*["']?([a-f0-9-]{36})/i)?.[1];
    if (!id) {console.log(output); throw new Error('作成したD1のdatabase_idを確認できませんでした。再実行前にCloudflareで確認してください。');}
    setup.databaseId = id;
    await writeFile(setupFile, JSON.stringify(setup, null, 2), {mode: 0o600});
  }
  const config = {name: setup.name, account_id: accountId, main: '../../sync-worker/worker.ts', compatibility_date: '2026-05-15', workers_dev: true, vars: {ALLOWED_ORIGINS: 'https://neimoasorao-dotcom.github.io,null'}, d1_databases: [{binding: 'DB', database_name: setup.name, database_id: setup.databaseId}]};
  await writeFile(configFile, JSON.stringify(config, null, 2));
  run(['d1', 'execute', setup.name, '--remote', '--config', configFile, '--file', path.join(root, 'sync-worker/schema.sql'), '--yes']);
  // A new API fails closed until its private key hash has been installed.
  run(['deploy', '--config', configFile]);
  run(['secret', 'put', 'SYNC_KEY_HASH', '--config', configFile], {input: createHash('sha256').update(setup.key).digest('hex') + '\n'});
  console.log('\n準備が完了しました。上に表示された https://…workers.dev を同期API URLとして使ってください。');
  console.log('共有キー（iPhoneとPCに設定し、他人には渡さないでください）:\n' + setup.key);
  console.log('設定の控え: ' + setupFile + '\nこのファイルやキーをGitHub・チャットへ貼らないでください。');
} catch (e) {console.error(e.message); process.exitCode = 1;}
