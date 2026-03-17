import { Routes, Route } from 'react-router-dom';
import AppShellLayout from './components/layout/AppShell';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ResourcesPage from './pages/ResourcesPage';
import PodsPage from './pages/PodsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AvailabilityPage from './pages/AvailabilityPage';
import OverridesPage from './pages/OverridesPage';
import CapacityGapPage from './pages/reports/CapacityGapPage';
import UtilizationHeatmapPage from './pages/reports/UtilizationHeatmapPage';
import HiringForecastPage from './pages/reports/HiringForecastPage';
import ConcurrencyRiskPage from './pages/reports/ConcurrencyRiskPage';
import DeadlineGapPage from './pages/reports/DeadlineGapPage';
import ResourceAllocationPage from './pages/reports/ResourceAllocationPage';
import CapacityDemandPage from './pages/reports/CapacityDemandPage';
import PodResourceSummaryPage from './pages/reports/PodResourceSummaryPage';
import PodSplitsPage from './pages/reports/PodSplitsPage';
import PodDetailPage from './pages/PodDetailPage';
import ProjectPodMatrixPage from './pages/reports/ProjectPodMatrixPage';
import ProjectGanttPage from './pages/reports/ProjectGanttPage';
import PodCapacityPage from './pages/reports/PodCapacityPage';
import JiraActualsPage from './pages/JiraActualsPage';
import PodDashboardPage from './pages/PodDashboardPage';
import TimelineSimulatorPage from './pages/simulators/TimelineSimulatorPage';
import ScenarioSimulatorPage from './pages/simulators/ScenarioSimulatorPage';
import TimelineSettingsPage from './pages/settings/TimelineSettingsPage';
import RefDataSettingsPage from './pages/settings/RefDataSettingsPage';
import JiraSettingsPage from './pages/settings/JiraSettingsPage';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* All other routes require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShellLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/pods" element={<PodsPage />} />
          <Route path="/pods/:id" element={<PodDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/overrides" element={<OverridesPage />} />
          <Route path="/reports/capacity-gap" element={<CapacityGapPage />} />
          <Route path="/reports/utilization" element={<UtilizationHeatmapPage />} />
          <Route path="/reports/hiring-forecast" element={<HiringForecastPage />} />
          <Route path="/reports/concurrency" element={<ConcurrencyRiskPage />} />
          <Route path="/reports/deadline-gap" element={<DeadlineGapPage />} />
          <Route path="/reports/resource-allocation" element={<ResourceAllocationPage />} />
          <Route path="/reports/capacity-demand" element={<CapacityDemandPage />} />
          <Route path="/reports/pod-resources" element={<PodResourceSummaryPage />} />
          <Route path="/reports/pod-splits" element={<PodSplitsPage />} />
          <Route path="/reports/project-pod-matrix" element={<ProjectPodMatrixPage />} />
          <Route path="/reports/gantt" element={<ProjectGanttPage />} />
          <Route path="/reports/pod-capacity" element={<PodCapacityPage />} />
          <Route path="/jira-actuals" element={<JiraActualsPage />} />
          <Route path="/jira-pods" element={<PodDashboardPage />} />
          <Route path="/simulator/timeline" element={<TimelineSimulatorPage />} />
          <Route path="/simulator/scenario" element={<ScenarioSimulatorPage />} />
          <Route path="/settings/timeline" element={<TimelineSettingsPage />} />
          <Route path="/settings/ref-data" element={<RefDataSettingsPage />} />
          <Route path="/settings/jira" element={<JiraSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
