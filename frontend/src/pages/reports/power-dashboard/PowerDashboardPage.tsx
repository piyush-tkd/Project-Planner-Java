import { useState } from 'react';
import { Container, Stack } from '@mantine/core';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { Dashboard } from './state/types';
import DashboardList from './DashboardList';
import DashboardView from './DashboardView';

/**
 * PowerDashboardPage: Thin container (<400 lines) that orchestrates routing between DashboardList and DashboardView.
 * Manages:
 * - Top-level view state (selected dashboard)
 * - Navigation between list and detail views
 * - Dark mode coordination
 *
 * All child components are decomposed in the power-dashboard/ subfolder:
 * - DashboardList: Grid view of all dashboards + template gallery
 * - DashboardView: Main canvas with widgets, grid layout, and controls
 * - state/: Type definitions, contexts, API hooks
 * - widgets/: Widget renderers, configuration, preview
 * - toolbars/: Global filters, drill drawer, templates, custom metrics
 */
export default function PowerDashboardPage() {
  const dark = useDarkMode();
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);

  return (
    <Container size="xl" py="md">
      <Stack className="page-enter stagger-children">
        {activeDashboard ? (
          <DashboardView
            dashboard={activeDashboard}
            dark={dark}
            onBack={() => setActiveDashboard(null)}
          />
        ) : (
          <DashboardList dark={dark} onOpen={setActiveDashboard} />
        )}
      </Stack>
    </Container>
  );
}
