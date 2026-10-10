import {validateSyncData} from '../lib/sync-merge';
type Env = {DB: D1Database; SYNC_KEY_HASH: string; ALLOWED_ORIGINS: string};
const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',');
    const headers = new Headers({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin'});
    if (origin && !allowed.includes(origin)) return Response.json({error: '許可されていない送信元です。'}, {status: 403, headers});
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    const reply = (body: unknown, status = 200) => Response.json(body, {status, headers});
    if (new URL(req.url).pathname !== '/v1/state') return reply({error: 'Not found'}, 404);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (!/^[a-f0-9]{64}$/.test(env.SYNC_KEY_HASH || '')) return reply({error: '共有保存先の認証設定が未完了です。'}, 503);
    const token = req.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
    if (!token) return reply({error: '認証が必要です。'}, 401);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(n => n.toString(16).padStart(2, '0')).join('');
    let mismatch = 0;
    for (let i = 0; i < 64; i++) mismatch |= hash.charCodeAt(i) ^ env.SYNC_KEY_HASH.charCodeAt(i);
    if (mismatch) return reply({error: '共有キーが正しくありません。'}, 401);
    if (!['GET', 'PUT'].includes(req.method)) return reply({error: '未対応の操作です。'}, 405);
    try {
      if (req.method === 'GET') {
        const {results} = await env.DB.prepare('SELECT s.revision, c.body FROM sync_state s LEFT JOIN sync_chunks c ON c.revision = s.revision WHERE s.id = ? ORDER BY c.part').bind('main').all<{revision: number; body: string | null}>();
        if (!results.length) return reply({revision: 0, data: null});
        return reply({revision: results[0].revision, data: results[0].revision === 0 ? null : JSON.parse(results.map(r => r.body || '').join(''))});
      }
      if (!req.headers.get('Content-Type')?.startsWith('application/json')) return reply({error: 'JSONが必要です。'}, 415);
      // Limit UTF-8 bytes while reading, before JSON parsing or allocating chunks.
      const reader = req.body?.getReader();
      if (!reader) return reply({error: 'データがありません。'}, 400);
      const decoder = new TextDecoder();
      let text = '', bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 24000000) {await reader.cancel(); return reply({error: 'データが大きすぎます。'}, 413);}
        text += decoder.decode(part.value, {stream: true});
      }
      text += decoder.decode();
      let payload;
      try {payload = JSON.parse(text);} catch {return reply({error: 'JSONの形式が不正です。'}, 400);}
      if (!Number.isInteger(payload?.revision) || payload.revision < 0 || !validateSyncData(payload.data)) return reply({error: 'データ形式が不正です。'}, 400);
      const body = JSON.stringify(payload.data);
      if (body.length > 8000000) return reply({error: 'データが大きすぎます（800万文字まで）。'}, 413);
      const revision = payload.revision, next = revision + 1;
      await env.DB.prepare('INSERT OR IGNORE INTO sync_state (id, revision) VALUES (?, ?)').bind('main', 0).run();
      const ops: D1PreparedStatement[] = [];
      for (let i = 0; i < body.length; i += 100000) ops.push(env.DB.prepare('INSERT INTO sync_chunks (revision, part, body) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM sync_state WHERE id = ? AND revision = ?)').bind(next, i / 100000, body.slice(i, i + 100000), 'main', revision));
      ops.push(env.DB.prepare('UPDATE sync_state SET revision = ? WHERE id = ? AND revision = ?').bind(next, 'main', revision));
      ops.push(env.DB.prepare('DELETE FROM sync_chunks WHERE revision < ? AND EXISTS (SELECT 1 FROM sync_state WHERE id = ? AND revision = ?)').bind(next, 'main', next));
      const result = await env.DB.batch(ops);
      if (!result[result.length - 2].meta.changes) return reply({error: '他の端末で更新されています。'}, 409);
      return reply({revision: next});
    } catch {return reply({error: '共有保存先に接続できません。端末内の記録は保持されています。'}, 503);}
  },
};

export default worker;
