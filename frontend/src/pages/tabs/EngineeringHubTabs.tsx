import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const EngineeringIntelligencePage   = lazy(() => import('../reports/EngineeringIntelligencePage'));
const DoraMetricsPage               = lazy(() => import('../reports/DoraMetricsPage'));
const DeliveryPredictabilityPage    = lazy(() => import('../reports/DeliveryPredictabilityPage'));

export default function EngineeringHubTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'intelligence';
  return (
    <PPPageLayout
      title="Engineering Hub"
      subtitle="Intelligence reports, DORA metrics, and delivery predictability"
      tabs={[
        { label: 'Intelligence', value: 'intelligence' },
        { label: 'DORA Metrics', value: 'dora' },
        { label: 'Delivery Predictability', value: 'predictability' },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'intelligence'   && <EngineeringIntelligencePage />}
        {tab === 'dora'           && <DoraMetricsPage />}
        {tab === 'predictability' && <DeliveryPredictabilityPage />}
      </Suspense>
    </PPPageLayout>
  );
}
