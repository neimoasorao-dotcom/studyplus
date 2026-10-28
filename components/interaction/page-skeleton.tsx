import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton({ page }: { page: string }) {
    if (page === 'records' || page === 'manage' || page === 'study' || page === 'materials') return <div className="page-skeleton skeleton-list-page" role="status" aria-label="学習データを読み込み中" aria-busy="true"><span className="sr-only">学習データを読み込み中</span><div aria-hidden="true"><Skeleton className="skeleton-heading"/><Skeleton className="skeleton-action"/>{[0,1,2,3,4].map(row=><section className="skeleton-list-row" key={row}><Skeleton className="skeleton-heading"/><Skeleton className="skeleton-line"/></section>)}</div></div>;
    return <div className={'page-skeleton ' + (page === 'dashboard' ? 'skeleton-home' : 'skeleton-detail')} role="status" aria-label="学習データを読み込み中" aria-busy="true">
        <span className="sr-only">学習データを読み込み中</span>
        <div className="skeleton-hero" aria-hidden="true"><section><Skeleton className="skeleton-heading"/><Skeleton className="skeleton-number"/><Skeleton className="skeleton-line"/><Skeleton className="skeleton-meter"/><Skeleton className="skeleton-line"/></section><section><Skeleton className="skeleton-heading"/><Skeleton className="skeleton-line"/><div className="skeleton-fields"><Skeleton/><Skeleton/></div><Skeleton className="skeleton-action"/></section></div>
        <div className="skeleton-details" aria-hidden="true">{[0, 1].map(index => <section key={index}><Skeleton className="skeleton-heading"/><Skeleton className="skeleton-line"/><div className="skeleton-chart">{[28, 62, 45, 82, 54, 94, 66].map((height, i) => <Skeleton key={i} style={{height:height+'%'}}/>)}</div></section>)}</div>
    </div>;
}
