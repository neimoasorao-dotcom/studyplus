import {emptyData, recordKey, type Data} from './analysis';

const missing = Symbol('missing');
type Value = unknown | typeof missing;
export type Conflict = {path: string; local: unknown; remote: unknown};
const canonical = (v: Value): string => v === missing ? '<missing>' : JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export const sameSyncData = (a: Value, b: Value) => canonical(a) === canonical(b);
const object = (v: Value): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Three-way merge: changes are compared with the last acknowledged snapshot.
// Missing records remain missing; conflicting edits/deletions never silently win.
export function mergeSync(base: Data | null, local: Data | null, remote: Data | null) {
  const conflicts: Conflict[] = [];
  function merge(b: Value, l: Value, r: Value, path: string): Value {
    if (sameSyncData(l, r)) return l;
    if (sameSyncData(l, b)) return r;
    if (sameSyncData(r, b)) return l;
    if (path === 'updated_at') return [l, r].filter(x => typeof x === 'string').sort().at(-1) || missing;
    if (object(l) && object(r) && (object(b) || b === missing)) {
      const out: Record<string, unknown> = Object.create(null);
      const before = object(b) ? b : {};
      for (const key of new Set([...Object.keys(before), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(Object.hasOwn(before, key) ? before[key] : missing, Object.hasOwn(l, key) ? l[key] : missing, Object.hasOwn(r, key) ? r[key] : missing, path ? `${path}.${key}` : key);
        if (value !== missing) out[key] = value;
      }
      return out;
    }
    if (Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const key = (v: unknown): string | undefined => {
        if (!object(v)) return undefined;
        if (path === 'study_records') return recordKey(v);
        return typeof v.id === 'string' && v.id ? v.id : undefined;
      };
      const arrays = [b, l, r];
      if (arrays.every(a => a.every(x => key(x) !== undefined) && new Set(a.map(key)).size === a.length)) {
        const maps = arrays.map(a => new Map(a.map(x => [key(x)!, x])));
        const out: unknown[] = [];
        for (const k of new Set([...maps[1].keys(), ...maps[2].keys(), ...maps[0].keys()])) {
          const v = merge(...maps.map(m => m.has(k) ? m.get(k) : missing) as [Value, Value, Value], `${path}[${k}]`);
          if (v !== missing) out.push(v);
        }
        return out;
      }
      // Histories without IDs can be combined only when both sides append.
      if ([l, r].every(a => a.length >= b.length && b.every((x, i) => sameSyncData(x, a[i])))) {
        const out = [...b];
        for (const v of [...l.slice(b.length), ...r.slice(b.length)]) if (!out.some(x => sameSyncData(x, v))) out.push(v);
        return out;
      }
    }
    conflicts.push({path, local: l === missing ? null : l, remote: r === missing ? null : r});
    return l;
  }
  const baseline = base || emptyData();
  const data = merge(baseline, local || emptyData(), remote || emptyData(), '') as Data;
  return {data, conflicts};
}

export function validateSyncData(data: unknown): data is Data {
  return object(data) && ['subjects', 'materials', 'study_records', 'exam_results', 'imports'].every(k => Array.isArray(data[k])) && object(data.profile) && object(data.goals);
}
