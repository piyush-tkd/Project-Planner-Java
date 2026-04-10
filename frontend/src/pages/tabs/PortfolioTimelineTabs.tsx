import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const PortfolioTimelinePage = lazy(() => import('../reports/PortfolioTimelinePage'));
const GanttDependenciesPage = lazy(() => import('../reports/ProjectGanttPage'));

export default function PortfolioTimelineTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'timeline';
  return (
    <PPPageLayout
      title="Portfolio Timeline"
      subtitle="Timeline views and Gantt dependencies across all projects"
      tabs={[
        { label: 'Portfolio Timeline',  value: 'timeline' },
        { label: 'Gantt & Dependencies', value: 'gantt'   },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'timeline' && <PortfolioTimelinePage />}
        {tab === 'gantt'    && <GanttDependenciesPage />}
      </Suspense>
    </PPPageLayout>
  );
}
