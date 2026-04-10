import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const ResourcesPage        = lazy(() => import('../ResourcesPage'));
const AvailabilityPage     = lazy(() => import('../AvailabilityPage'));
const ResourceBookingsPage = lazy(() => import('../ResourceBookingsPage'));
const OverridesPage        = lazy(() => import('../OverridesPage'));

export default function ResourcesTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'directory';
  return (
    <PPPageLayout
      title="People & Resources"
      subtitle="Directory, availability, bookings, and cross-POD overrides"
      tabs={[
        { label: 'Directory',    value: 'directory'    },
        { label: 'Availability', value: 'availability' },
        { label: 'Bookings',     value: 'bookings'     },
        { label: 'Overrides',    value: 'overrides'    },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'directory'    && <ResourcesPage />}
        {tab === 'availability' && <AvailabilityPage />}
        {tab === 'bookings'     && <ResourceBookingsPage />}
        {tab === 'overrides'    && <OverridesPage />}
      </Suspense>
    </PPPageLayout>
  );
}
