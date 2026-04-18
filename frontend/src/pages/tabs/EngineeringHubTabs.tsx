import { lazy, Suspense } from 'react';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const EngineeringIntelligencePage = lazy(() => import('../reports/EngineeringIntelligencePage'));

export default function EngineeringHubTabs() {
  return (
    <PPPageLayout
      title="Engineering Hub"
      subtitle="AI-powered intelligence and insights"
      tabs={[
        { label: 'Intelligence', value: 'intelligence' },
      ]}
      activeTab="intelligence"
      onTabChange={() => {}}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <EngineeringIntelligencePage />
      </Suspense>
    </PPPageLayout>
  );
}
