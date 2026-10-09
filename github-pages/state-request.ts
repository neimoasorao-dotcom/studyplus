import {clearLearningData} from '../lib/data-management';
import type {Data} from '../lib/analysis';

export const storageMode: 'server' | 'browser' = 'browser';
const databaseName = 'studyplus-dashboard:/studyplus/';
const storeName = 'state';
type State = {revision: number; data: Data | null};
const response = (body: unknown, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => {if (blocked) request.result.close(); else resolve(request.result);};
    request.onerror = () => reject(request.error);
    request.onblocked = () => {blocked = true; reject(new Error('別のタブで保存先が使用されています'));};
  });
}

// The same JSON/revision contract as /api/state. IndexedDB read/write transactions
// serialize writers across tabs, so stale revisions cannot silently overwrite data.
export async function stateRequest(init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() || 'GET';
  if (!['GET', 'PUT', 'DELETE'].includes(method)) return response({error: '未対応の操作です'}, 405);
  let payload: {revision: number; data?: Data; confirmation?: string} | undefined;
  if (method !== 'GET') {
    try {payload = JSON.parse(String(init?.body));} catch {return response({error: 'データ形式が不正です'}, 400);}
    if (!payload || !Number.isInteger(payload.revision) || payload.revision < 0) return response({error: 'データ形式が不正です'}, 400);
    if (method === 'PUT') {
      if (!payload.data || !Array.isArray(payload.data.study_records) || !Array.isArray(payload.data.subjects)) return response({error: 'データ形式が不正です'}, 400);
      if (JSON.stringify(payload.data).length > 8000000) return response({error: 'データが大きすぎます（800万文字まで）。未保存のデータをJSON出力して保管してください。'}, 413);
    } else if (payload.confirmation !== '削除') return response({error: '確認欄に「削除」と入力してください。'}, 400);
  }
  try {
    const db = await openDatabase();
    return await new Promise<Response>(resolve => {
      const transaction = db.transaction(storeName, method === 'GET' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(storeName);
      let result = response({error: '保存先に接続できません'}, 503);
      const request = store.get('main');
      request.onsuccess = () => {
        try {
          const current: State = request.result || {revision: 0, data: null};
          if (method === 'GET') {result = response(current); return;}
          if (payload!.revision !== current.revision) {
            result = response({error: '他のタブで更新されています。未保存JSONを出力してから再読み込みしてください。'}, 409);
            return;
          }
          const next: State = {revision: current.revision + 1, data: method === 'DELETE' ? clearLearningData(current.data || undefined) : payload!.data!};
          store.put(next, 'main');
          result = response(method === 'DELETE' ? next : {revision: next.revision});
        } catch {transaction.abort();}
      };
      transaction.oncomplete = () => {db.close(); resolve(result);};
      transaction.onabort = transaction.onerror = () => {
        db.close();
        resolve(response({error: 'このブラウザに保存できません。入力内容をJSON出力して保管してください。'}, 503));
      };
    });
  } catch {
    return response({error: 'ブラウザの保存先に接続できません。ブラウザの保存許可を確認してください。'}, 503);
  }
}
