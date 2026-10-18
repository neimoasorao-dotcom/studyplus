'use client';
import { useState, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, MoveRight, Check, Clock, BookOpen } from 'lucide-react';
import { distributionGroups, type Slice } from '@/lib/visual-insights';

const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
function sliceColor(item: Slice) { return item.color || colors[Array.from(item.id).reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length]; }
const percent = (n: number) => `${Math.round(n * 10) / 10}%`;
export function Distribution({ items, format, label, onSelect, selectedId, requirePercentTotal = false, preserveOrder = false, groupIds }: {
  items: Slice[]; format: (n: number) => string; label: string; onSelect?: (id: string) => void; selectedId?: string; requirePercentTotal?: boolean; preserveOrder?: boolean; groupIds?: string[];
}) {
  const [expanded, setExpanded] = useState(false), [selection, setSelection] = useState('');
  const group = distributionGroups(items, 5, groupIds), selected = group.items.find(x => x.id === (selectedId ?? selection));
  const valid = group.total > 0 && (!requirePercentTotal || Math.abs(group.total - 100) < .01);
  let offset = 0;
  const choose = (id: string) => { if (id === '__other__') { setExpanded(true); return; } setSelection(id); onSelect?.(id); };
  const visible = expanded || group.items.length <= 6 ? preserveOrder ? group.items : [...group.items].sort((a, b) => b.value - a.value) : group.slices;
  const positives=group.items.filter(x=>x.value>0), maximum=Math.max(0,...positives.map(x=>x.value)), leaders=positives.filter(x=>Math.abs(x.value-maximum)<.00001);
  const takeaway=requirePercentTotal?'設定した理想の配分':leaders.length>1?(leaders.length===positives.length?`${leaders.length}項目に均等に配分`:`${leaders[0].name}など${leaders.length}項目が${percent(maximum/group.total*100)}で最多`):leaders[0]?`${leaders[0].name}が${percent(maximum/group.total*100)}で最多`:'';
  return <div className="distribution" data-label={label}>
    {valid && <p className="visual-takeaway">{takeaway}</p>}
    <div className="distribution-layout"><div className="distribution-ring"><svg viewBox="0 0 180 180" role="img" aria-label={label + (valid ? `、合計${format(group.total)}` : '、集計できるデータがありません')}>
      <circle cx="90" cy="90" r="66" fill="none" stroke="var(--secondary)" strokeWidth="22"/>
      {valid && group.slices.map(item => { const share = item.value / group.total * 100, start = offset; offset += share; const selectedSlice = selected?.id === item.id || (item.id === '__other__' && selected && !group.slices.some(x => x.id === selected.id)); return <circle key={item.id} className="distribution-segment" cx="90" cy="90" r="66" pathLength="100" fill="none" stroke={sliceColor(item)} strokeWidth={selectedSlice ? 25 : 22} strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" opacity={selected && !selectedSlice ? .35 : 1} onClick={() => choose(item.id)}><title>{item.name} {format(item.value)}・{percent(share)}</title></circle>; })}
      <text x="90" y="81" textAnchor="middle" className="donut-name">{selected ? selected.name.length > 10 ? selected.name.slice(0, 9) + '…' : selected.name : '合計'}</text>
      <text x="90" y="105" textAnchor="middle" className="donut-value">{valid ? format(selected?.value ?? group.total) : '—'}</text>
    </svg></div><div className="distribution-legend">{visible.map(item => <button key={item.id} className="distribution-item" aria-pressed={selected?.id === item.id} onClick={() => choose(item.id)} aria-label={`${item.name} ${format(item.value)}${valid ? ' ' + percent(item.value / group.total * 100) : ''}`}><i style={{ background: sliceColor(item) }}/><span>{item.name}</span><strong>{format(item.value)}</strong>{!requirePercentTotal && <small>{valid ? percent(item.value / group.total * 100) : '—'}</small>}</button>)}
    {group.items.length > 6 && <button className="distribution-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '上位の内訳に戻す' : `全${group.items.length}項目・0分の項目を確認`}</button>}</div></div>
    {!valid && <p className="muted">{requirePercentTotal ? '理想比率の合計が100%になるよう設定してください。' : 'この期間の学習記録はありません。'}</p>}
  </div>;
}

export function KpiStats({ items }: { items: [ReactNode, ReactNode, ReactNode?][] }) {
  return <dl className="insight-kpis">{items.map(([label, value, note], i) => <div key={i}><dt>{label}</dt><dd><strong>{value ?? '—'}</strong>{note && <small>{note}</small>}</dd></div>)}</dl>;
}
export function TrendSummary({ current, previous, recent, prior, format }: {current: number; previous: number; recent: number; prior: number; format: (n: number) => string}) {
  const delta = current - previous, direction = Math.abs(delta) < 15 ? 'flat' : delta > 0 ? 'up' : 'down', Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : MoveRight;
  const signed = (n: number) => (n >= 0 ? '+' : '−') + format(Math.abs(n));
  return <div className="trend-summary" data-direction={direction}><div className="trend-direction"><Icon size={30}/><div><strong>学習量は{direction === 'up' ? '増加傾向' : direction === 'down' ? '減少傾向' : '横ばい'}</strong><small>直近3日の平均と、その前の3日を比較</small></div></div><KpiStats items={[
    ['直近3日の平均', format(current), `${signed(delta)}／日`], ['直近7日の合計', format(recent), `前の7日より ${signed(recent - prior)}`],
  ]}/><p className="muted">今日の実績は途中経過です。時間の増減は、学習の質の評価とは異なります。</p></div>;
}

export function GoalProgress({ rows, format }: { rows: { id: string; name: string; actual: number; target?: number | null; color?: string; days?: number; targetDays?: number }[]; format: (n: number | null) => string }) {
  return <div className="goal-progress-list">{!rows.length&&<p className="muted">対象がまだ登録されていません。</p>}{rows.map(row => { const target = typeof row.target === 'number' && row.target > 0 ? row.target : null, rate = target === null ? null : row.actual / target * 100; return <article key={row.id}><div className="goal-progress-heading"><span><i style={{background:row.color || 'var(--primary)'}}/>{row.name}</span><strong>{format(row.actual)} <small>/ {format(target)}</small></strong></div>{rate !== null ? <><div className="goal-progress-track" role="progressbar" aria-label={row.name + 'の目標達成率'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(rate))}><span style={{ width: Math.min(100, rate) + '%', background:row.color || 'var(--primary)' }}/></div><div className="goal-progress-foot"><span>{percent(rate)}</span><strong>{rate >= 100 ? <><Check size={14}/>達成</> : <>あと {format(Math.max(0, target! - row.actual))}</>}</strong></div></> : <p className="muted">目標未設定</p>}{row.days !== undefined && <p className="muted">学習日数 {row.days} / {row.targetDays ?? '—'}日</p>}</article>; })}</div>;
}

export function MaterialUsage({ rows, format, onRecord, disabled }: {rows: {m: any; last?: string; n7: number; p7: number; status: string}[]; format:(n:number)=>string; onRecord?:(id:string)=>void; disabled?: boolean}) {
  return <div className="material-usage-list">{!rows.length&&<p className="muted">教材がまだ登録されていません。</p>}{rows.map(({m,last,n7,p7,status}) => {const Icon=status==='増加'?TrendingUp:status.includes('未使用')?Clock:BookOpen;return <article key={m.id}><div className="usage-title"><strong>{m.name}</strong><span className="usage-status"><Icon size={14}/>{status}</span></div><p>直近7日 <b>{format(n7)}</b><span>前7日 {format(p7)}</span></p><small>最終学習 {last || '未使用'}</small>{onRecord&&<button className="usage-record" disabled={disabled} aria-label={m.name+'の記録を追加'} onClick={()=>onRecord(m.id)}>記録する</button>}</article>;})}</div>;
}

export function AllocationGaps({ subjects, minutes, tolerance, format }: {subjects:any[];minutes:number;tolerance:number;format:(n:number)=>string}) {
  const sorted=[...subjects].sort((a,b)=>a.diff-b.diff),under=sorted.find(s=>s.diff < -(s.tolerance??tolerance));
  return <div className="allocation-gaps">{under&&<p className="visual-takeaway">{under.name}は理想配分より{percent(Math.abs(under.diff)).replace('%','pt')}少なめです。</p>}{sorted.map(s=>{const allowed=s.tolerance??tolerance,inside=Math.abs(s.diff)<=allowed;return <article key={s.id}><div className="goal-progress-heading"><span><i style={{background:s.color||'var(--primary)'}}/>{s.name}</span><strong>{inside?'許容範囲':s.diff<0?'↑ 増やす':'↓ 配分を抑える'}</strong></div><p>実績 <b>{percent(s.actual)}</b> / 理想 {percent(s.ideal)} <strong className="gap-delta">{s.diff>=0?'+':'−'}{Math.round(Math.abs(s.diff)*10)/10}pt</strong></p><div className="ratio-comparison" aria-label={`${s.name} 実績${percent(s.actual)}、理想${percent(s.ideal)}`}><span style={{width:Math.min(100,s.actual)+'%',background:s.color||'var(--primary)'}}/><i style={{left:Math.min(100,s.ideal)+'%'}}/></div><details><summary>差の根拠・時間換算</summary><p>許容幅 ±{allowed}pt / {s.diff<0?'不足':'過多'} {format(Math.abs(s.diff)*minutes/100)} / Balanceへの減点 {Math.round(s.loss*10)/10}pt</p></details></article>;})}</div>;
}
