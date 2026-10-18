'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileAnalysis, scrollMobilePageTop } from '@/components/mobile-analysis';
import { Distribution, MaterialUsage } from '@/components/data/insights';
import { materialSlices } from '@/lib/visual-insights';
import * as A from '@/lib/analysis';
import { sortMaterialRows } from '@/lib/material-sort';
import { diff, pct, Pick, useMaterialSort, MaterialSortPick, Panel, Stats, MetricGroups, GridTable, Chart } from '@/components/data/presentation';
import { RecordTable } from '@/components/analysis/views';
export function SubjectsView({ d, date, w, f, onSort, subjectId, go }: any) {
    const mobile = useIsMobile(), [order, setOrder] = useMaterialSort(d, onSort);
    const [id, setId] = useState(subjectId || d.subjects[0]?.id || '');
    const subject = d.subjects.find((s: any) => s.id === id);
    if (!subject)
        return <Panel title="科目がありません"><p>設定で科目を追加するか、科目情報を含むJSONを読み込んでください。</p></Panel>;
    const subset = { ...d, study_records: d.study_records.filter((r: any) => r.subject_id === id) }, first = A.firstDate(d) || date, rs = A.records(subset, first, date), weeks = A.groupPeriod(subset, first, date, 'week'), months = A.groupPeriod(subset, first, date, 'month'), thisRs = A.records(subset, w.start, date), now = A.total(thisRs), last = A.total(A.records(subset, w.lastStart, A.addDays(w.start, -1))), monthStart = date.slice(0, 7) + '-01', lastEnd = A.addDays(monthStart, -1), lastStart = lastEnd.slice(0, 7) + '-01', cm = A.total(A.records(subset, monthStart, date)), lm = A.total(A.records(subset, lastStart, lastEnd)), s = A.scores(d, w.start, date), ss = s.subjects.find(x => x.id === id);
    const groups = [
        { title: '学習量', lead: 1, items: [['総学習時間', f(A.total(rs))], ['学習日数', new Set(rs.map(r => r.date)).size + '日'], ['過去最高週', weeks.length ? f(Math.max(...weeks.map(x => x.minutes))) : '—'], ['過去最高月', months.length ? f(Math.max(...months.map(x => x.minutes))) : '—']] },
        { title: '期間比較', items: [['今週', f(now)], ['前週比', mobile ? `${now - last >= 0 ? '+' : '−'}${f(Math.abs(now - last))}` : f(now - last)], ['今月', f(cm)], ['前月比', f(cm - lm)]] },
        { title: '目標・配分', items: [['理想比率との差', ss ? diff(ss.actual, ss.ideal) : '—'], ['週間目標進捗', pct(now, subject.weekly_target_minutes)], ['Balanceへの減点', ss ? `${A.round(ss.loss)}pt` : '—'], ['Stability継続性への減点', ss?.continuity != null ? `${A.round((100 - ss.continuity) * ss.ideal / 100 * (d.settings?.continuityWeight ?? .1))}pt` : '未設定']] }
    ];
    return <MobileAnalysis key={id} sections={[{ id: 'overview', label: '概要' }, { id: 'analysis', label: '推移' }, { id: 'details', label: '記録・詳細' }]}><div data-mobile-section="always" className="selector-toolbar"><Pick value={id} onChange={(value: string) => { setId(value); scrollMobilePageTop(); }} items={d.subjects.map((s: any) => [s.id, s.name])} label="分析する科目"/></div><Panel title={subject.name + ' — 量・配分・継続性'} variant="summary" className={mobile ? 'entity-summary' : ''}>{mobile ? <><Stats lead={1} items={[groups[0].items[0], groups[1].items[0], groups[0].items[1], groups[1].items[1]]}/><div className="compact-trend"><h3>直近8週の学習推移</h3><Chart height={140} data={weeks.slice(-8)} series={[{ key: 'minutes', name: subject.name, color: subject.color }]}/></div><p className="summary-hint">月別・曜日別の分析は「推移」、目標・内訳は「記録・詳細」へ</p></> : <MetricGroups groups={groups}/>} <p className="muted">週・月の比較は各期間の合計。現在の週・月は途中経過です。</p></Panel>{mobile && <Panel mobileSection="details" title="量・配分・継続性の詳細"><MetricGroups groups={groups}/></Panel>}<div className="grid"><Panel mobileSection="analysis" title="週推移"><Chart data={weeks.slice(-16)} series={[{ key: 'minutes', name: subject.name, color: subject.color }]}/></Panel><Panel mobileSection="analysis" title="月推移"><Chart data={months} series={[{ key: 'minutes', name: subject.name, color: subject.color }]}/></Panel></div><div className="grid"><Panel mobileSection="analysis" title="曜日別傾向"><GridTable heads={['曜日', '平均', '標準偏差']} rows={A.weekdayStats(subset, first, date).map(x => [x.day, f(x.average), f(x.sd)])}/></Panel><Panel mobileSection="analysis" title="時間帯別傾向" subtitle="開始時刻で分類。未取得の時刻は不明です。"><Distribution label="科目の時間帯配分" format={f} items={Object.entries(A.timeBands(rs,d.profile.timezone)).map(([name,value])=>({id:name,name,value:Number(value),color:name==='不明'?'var(--chart-unknown)':undefined}))}/></Panel></div><Panel mobileSection="details" title="教材内訳" action={<MaterialSortPick value={order} onChange={setOrder}/>}><Distribution preserveOrder label="科目内の教材配分" format={f} items={sortMaterialRows(materialSlices(d,rs).map(x=>({...x,minutes:x.value,last:rs.filter(r=>r.material_id===x.id).map(r=>r.date).sort().at(-1)})),order)} onSelect={id=>{if(go&&d.materials.some((m:any)=>m.id===id))go('study?material='+encodeURIComponent(id));}}/></Panel><Panel mobileSection="details" collapsible title="科目の学習記録"><RecordTable d={d} rs={thisRs} f={f}/></Panel></MobileAnalysis>;
}
export function MaterialsView({ d, date, w, f, onRecord, recordDisabled, onSort, activeId, embedded = false, onRecords }: any) {
    const mobile = useIsMobile(), [order, setOrder] = useMaterialSort(d, onSort);
    const rows = sortMaterialRows<{
        m: any;
        rs: any[];
        last?: string;
        n7: number;
        p7: number;
        name: string;
        minutes: number;
    }>(d.materials.map((m: any) => { const rs = d.study_records.filter((r: any) => A.validRecord(r) && r.material_id === m.id && r.date <= date), last = rs.map((r: any) => r.date).sort().at(-1), n7 = A.total(rs.filter((r: any) => r.date >= A.addDays(date, -6))), p7 = A.total(rs.filter((r: any) => r.date >= A.addDays(date, -13) && r.date <= A.addDays(date, -7))); return { m, rs, last, n7, p7, name: m.name, minutes: A.total(rs) }; }), order);
    const [id, setId] = useState(rows[0]?.m.id || '');
    const selected = rows.find((x: any) => x.m.id === (activeId || id)) || rows[0], m = selected?.m;
    if (!m || !selected)
        return <Panel title="教材がありません"><p>設定で教材を追加するか、教材を含むJSONを読み込んでください。</p></Panel>;
    const { rs, last, n7, minutes } = selected, subTotal = A.total(d.study_records.filter((r: any) => A.validRecord(r) && r.subject_id === m.subject_id && r.date <= date)), subset = { ...d, study_records: rs }, wk = A.total(A.records(subset, w.start, date));
    const groups = [
        { title: '使用量', lead: 1, items: [['総学習時間', f(minutes)], ['使用日数', new Set(rs.map((r: any) => r.date)).size + '日'], ['1回あたり平均', rs.length ? f(minutes / rs.length) : '—'], ['最終学習日', last || '未使用']] },
        { title: '最近の学習', items: [['直近7日', f(n7)], ['30日', f(A.total(A.records(subset, A.addDays(date, -29), date)))], ['90日', f(A.total(A.records(subset, A.addDays(date, -89), date)))]] },
        { title: '目標・配分', items: [['科目内比率', pct(minutes, subTotal)], ['週間目標', f(m.weekly_target_minutes)], ['今週の達成率', pct(wk, m.weekly_target_minutes)]] }
    ];
    const weeks = A.groupPeriod(subset, A.firstDate(subset) || date, date, 'week');
    return <>
  {!embedded && <div className="selector-toolbar material-selector"><MaterialSortPick value={order} onChange={setOrder}/><Pick value={m.id} onChange={(value: string) => { setId(value); scrollMobilePageTop(); }} items={rows.map((x: any) => [x.m.id, x.m.name])} label="分析する教材"/></div>}
  <MobileAnalysis key={m.id} sections={[{ id: 'overview', label: '概要' }, { id: 'analysis', label: '推移' }, { id: 'details', label: '記録・詳細' }]}>
   <Panel title={m.name} variant="summary" className="entity-summary">
    {<><Stats lead={1} items={[groups[0].items[0], groups[1].items[0], groups[0].items[1], groups[0].items[3]]}/>{onRecord && <button className="primary entity-record" disabled={recordDisabled} onClick={() => onRecord(m.id)}><Plus size={16}/>この教材で記録する</button>}<div className="compact-trend"><h3>直近8週の学習推移</h3><Chart height={140} data={weeks.slice(-8)} series={[{ key: 'minutes', name: m.name }]}/></div><p className="summary-hint">全期間の推移は「推移」、目標・内訳・記録は「記録・詳細」へ</p></>}
   </Panel>
   <Panel mobileSection="analysis" title="週ごとの推移"><Chart data={weeks} series={[{ key: 'minutes', name: m.name }]}/></Panel>
   {<Panel mobileSection="details" collapsible title="実績・目標・配分"><MetricGroups groups={groups}/></Panel>}
   <Panel mobileSection="details" title="教材の使用状況" subtitle="14日以上未使用、または前7日より1.5倍かつ60分以上増加を表示"><MaterialUsage format={f} onRecord={onRecord} disabled={recordDisabled} rows={rows.map((row:any)=>({...row,status:!row.last?'未使用':A.distance(row.last,date)>=14?'最近未使用':row.n7>=row.p7*1.5&&row.n7-row.p7>=60?'増加':'継続'}))}/></Panel>
   {<Panel mobileSection="details" collapsible title="この教材の全記録" action={onRecords && <button onClick={() => onRecords(m.id)}>記録を編集・削除</button>}><RecordTable d={d} rs={rs} f={f}/></Panel>}
  </MobileAnalysis>
 </>;
}
