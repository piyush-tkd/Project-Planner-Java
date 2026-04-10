import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const ReleasesPage      = lazy(() => import('../ReleasesPage'));
const ReleaseNotesPage  = lazy(() => import('../ReleaseNotesPage'));

export default function ReleasesTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'releases';
  return (
    <PPPageLayout
      title="Releases"
      subtitle="Release planning and release notes"
      tabs={[
        { label: 'Releases', value: 'releases' },
        { label: 'Release Notes', value: 'notes' },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'releases' && <ReleasesPage />}
        {tab === 'notes'    && <ReleaseNotesPage />}
      </Suspense>
    </PPPageLayout>
  );
}
