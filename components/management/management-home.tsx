import { Target, GraduationCap, Sparkles, BookOpen, Database, Settings, ChevronRight } from 'lucide-react';
export function ManagementHome({ go, onSettings, onUtilities }: {
    go: (p: string) => void;
    onSettings: () => void;
    onUtilities: () => void;
}) {
    const entries = [{ title: '目標', description: '今日・週間・科目・教材の目標と変更履歴', icon: Target, action: () => go('goals') }, { title: '模試', description: '成績と学習状況の関係を確認', icon: GraduationCap, action: () => go('exams') }, { title: 'AI分析', description: '分析パケットの出力・分析結果の保存', icon: Sparkles, action: () => go('ai') }, { title: '科目・教材の設定', description: '科目色・教材・記録時の並び順', icon: BookOpen, action: onSettings }, { title: 'データ・端末間の同期', description: 'JSONの読込・出力、共有保存先、同期状況', icon: Database, action: onUtilities }, { title: '表示・計算の設定', description: '表示単位、期間、評価設定と履歴', icon: Settings, action: onSettings }];
    return <div className="management-grid">{entries.map(({ title, description, icon: Icon, action }) => <button key={title} className="management-link" onClick={action}><Icon size={22}/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18}/></button>)}</div>;
}
