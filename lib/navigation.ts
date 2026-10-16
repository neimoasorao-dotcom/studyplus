export const pageNames: Record<string, string> = {
    dashboard: '今日の学習', study: '科目・教材', materials: '科目・教材', records: '学習記録', manage: '学習管理',
    time: '学習時間', week: '週間の進捗', long: '長期の推移', subjects: '科目分析', goals: '目標', exams: '模試', ai: 'AI分析',
    condition: '学習状態', balance: '科目の配分', stability: '学習の安定性',
};
export const analysisPages = ['time', 'week', 'long', 'subjects', 'condition', 'balance', 'stability'];
export function parseLocation(hash: string) { const [name, query = ''] = hash.replace(/^#/, '').split('?'); return { page: pageNames[name] ? name : 'dashboard', params: new URLSearchParams(query) }; }
export function navigationGroup(page: string) { return analysisPages.includes(page) ? 'time' : ['study', 'materials'].includes(page) ? 'study' : ['goals', 'exams', 'ai', 'manage'].includes(page) ? 'manage' : page; }
