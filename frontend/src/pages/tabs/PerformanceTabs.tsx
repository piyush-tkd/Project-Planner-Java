import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const ResourcePerformancePage  = lazy(() => import('../reports/ResourcePerformancePage'));
const ResourceIntelligencePage = lazy(() => import('../reports/ResourceIntelligencePage'));

export default function PerformanceTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'performance';
  return (
    <PPPageLayout
      title="Performance & Intelligence"
      subtitle="Resource performance metrics and intelligence reports"
      tabs={[
        { label: 'Resource Performance', value: 'performance' },
        { label: 'Resource Intelligence', value: 'intelligence' },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'performance'  && <ResourcePerformancePage />}
        {tab === 'intelligence' && <ResourceIntelligencePage />}
      </Suspense>
    </PPPageLayout>
  );
}
