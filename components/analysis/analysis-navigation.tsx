import { analysisPages } from '@/lib/navigation';
const labels: Record<string, string> = { time: '時間', week: '週間・目標', long: '長期', subjects: '科目', condition: '総合', balance: '配分', stability: '安定性' };
export function AnalysisNavigation({ page, go }: {
    page: string;
    go: (p: string) => void;
}) { if (!analysisPages.includes(page))
    return null; return <nav className="analysis-navigation" aria-label="分析の種類">{analysisPages.map(id => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>{labels[id]}</button>)}</nav>; }
