import * as A from './analysis';

export type Slice = { id: string; name: string; value: number; color?: string };
export function distributionGroups(items: Slice[], limit = 5, groupIds?: string[]) {
  const valid = items.map(x => ({ ...x, value: Number.isFinite(x.value) ? Math.max(0, x.value) : 0 }));
  const positive = valid.filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  const rest = positive.slice(limit);
  const groupedRest = groupIds ? valid.filter(x => !groupIds.includes(x.id)) : rest;
  const slices = groupIds ? [...groupIds.map(id => valid.find(x => x.id === id)).filter((x): x is Slice => !!x), ...(groupedRest.length ? [{id:'__other__',name:'その他',value:A.sum(groupedRest.map(x=>x.value)),color:'var(--chart-unknown)'}] : [])] : rest.length > 1 ? [...positive.slice(0, limit), { id: '__other__', name: 'その他', value: A.sum(rest.map(x => x.value)), color: 'var(--chart-unknown)' }] : positive;
  return { items: valid, slices, total: A.sum(valid.map(x => x.value)) };
}

export function subjectSlices(data: A.Data, records: any[]): Slice[] {
  const totals = A.byKey(records, 'subject_id');
  const known = data.subjects.map(s => ({ id: s.id, name: s.name, value: totals[s.id] || 0, color: s.color }));
  const unknown = A.sum(Object.entries(totals).filter(([id]) => !data.subjects.some(s => s.id === id)).map(([, n]) => Number(n)));
  return unknown > 0 ? [...known, { id: '__unassigned__', name: '科目未設定', value: unknown, color: 'var(--chart-unknown)' }] : known;
}

export function materialSlices(data: A.Data, records: any[]): Slice[] {
  return Object.entries(A.byKey(records, 'material_id')).map(([id, value]) => ({ id, name: data.materials.find(m => m.id === id)?.name || '教材未設定', value: Number(value) }));
}

export function fittedAxis(values: unknown[], kind: 'deviation' | 'score', maximum?: number) {
  const numbers = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!numbers.length) return undefined;
  const min = Math.min(...numbers), max = Math.max(...numbers), step = kind === 'deviation' ? 2 : 5;
  const padding = Math.max(kind === 'deviation' ? 2 : 5, (max - min) * .12);
  const span = Math.max(kind === 'deviation' ? 10 : 20, max - min + padding * 2), center = (max + min) / 2;
  let low = Math.floor((center - span / 2) / step) * step, high = Math.ceil((center + span / 2) / step) * step;
  if (min >= 0) low = Math.max(0, low);
  if (typeof maximum === 'number' && maximum >= max) high = Math.min(maximum, high);
  if (low === high) high += step;
  return [low, high] as [number, number];
}

export function examMaximum(exam: any): number | undefined {
  const value = exam?.max_score ?? exam?.full_score ?? exam?.score_max;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
export function axisTicks(domain?: readonly number[]) {
  if (!domain || domain.length !== 2 || !domain.every(Number.isFinite)) return undefined;
  const [low, high] = domain, desired = (high - low) / 5;
  if (desired <= 0) return undefined;
  const magnitude = 10 ** Math.floor(Math.log10(desired));
  const step = [1, 2, 5, 10].map(n => n * magnitude).reduce((best, n) => Math.abs(n - desired) < Math.abs(best - desired) ? n : best);
  const ticks = [low];
  for (let value = Math.ceil(low / step) * step; value < high; value += step) if (value > low) ticks.push(A.round(value, 4));
  ticks.push(high);
  return ticks;
}
export function examFamily(exam: any) {
  return String(exam?.series || exam?.exam_type || exam?.name || '').normalize('NFKC').replace(/20\d{2}(?:年度|年)?/g, '').replace(/第\d+回/g, '').replace(/\s+/g, '');
}
export function previousComparable(exams: any[], latest: any, metric: 'score' | 'deviation') {
  if (!latest || !Number.isFinite(latest[metric])) return undefined;
  return exams.filter(e => e !== latest && e.subject_id === latest.subject_id && e.date < latest.date && examFamily(e) === examFamily(latest) && Number.isFinite(e[metric]) && (metric !== 'score' || (examMaximum(latest) !== undefined && examMaximum(e) === examMaximum(latest)))).at(-1);
}

export function monthOffset(month: string, offset: number) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function monthDays(month: string) {
  const first = month + '-01', last = A.addDays(monthOffset(month, 1) + '-01', -1);
  return { padding: (A.weekday(first) + 6) % 7, dates: A.dates(first, last) };
}
export function heatValue(data: A.Data, day: string, today: string, metric: 'time' | 'balance') {
  if (day > today) return { state: 'future', value: null, level: 0 } as const;
  const first = A.firstDate(data);
  if (!first || day < first) return { state: 'missing', value: null, level: 0 } as const;
  const value = metric === 'time' ? A.total(A.records(data, day, day)) : A.scores(data, A.addDays(day, -6), day).balance;
  if (value === null) return { state: 'missing', value: null, level: 0 } as const;
  const level = metric === 'balance' ? Math.min(5, Math.floor(value / 20) + 1) : value === 0 ? 0 : value < 30 ? 1 : value < 60 ? 2 : value < 120 ? 3 : value < 240 ? 4 : 5;
  return { state: 'value', value, level } as const;
}
