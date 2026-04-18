/**
 * CapacityHubPage — tabbed hub that embeds each capacity sub-page inline.
 * No more "View Full Report" button — content loads directly in the tab panel.
 */
import { useState } from 'react';
import { Tabs } from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import {
  IconFlame,
  IconUserPlus,
  IconChartAreaLine,
  IconUsersGroup,
  IconBuildingFactory,
  IconClock,
  IconChartBar,
  IconRadar,
} from '@tabler/icons-react';

// Inline sub-page imports — render content directly, no navigation needed
import UtilizationCenterPage    from './reports/UtilizationCenterPage';
import HiringForecastPage        from './reports/HiringForecastPage';
import CapacityDemandPage        from './reports/CapacityDemandPage';
import PodResourceSummaryPage    from './reports/PodResourceSummaryPage';
import PodCapacityPage           from './reports/PodCapacityPage';
import PodHoursPage              from './reports/PodHoursPage';
import WorkloadChartPage         from './WorkloadChartPage';
import CapacityForecastPage      from './reports/CapacityForecastPage';

const TABS = [
  { value: 'utilization',       label: 'Utilization',       icon: IconFlame,         component: UtilizationCenterPage },
  { value: 'hiring-forecast',   label: 'Hiring Forecast',   icon: IconUserPlus,      component: HiringForecastPage },
  { value: 'capacity-demand',   label: 'Capacity vs Demand',icon: IconChartAreaLine, component: CapacityDemandPage },
  { value: 'pod-resources',     label: 'POD Resources',     icon: IconUsersGroup,    component: PodResourceSummaryPage },
  { value: 'pod-capacity',      label: 'POD Capacity',      icon: IconBuildingFactory,component: PodCapacityPage },
  { value: 'work-hours',        label: 'Work Hours',        icon: IconClock,         component: PodHoursPage },
  { value: 'workload',          label: 'Workload',          icon: IconChartBar,      component: WorkloadChartPage },
  { value: 'capacity-forecast', label: 'Forecast',          icon: IconRadar,         component: CapacityForecastPage },
];

export default function CapacityHubPage() {
  const [activeTab, setActiveTab] = useState<string | null>('utilization');

  return (
    <PPPageLayout title="Capacity" subtitle="Resource capacity planning and workforce analytics" animate>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="outline"
        radius="sm"
      >
        <Tabs.List mb="md">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <Tabs.Tab
                key={tab.value}
                value={tab.value}
                leftSection={<Icon size={14} />}
              >
                {tab.label}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        {TABS.map(tab => {
          const Component = tab.component;
          return (
            <Tabs.Panel key={tab.value} value={tab.value}>
              {/* Only mount the active tab — prevents one crashing sub-page from taking down the hub */}
              {activeTab === tab.value && <Component />}
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </PPPageLayout>
  );
}
