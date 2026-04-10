import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../../components/common/PageSkeleton';
import { PPPageLayout } from '../../components/pp';

const TimelineSimulatorPage  = lazy(() => import('../simulators/TimelineSimulatorPage'));
const ScenarioSimulatorPage  = lazy(() => import('../simulators/ScenarioSimulatorPage'));

export default function ScenarioToolsTabs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'timeline';
  return (
    <PPPageLayout
      title="Scenario Tools"
      subtitle="Timeline and scenario simulators for planning"
      tabs={[
        { label: 'Timeline Simulator', value: 'timeline' },
        { label: 'Scenario Simulator', value: 'scenario' },
      ]}
      activeTab={tab}
      onTabChange={v => setParams(v ? { tab: v } : {})}
      animate
    >
      <Suspense fallback={<PageSkeleton variant="table" />}>
        {tab === 'timeline' && <TimelineSimulatorPage />}
        {tab === 'scenario' && <ScenarioSimulatorPage />}
      </Suspense>
    </PPPageLayout>
  );
}
