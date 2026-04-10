import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const CapacityDemandPage  = lazy(() => import('../reports/CapacityDemandPage'));
const OverridesPage       = lazy(() => import('../OverridesPage'));
const LeaveManagementPage = lazy(() => import('../settings/LeaveManagementPage'));

export default function CapacityTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'capacity';
  return (
    <PPPageLayout
      title="Capacity Hub"
      subtitle="Demand, overrides, and leave management"
      tabs={[
        { label: 'Capacity',   value: 'capacity'  },
        { label: 'Overrides',  value: 'overrides' },
        { label: 'Leave',      value: 'leave'     },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'capacity'  && <CapacityDemandPage />}
        {tab === 'overrides' && <OverridesPage />}
        {tab === 'leave'     && <LeaveManagementPage />}
      </Suspense>
    </PPPageLayout>
  );
}
