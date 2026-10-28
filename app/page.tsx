'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Upload, Download, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/interaction/page-skeleton';
import { MotionSurface } from '@/components/interaction/motion-surface';
import { FeedbackToaster } from '@/components/interaction/feedback-toaster';
import { PullToRefresh, type RefreshResult } from '@/components/interaction/pull-to-refresh';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { stateRequest, storageMode } from '@/lib/state-request';
import { DeviceSync, type SyncStatus } from '@/components/device-sync';
import { useInputViewport, MobileAnalysis } from '@/components/mobile-analysis';
import * as A from '@/lib/analysis';
import { TodayHome } from '@/components/today-home';
import type { StudyTimer } from '@/lib/study-timer';
import { RecordManager } from '@/components/record-manager';
import { StudyRecorder } from '@/components/study-recorder';
import { useColorMode } from '@/components/color-mode-toggle';
import { type MaterialSort } from '@/lib/material-sort';
import { StudyWorkspace } from '@/components/study/study-workspace';
import type { RecordIntent, RecordMethod } from '@/components/study/subject-material-picker';
import { AppShell } from '@/components/layout/app-shell';
import { ManagementHome } from '@/components/management/management-home';
import { AnalysisNavigation } from '@/components/analysis/analysis-navigation';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { fmt, pt, diff, pct, download, Panel, Stats, GridTable, Chart, Ring, Logic } from '@/components/data/presentation';
import { GoalProgress, KpiStats } from '@/components/data/insights';
import { ScoreChart, GoalTable, GoalHistory, WeekView, RecordTable, TimeView, Simulation, BalanceView, StabilityView, LongView } from '@/components/analysis/views';
import { SubjectsView } from '@/components/study/entity-views';
import { ExamsView, AIView, SettingsForm } from '@/components/management/views';
export default function App() {
    const { page, params, go } = useAppNavigation();
    const mobile = useIsMobile(), { resolved: colorMode } = useColorMode();
    const [homeSelection, setHomeSelection] = useState<{subject: string | null; material: string}>({subject:null, material:''});
    const [recordIntent, setRecordIntent] = useState<RecordIntent | undefined>();
    const [homeTimer, setHomeTimer] = useState<StudyTimer | null>(null), [timerReadOnly, setTimerReadOnly] = useState(false), [manualSubject, setManualSubject] = useState(''), [dailyGoalEditing, setDailyGoalEditing] = useState(false), [date, setDate] = useState(() => A.today('Asia/Tokyo'));
    const [d, setD] = useState<A.Data>(A.emptyData), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState(''), [saving, setSaving] = useState(false), [unsaved, setUnsaved] = useState<A.Data | null>(null), [period, setPeriod] = useState('7'), [settings, setSettings] = useState(false), [draft, setDraft] = useState<A.Data | null>(null), [imported, setImported] = useState<any>(null), [point, setPoint] = useState<any>(null), [utilities, setUtilities] = useState(false), [recordsOpen, setRecordsOpen] = useState(false);
    const recordViewport = useInputViewport(recordsOpen);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({ phase: 'disconnected' });
    const file = useRef<HTMLInputElement>(null), mutation = useRef(false), refreshLock = useRef(false);
    const [refreshing, setRefreshing] = useState(false);
    const [syncRefresh, setSyncRefresh] = useState<(() => Promise<RefreshResult>) | null>(null);
    const syncAttention = useRef<string | null>(null);
    const registerSyncRefresh = useRef((handler: (() => Promise<RefreshResult>) | null) => setSyncRefresh(() => handler)).current;
    const [deleteOpen, setDeleteOpen] = useState(false), [deleteText, setDeleteText] = useState(''), [deleteError, setDeleteError] = useState('');
    const [manualMaterial, setManualMaterial] = useState<string | null>(null);
    const [timerBannerTarget, setTimerBannerTarget] = useState<HTMLDivElement | null>(null);
    const [mobileTimerTarget, setMobileTimerTarget] = useState<HTMLDivElement | null>(null);
    async function load(clearUnsaved = false, quiet = false) { if (!quiet) setLoading(true); try {
        const r = await stateRequest(), j: any = await r.json();
        if (!r.ok)
            throw Error(j.error);
        setD(j.data || A.emptyData());
        setRevision(j.revision);
        if (!quiet) setPeriod(String(j.data?.profile?.default_period || 7));
        setError('');
        if(clearUnsaved)setUnsaved(null);
        return true;
    }
    catch (e: any) {
        setError(e.message);
        return false;
    }
    finally {
        if (!quiet) setLoading(false);
    } }
    useEffect(() => { void load(); }, []);
    useEffect(() => { const refresh = () => setDate(A.today(d.profile.timezone)); refresh(); const id = setInterval(refresh, 30000); window.addEventListener('focus', refresh); return () => { clearInterval(id); window.removeEventListener('focus', refresh); }; }, [d.profile.timezone]);
    const w = useMemo(() => A.week(d, date), [d, date]), current = useMemo(() => A.scores(d, w.start, date), [d, w.start, date]), prev = useMemo(() => A.scores(d, w.lastStart, A.addDays(w.start, -1)), [d, w]), history = useMemo(() => A.weekHistory(d, 8, date), [d, date]);
    async function save(next: A.Data, reason: string) { if (mutation.current || refreshLock.current)
        return false; mutation.current = true; setSaving(true); const payload = A.snapshot({ ...next, updated_at: new Date().toISOString() }, reason); setUnsaved(payload); try {
        const r = await stateRequest({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payload, revision }) }), j: any = await r.json();
        if (!r.ok)
            throw Error(j.error);
        setD(payload);
        setRevision(j.revision);
        setUnsaved(null);
        setError('');
        const nw = A.week(payload, date), oldBest = Math.max(0, ...A.weekHistory(d, 52, date).map(x => x.minutes));
        if (nw.goal && nw.current >= nw.goal && w.current < (w.goal || Infinity))
            toast.success('週間目標を達成しました！');
        else if (nw.current > oldBest && oldBest > 0)
            toast.success('週間の自己ベストを更新しました！');
        else
            toast.success(reason === '学習記録を削除' ? '学習記録を削除しました' : reason === '学習記録を編集' ? '学習記録を更新しました' : reason.includes('学習記録') ? '学習記録を追加しました' : '保存しました');
        return true;
    }
    catch (e: any) {
        setError(e.message);
        toast.error(e.message);
        return false;
    }
    finally {
        mutation.current = false;
        setSaving(false);
    } }
    async function deleteLearningData() { if (mutation.current || deleteText !== '削除')
        return; mutation.current = true; setSaving(true); setDeleteError(''); try {
        const r = await stateRequest({ method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, confirmation: deleteText }) }), j: any = await r.json();
        if (!r.ok)
            throw Error(j.error);
        setD(j.data);
        setRevision(j.revision);
        setUnsaved(null);
        setImported(null);
        setDraft(null);
        setPoint(null);
        setManualMaterial(null);
        setSettings(false);
        setDeleteOpen(false);
        setDeleteText('');
        setError('');
        go('dashboard');
        toast.success('勉強記録と読込・分析履歴を削除しました');
    }
    catch (e: any) {
        setDeleteError(e.message);
    }
    finally {
        mutation.current = false;
        setSaving(false);
    } }
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const life = new AbortController(); context.registerTool({ name: 'read_learning_analysis', title: '学習分析を取得', description: '保存済みデータから週間・月間・科目・教材・模試込みの集計済み分析パケットを返します。', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['週間分析', '月間分析', '科目分析', '教材分析', '模試込み総合分析'] } }, required: ['kind'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: (x: any) => { if (!['週間分析', '月間分析', '科目分析', '教材分析', '模試込み総合分析'].includes(x?.kind))
            throw Error('分析種別が不正です'); return A.packet(d, x.kind); } }, { signal: life.signal }); return () => life.abort(); }, [d]);
    async function readFile(f: File) { try {
        const j = JSON.parse(await f.text());
        const next = A.mergeImport(d, j);
        setImported(next);
        if (next.warnings.length) toast.warning(`読込内容に${next.warnings.length}件の確認事項があります`);
    }
    catch (e: any) {
        toast.error(e.message);
    } }
    const f = (n: number | null | undefined) => fmt(n, d.profile.unit);
    const recent = A.days(d, A.addDays(date, -6), date);
    function openManual(materialId = '', subjectId = '', method?: RecordMethod, autoStart = false) { if (loading || saving || refreshLock.current || error || unsaved)
        return; setRecordIntent(method ? { id: Date.now(), method, autoStart } : undefined); setManualSubject(homeTimer?.subjectId || subjectId); setManualMaterial(homeTimer?.materialId ?? materialId); }
    function openSettings() { if (refreshLock.current) return; setDraft(structuredClone(d)); setSettings(true); }
    const syncLabel = { disconnected: '同期未設定', waiting: '同期待ち', syncing: '同期中…', synced: '同期済み', offline: 'オフライン · 同期待ち', conflict: '同期の競合 · 要確認', error: '同期エラー · 要確認' }[syncStatus.phase];
    const refreshBlocked = loading || saving || !!error || !!unsaved || settings || !!imported || manualMaterial !== null || deleteOpen || dailyGoalEditing || recordsOpen || page === 'records';
    async function refreshDisplay(): Promise<RefreshResult> {
        if (refreshBlocked || refreshLock.current) return {kind:'warning',message:'入力・保存が終わってから更新してください'};
        refreshLock.current=true;setRefreshing(true);
        try {
            const remote = syncRefresh ? await syncRefresh() : null;
            if (remote?.kind === 'error' || remote?.kind === 'warning') { toast[remote.kind](remote.message,{id:'sync-attention'}); return remote; }
            if (!await load(false,true)) { const result: RefreshResult={kind:'error',message:'表示を更新できませんでした。保存済みの記録は保持しています。'};toast.error(result.message);return result; }
            const result: RefreshResult=remote ?? {kind:'info',message:navigator.onLine?'端末内の記録を確認しました':'端末内の記録を確認しました（オフライン）'};
            toast[result.kind](result.message);return result;
        } finally {refreshLock.current=false;setRefreshing(false);}
    }
    useEffect(() => { const phase=syncStatus.phase; if ((phase === 'conflict' || phase === 'error') && syncAttention.current !== phase) { syncAttention.current=phase; if (phase === 'conflict') toast.warning('同期が競合しています。データ・設定で確認してください',{id:'sync-attention'}); else toast.error('同期できませんでした。端末内の記録は保持しています',{id:'sync-attention'}); } else if (phase === 'synced' || phase === 'disconnected') syncAttention.current=null; }, [syncStatus.phase]);
    const utilityContent = <><div className="menu-list"><button disabled={refreshBlocked || refreshing} onClick={() => { setUtilities(false); void refreshDisplay(); }}>表示・同期を更新</button><button onClick={() => { setUtilities(false); setRecordsOpen(true); }}>学習記録の一覧・編集</button><button onClick={() => { setUtilities(false); openSettings(); }}><Settings size={18}/>科目・教材・目標の設定</button><button disabled={loading || saving || !!error && !unsaved} onClick={() => { setUtilities(false); file.current?.click(); }}><Upload size={18}/>JSONを読み込む</button><button disabled={loading} onClick={() => download('studyplus_learning_data.json', d)}><Download size={18}/>全データをJSON出力</button>{!d.study_records.length && <button onClick={() => download('studyplus_template.json', A.emptyData())}>空のJSONひな形</button>}</div><details className="display-details"><summary>更新日時・表示の詳細</summary><dl>{storageMode === 'browser' && <><dt>保存先</dt><dd>この端末のブラウザ内。端末間の同期を設定すると接続時に共有保存先と同期します。この画面で同期の状態を確認できます。JSONバックアップも引き続き利用できます。</dd></>}<dt>更新日時</dt><dd>{d.updated_at ? new Date(d.updated_at).toLocaleString('ja-JP', { timeZone: d.profile.timezone }) : '記録未読込'}</dd><dt>タイムゾーン</dt><dd>{d.profile.timezone}</dd></dl></details></>;
    return <AppShell page={page} go={go} syncStatus={syncStatus} browserStorage={storageMode === 'browser'} blocked={loading || saving || refreshing || !!error || !!unsaved} onRecord={() => openManual()} onUtilities={() => setUtilities(true)} timerSlot={setTimerBannerTarget} mobileTimerSlot={setMobileTimerTarget}><FeedbackToaster theme={colorMode}/><PullToRefresh enabled={!refreshBlocked && !refreshing} onRefresh={refreshDisplay}/>
 <input ref={file} hidden type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f)
        readFile(f); e.target.value = ''; }}/>
 <StudyRecorder intent={recordIntent} onTimerControlChange={setTimerReadOnly} shareTimer={storageMode === 'browser'} onSharedRecordsApplied={async () => { await load(false,true); }} initialSubject={manualSubject} onTimerChange={setHomeTimer} bannerTarget={mobile ? mobileTimerTarget : timerBannerTarget} data={d} date={date} materialId={manualMaterial} saving={saving} blocked={loading || saving || refreshing || !!error || !!unsaved} onOpen={setManualMaterial} onSave={record => d.study_records.some(r => r.id === record.id) ? Promise.resolve(true) : save({ ...d, study_records: [...d.study_records, record] }, 'timer' in record ? 'タイマーで学習記録を追加' : '学習記録を手入力')} onSettings={() => { setManualMaterial(null); openSettings(); }}/>
 {error && <div className="notice error" role="alert">{error}<div className="actions">{unsaved && <><button onClick={() => save(unsaved, '保存再試行')} disabled={saving}>再試行</button><button onClick={() => download('studyplus_unsaved.json', unsaved)}>未保存JSONを出力</button></>}<button onClick={() => { if (!unsaved || window.confirm('未保存の内容を破棄して保存済みデータを読み直します。必要なら先に未保存JSONを出力してください。')) {
        void load(true);
    } }}>再読み込み</button></div></div>}
 {loading ? <PageSkeleton page={page}/> : <MotionSurface key={page} view={page}>
 <AnalysisNavigation page={page} go={go}/>
 {page === 'manage' && <ManagementHome go={go} onSettings={openSettings} onUtilities={() => setUtilities(true)}/>}
 {page === 'records' && <section className="records-workspace"><RecordManager key={params.toString()} initialQuery={params.get('q') || ''} materialId={params.get('material') || undefined} subjectId={params.get('subject') || undefined} recordDate={params.get('date') || undefined} data={d} date={date} saving={saving} blocked={loading || saving || refreshing || !!error || !!unsaved} onSave={save}/></section>}
 {page === 'dashboard' && <TodayHome selection={homeSelection} onSelection={setHomeSelection} data={d} date={date} timer={homeTimer} timerReadOnly={timerReadOnly} blocked={loading || saving || refreshing || !!error || !!unsaved} saving={saving} onRecord={openManual} onGoalEditing={setDailyGoalEditing} onGoal={minutes => save({ ...d, goals: { ...d.goals, site: { ...d.goals.site, daily_targets: { ...d.goals.site.daily_targets, [date]: minutes } } } }, '今日の目標を変更')} go={go} format={f} condition={current.condition} chart={baseline => <Chart baseline={baseline} highlightToday height={128} data={recent.map(x => ({ ...x, date: x.date === date ? '今日' : x.date.slice(5).replace('-', '/'), minutes: x.minutes }))} series={[{ key: 'minutes', name: '学習時間' }]}/>} records={<RecordTable d={d} rs={A.records(d, date, date)} f={f}/>}/>}
 {page === 'week' && <WeekView d={d} w={w} history={history} f={f} setPoint={setPoint}/>}
 {page === 'time' && <TimeView onRecords={() => setRecordsOpen(true)} d={d} date={date} w={w} period={period} setPeriod={setPeriod} f={f} go={go} setPoint={setPoint} colorDisabled={saving || !!error || !!unsaved} onColor={(id: string, color: string) => { return save({ ...d, subjects: d.subjects.map(s => s.id === id ? { ...s, color } : s) }, '科目色を変更'); }}/>}
 {page === 'condition' && <MobileAnalysis><div className="grid"><Panel title="現在の学習状態" variant="summary"><div className="inline-ring"><Ring score={current.condition}/><div><h3>{A.label(current.condition, { ...A.defaults, ...d.settings })}</h3><p>信頼度 {current.confidence}</p><p>目標 {d.goals.site.learning_condition_target ?? '—'} / 100</p>{current.condition === null && <p className="muted">{current.reason}</p>}</div></div><KpiStats items={[["前週比", diff(current.condition, prev.condition)], ['Balance', pt(current.balance), diff(current.balance, prev.balance)], ['Stability', pt(current.stability), diff(current.stability, prev.stability)]]}/><div className="actions"><button onClick={() => go('balance')}>Balanceの詳細</button><button onClick={() => go('stability')}>Stabilityの詳細</button></div></Panel><Panel mobileSection="analysis" title="4週間のスコア推移"><ScoreChart history={history.slice(-4)}/></Panel></div><Panel mobileSection="analysis" title="スコア変動要因"><GridTable heads={['要因', '総合点への寄与の変化']} rows={[["科目比率・追加減点", diff(current.balance === null ? null : current.balance * (d.settings?.balanceWeight ?? .4), prev.balance === null ? null : prev.balance * (d.settings?.balanceWeight ?? .4))], ...(['time', 'zero', 'continuity'] as const).map((k, i) => { const weight = [d.settings?.timeWeight ?? .7, d.settings?.zeroWeight ?? .2, d.settings?.continuityWeight ?? .1][i] * (d.settings?.stabilityWeight ?? .6); return [['日別ばらつき', '0時間日', '科目継続性'][i], current.condition === null || prev.condition === null ? '比較データ不足' : diff(current[k] * weight, prev[k] * weight)]; })]}/></Panel><Simulation mobileSection="details" d={d} date={date} current={current}/><Panel mobileSection="details" collapsible title="スコア履歴" subtitle="保存時点の点数と理由。上の推移は現在の設定で再計算。"><GridTable heads={['日時', '総合', 'Balance', 'Stability', '変動理由']} rows={[...(d.score_history || [])].reverse().map((x: any) => [x.at?.replace('T', ' ').slice(0, 16), pt(x.condition), pt(x.balance), pt(x.stability), x.reason])}/></Panel><Logic mobileSection="details" d={d}/></MobileAnalysis>}
 {page === 'balance' && <BalanceView d={d} w={w} date={date} history={history} f={f}/>}
 {page === 'stability' && <StabilityView d={d} date={date} period={period} setPeriod={setPeriod} history={history} f={f}/>}
 {page === 'subjects' && <SubjectsView key={params.get('subject')} subjectId={params.get('subject')} go={go} onSort={storageMode === 'browser' ? (value: MaterialSort) => { void save({ ...d, profile: { ...d.profile, material_sort: value } }, '教材並び順'); } : undefined} d={d} date={date} w={w} f={f}/>}
 {(page === 'study' || page === 'materials') && <StudyWorkspace data={d} date={date} week={w} format={f} params={params} go={go} onRecord={openManual} timer={homeTimer} blocked={saving || refreshing || !!error || !!unsaved} onSettings={openSettings} onSort={storageMode === 'browser' ? (value) => { void save({ ...d, profile: { ...d.profile, material_sort: value } }, '教材並び順'); } : undefined}/>}
 {page === 'long' && <LongView d={d} date={date} f={f}/>}
 {page === 'goals' && <MobileAnalysis><Panel title="目標を設定する" subtitle="Studyplusの目標とサイト独自の目標を分けて管理します。" action={<button onClick={openSettings}><Settings size={16}/>目標を編集</button>}><Stats items={[["Studyplus週間目標", f(d.goals.studyplus.weekly_total_minutes)], ['サイト週間目標', f(d.goals.site.weekly_total_minutes)], ['Learning Condition', `${pt(d.goals.site.learning_condition_target)} / 100`]]}/><p className="muted">サイト目標が未設定の場合のみ、Studyplus目標を週間集計に使用します。</p><GoalProgress format={f} rows={[{id:"week",name:"今週の進捗",actual:w.current,target:w.goal}]}/></Panel><GoalTable mobileSection="overview" d={d} w={w} f={f}/><Panel mobileSection="analysis" title="教材別目標"><GoalProgress format={f} rows={d.materials.map(m=>({id:m.id,name:m.name,actual:A.total(A.records(d,w.start,date).filter(r=>r.material_id===m.id)),target:m.weekly_target_minutes,color:d.subjects.find(subject=>subject.id===m.subject_id)?.color}))}/></Panel><GoalHistory mobileSection="details" d={d}/></MobileAnalysis>}
 {page === 'exams' && <ExamsView d={d} date={date} save={save} saving={saving} f={f}/>}
 {page === 'ai' && <AIView d={d} save={save} saving={saving}/>}
 </MotionSurface>}
 {storageMode === 'browser' ? <DeviceSync open={utilities} onOpenChange={setUtilities} paused={loading || saving || !!unsaved || !!error || settings || !!imported || manualMaterial !== null || deleteOpen || dailyGoalEditing || recordsOpen || page === 'records'} revision={revision} onApplied={async () => { await load(false,true); }} onRefreshReady={registerSyncRefresh} onStatusChange={setSyncStatus}>{utilityContent}</DeviceSync> : <Dialog open={utilities} onOpenChange={setUtilities}><DialogContent placement="responsive-sheet" className="utility-dialog"><DialogHeader><DialogTitle>データ・設定</DialogTitle><DialogDescription>記録の読込・バックアップと設定</DialogDescription></DialogHeader>{utilityContent}</DialogContent></Dialog>}


 <Dialog open={recordsOpen} onOpenChange={v => { if (!saving)
        setRecordsOpen(v); }}><DialogContent placement="responsive-sheet" className="manual-dialog record-manager-dialog" style={recordViewport}><DialogHeader><DialogTitle>学習記録の一覧・編集</DialogTitle><DialogDescription>全期間の記録を検索・編集・削除できます。</DialogDescription></DialogHeader><RecordManager data={d} date={date} saving={saving} blocked={loading || saving || refreshing || !!error || !!unsaved} onSave={save}/></DialogContent></Dialog>
 <Dialog open={!!imported} onOpenChange={v => { if (!v && !saving)
        setImported(null); }}><DialogContent placement="responsive-sheet" className="wide-dialog"><DialogHeader><DialogTitle>JSON読込の確認</DialogTitle><DialogDescription>新しい記録を追加します。既存記録は上書きしません。</DialogDescription></DialogHeader>{imported && <><Stats items={[["追加", imported.added + '件'], ['一致する重複', imported.duplicates + '件'], ['警告', imported.warnings.length + '件']]}/><div className="scroll-box">{imported.warnings.map((x: string, i: number) => <p className="warning-line" key={i}>{x}</p>)}{!imported.warnings.length && <p>形式と重複を確認しました。</p>}</div><button className="primary" disabled={saving} onClick={async () => { if (await save(imported.data, 'JSON追加読込'))
        setImported(null); }}>{saving ? '保存中…' : 'この内容で追加する'}</button></>}</DialogContent></Dialog>
 <Dialog open={settings} onOpenChange={v => { if (!saving)
        setSettings(v); }}><DialogContent placement="responsive-sheet" className="wide-dialog"><DialogHeader><DialogTitle>設定・データ管理</DialogTitle><DialogDescription>目標、科目、表示方法と計算式を設定できます。</DialogDescription></DialogHeader>{draft && <SettingsForm draft={draft} setDraft={setDraft} saving={saving} onSave={async (next: A.Data) => { const hist = { at: new Date().toISOString(), before: { subjects: d.subjects, goals: d.goals, settings: d.settings }, after: { subjects: next.subjects, goals: next.goals, settings: next.settings } }; if (await save({ ...next, goal_history: [...(d.goal_history || []), hist] }, '目標・設定変更')) {
        setSettings(false);
        setPeriod(String(next.profile.default_period));
    } }}/>}<button onClick={() => download('studyplus_learning_data.json', d)}><Download size={16}/>全データをJSON出力</button><details><summary>読込履歴と警告</summary>{d.imports.map((i: any, k: number) => <div key={k}><p>{i.imported_at} / 追加{i.added_records}件 / 重複{i.duplicate_records}件</p>{i.warnings?.map((s: string, n: number) => <p key={n} className="warning-line">{s}</p>)}</div>)}</details><section className="delete-section"><h3>勉強記録の削除</h3><p className="muted">勉強記録と読込・分析履歴をすべて削除します。科目・教材・目標設定・模試結果は残ります。{storageMode === 'browser' && '同期を設定している場合、削除は接続後に共有保存先と他の端末にも反映されます。'}</p><button className="danger-outline" disabled={loading || saving || !!unsaved || !!error} onClick={() => { setDeleteText(''); setDeleteError(''); setDeleteOpen(true); }}><Trash2 size={16}/>全データを削除</button></section></DialogContent></Dialog>
 <Dialog open={deleteOpen} onOpenChange={v => { if (!saving)
        setDeleteOpen(v); }}><DialogContent placement="responsive-sheet" className="wide-dialog" onEscapeKeyDown={e => { if (saving)
        e.preventDefault(); }} onPointerDownOutside={e => { if (saving)
        e.preventDefault(); }}><DialogHeader><DialogTitle>勉強記録の全データを削除</DialogTitle><DialogDescription>この操作は取り消せません。必要な場合は先にJSONを出力してください。</DialogDescription></DialogHeader>{storageMode === 'browser' && <p className="muted">GitHub方式で同期している場合、削除後もGitHubの過去コミットには記録が残ります。</p>}<Stats items={[["勉強記録", d.study_records.length + '件'], ['読込履歴', d.imports.length + '件'], ['保存済みAI分析', (d.ai_reports?.length || 0) + '件']]}/><p>上記のデータ、読み込んだ元の記録、重複候補、スコア履歴を削除します。</p><p className="muted">科目・教材・目標・表示設定・模試結果・設定変更履歴は残ります。</p><button disabled={saving} onClick={() => download('studyplus_learning_data_backup.json', d)}><Download size={16}/>削除前のJSONを出力</button><label className="field"><span>確認のため「削除」と入力してください</span><input value={deleteText} disabled={saving} autoComplete="off" onChange={e => setDeleteText(e.target.value)}/></label>{deleteError && <p className="notice error" role="alert">{deleteError}</p>}<div className="actions"><button disabled={saving} onClick={() => setDeleteOpen(false)}>キャンセル</button><button className="danger" disabled={saving || deleteText !== '削除'} onClick={deleteLearningData}><Trash2 size={16}/>{saving ? '削除中…' : '全データを削除する'}</button>{deleteError && <button disabled={saving} onClick={() => { setDeleteOpen(false); setSettings(false); setDraft(null); load(); }}>再読み込み</button>}</div></DialogContent></Dialog>
 <Dialog open={!!point} onOpenChange={v => { if (!v)
        setPoint(null); }}><DialogContent placement="responsive-sheet" sheetSnap><DialogHeader><DialogTitle>数値の詳細</DialogTitle></DialogHeader>{point && <GridTable heads={['項目', '値']} rows={Object.entries(point).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, typeof v === 'number' ? f(v) : String(v)])}/>}</DialogContent></Dialog>
 </AppShell>;
}
