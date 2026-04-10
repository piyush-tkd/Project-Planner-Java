import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const PortfolioHealthDashboardPage = lazy(() => import('../reports/PortfolioHealthDashboardPage'));
const ProjectHealthPage            = lazy(() => import('../reports/ProjectHealthPage'));
const StatusUpdatesFeedPage        = lazy(() => import('../reports/StatusUpdatesFeedPage'));

export default function PortfolioHealthTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  return (
    <PPPageLayout
      title="Portfolio Health"
      subtitle="Health scorecard, project signals, and status updates"
      tabs={[
        { label: 'Overview',        value: 'overview' },
        { label: 'Project Health',  value: 'health'   },
        { label: 'Status Updates',  value: 'signals'  },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
        {tab === 'overview' && <PortfolioHealthDashboardPage />}
        {tab === 'health'   && <ProjectHealthPage />}
        {tab === 'signals'  && <StatusUpdatesFeedPage />}
      </Suspense>
    </PPPageLayout>
  );
}
