import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const PodDashboardPage  = lazy(() => import('../PodDashboardPage'));
const JiraActualsPage   = lazy(() => import('../JiraActualsPage'));
const JiraSupportPage   = lazy(() => import('../JiraSupportPage'));
const JiraWorklogPage   = lazy(() => import('../JiraWorklogPage'));

export default function JiraDashboardTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'pods';
  return (
    <PPPageLayout
      title="Jira Dashboard"
      subtitle="POD dashboard, actuals, support queue, and worklog"
      tabs={[
        { label: 'POD Dashboard', value: 'pods' },
        { label: 'Jira Actuals', value: 'actuals' },
        { label: 'Support Queue', value: 'support' },
        { label: 'Worklog', value: 'worklog' },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'pods'    && <PodDashboardPage />}
        {tab === 'actuals' && <JiraActualsPage />}
        {tab === 'support' && <JiraSupportPage />}
        {tab === 'worklog' && <JiraWorklogPage />}
      </Suspense>
    </PPPageLayout>
  );
}
