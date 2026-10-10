'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from './ui/dialog';
import {connect, connectGitHub, disconnect, getConnection, synchronize} from '../github-pages/device-sync';
import type {SyncResult} from '../github-pages/device-sync';

export function DeviceSync({open, onOpenChange, paused, revision, onApplied}: {open: boolean; onOpenChange: (v: boolean) => void; paused: boolean; revision: number; onApplied: () => Promise<void>}) {
  const [provider, setProvider] = useState<'github' | 'cloudflare'>('github'), [repository, setRepository] = useState('neimoasorao-dotcom/studyplus-data'), [branch, setBranch] = useState('main');
  const [url, setUrl] = useState(''), [key, setKey] = useState(''), [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('未接続：記録はこのブラウザ内に保存されています。'), [result, setResult] = useState<SyncResult | null>(null);
  const pause = useRef(paused), applying = useRef(false), stopped = useRef(false), applied = useRef(onApplied);
  useEffect(() => {pause.current = paused; applied.current = onApplied;}, [paused, onApplied]);
  const sync = useCallback(async () => {
    if (pause.current || applying.current || stopped.current) return;
    applying.current = true; setBusy(true);
    try {
      const r = await synchronize(() => !pause.current && !stopped.current);
      if (stopped.current) return;
      setResult(r);
      setMessage(r.warning ? r.warning : r.conflicts.length ? `競合が${r.conflicts.length}件あります。記録は上書きしていません。` : r.syncedAt ? '同期済み：' + new Date(r.syncedAt).toLocaleString('ja-JP') : '未接続：端末内に保存されています。');
      if (r.changed) await applied.current();
    } catch (e) {if (!stopped.current) setMessage((e as Error).message + ' 端末内保存は引き続き利用できます。');}
    finally {applying.current = false; if (!stopped.current) setBusy(false);}
  }, []);
  useEffect(() => {
    stopped.current = false;
    getConnection().then(c => {if (!stopped.current && c) {setConnected(true); setProvider(c.provider); setUrl(c.url); if(c.repository)setRepository(c.repository); if(c.branch)setBranch(c.branch); setMessage(c.syncedAt ? '最終同期：' + new Date(c.syncedAt).toLocaleString('ja-JP') : '接続済み：同期待ち');}}).catch(() => setMessage('同期設定を読み込めません。'));
    return () => {stopped.current = true;};
  }, []);
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {void sync();}, 30000);
    const initial = setTimeout(() => {void sync();}, 1000);
    window.addEventListener('online', sync); window.addEventListener('focus', sync);
    return () => {clearInterval(timer); clearTimeout(initial); window.removeEventListener('online', sync); window.removeEventListener('focus', sync);};
  }, [connected, revision, paused, sync]);
  function backupRemote() {
    if (!result?.remote) return;
    const href = URL.createObjectURL(new Blob([JSON.stringify(result.remote, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = href; a.download = 'studyplus_shared_backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sync-dialog">
    <DialogHeader><DialogTitle>端末間の同期</DialogTitle><DialogDescription>iPhone・PCで同じ保存先を設定します。トークン・共有キーはJSON出力には含まれません。</DialogDescription></DialogHeader>
    <p role="status" aria-live="polite">{message}</p>
    <p className="muted">起動時・変更後・接続復帰時と30秒ごとに同期します。通信できない間も端末内に保存されます。最初の同期ではこの端末のデータも共有保存先へ送信します。</p>
    <label className="field"><span>同期方式</span><select value={provider} disabled={busy || connected} onChange={e => {setProvider(e.target.value as 'github' | 'cloudflare');setKey('');}}><option value="github">GitHub非公開リポジトリ（Node不要）</option><option value="cloudflare">Cloudflare API</option></select></label>
    {provider === 'github' ? <>
      <label className="field"><span>保存先リポジトリ</span><input value={repository} onChange={e => setRepository(e.target.value)} disabled={busy || connected} autoCapitalize="none" autoCorrect="off"/></label>
      <label className="field"><span>ブランチ</span><input value={branch} onChange={e => setBranch(e.target.value)} disabled={busy || connected} autoCapitalize="none" autoCorrect="off"/></label>
      <p className="muted">保存ファイルは studyplus-sync.json。非公開リポジトリだけに接続します。GitHubの変更履歴には削除前の記録も残ります。</p>
    </> : <label className="field"><span>同期API URL</span><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://studyplus-sync.example.workers.dev" disabled={busy || connected} autoCapitalize="none" autoCorrect="off"/></label>}
    {!connected && <><label className="field"><span>{provider === 'github' ? 'GitHubトークン' : '共有キー'}</span><input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" disabled={busy} autoCapitalize="none" autoCorrect="off"/></label>{provider === 'github' && <p className="muted"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Fine-grained tokenを作成</a>：保存先リポジトリだけを選択し、ContentsをRead and writeにします。トークンは各端末に保存し、チャットには貼らないでください。</p>}</>}
    <div className="sync-actions">{connected ? <><button disabled={busy || paused} onClick={() => void sync()}>今すぐ同期</button><button disabled={busy} onClick={async () => {try {await disconnect(); setConnected(false); setKey(''); setResult(null); setMessage('同期を解除しました。端末内と共有保存先の記録は削除していません。');} catch (e) {setMessage((e as Error).message);}}}>この端末の同期を解除</button></> : <button disabled={busy || paused || !key || (provider === 'github' ? !repository || !branch : !url)} onClick={async () => {setBusy(true); try {if(provider === 'github')await connectGitHub(repository.trim(), branch.trim(), key.trim());else await connect(url.trim(), key.trim()); setKey(''); setConnected(true); setMessage('接続済み：同期待ち');} catch (e) {setMessage((e as Error).message);} finally {setBusy(false);}}}>接続して同期を開始</button>}</div>
    {result?.conflicts.length ? <section><h3>競合した項目</h3><p>この端末のJSONは「データ・設定」から出力できます。両方をバックアップし、記録や設定を確認してから再度同期してください。削除と変更が競合した場合も自動では処理しません。</p><button onClick={backupRemote}>共有保存先のJSONを出力</button>{result.conflicts.map(c => <details key={c.path}><summary>{c.path || 'データ全体'}</summary><pre>{JSON.stringify({この端末: c.local, 共有保存先: c.remote}, null, 2)}</pre></details>)}</section> : null}
  </DialogContent></Dialog>;
}
