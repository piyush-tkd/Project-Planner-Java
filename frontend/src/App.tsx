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
import BudgetPage from './pages/reports/BudgetPage';
import CapacityDemandPage from './pages/reports/CapacityDemandPage';
import PodResourceSummaryPage from './pages/reports/PodResourceSummaryPage';
import PodSplitsPage from './pages/reports/PodSplitsPage';
import PodDetailPage from './pages/PodDetailPage';
import ProjectPodMatrixPage from './pages/reports/ProjectPodMatrixPage';
import ProjectGanttPage from './pages/reports/ProjectGanttPage';
import PodCapacityPage from './pages/reports/PodCapacityPage';
import JiraActualsPage from './pages/JiraActualsPage';
import PodDashboardPage from './pages/PodDashboardPage';
import JiraPodDetailPage from './pages/JiraPodDetailPage';
import TimelineSimulatorPage from './pages/simulators/TimelineSimulatorPage';
import ScenarioSimulatorPage from './pages/simulators/ScenarioSimulatorPage';
import TimelineSettingsPage from './pages/settings/TimelineSettingsPage';
import RefDataSettingsPage from './pages/settings/RefDataSettingsPage';
import JiraSettingsPage from './pages/settings/JiraSettingsPage';
import ReleasesPage from './pages/ReleasesPage';
import ReleaseSettingsPage from './pages/settings/ReleaseSettingsPage';
import JiraCredentialsPage from './pages/settings/JiraCredentialsPage';
import JiraCapexPage from './pages/JiraCapexPage';
import JiraSupportPage from './pages/JiraSupportPage';
import JiraWorklogPage from './pages/JiraWorklogPage';
import SupportBoardsSettingsPage from './pages/settings/SupportBoardsSettingsPage';
import UserManagementPage from './pages/settings/UserManagementPage';
import AuditLogPage from './pages/settings/AuditLogPage';
import TablesPage from './pages/settings/TablesPage';
import TeamCalendarPage from './pages/TeamCalendarPage';
import PodProjectMatrixPage from './pages/reports/PodProjectMatrixPage';
import SlackBufferPage from './pages/reports/SlackBufferPage';
import ResourcePodMatrixPage from './pages/reports/ResourcePodMatrixPage';
import OwnerDemandPage from './pages/reports/OwnerDemandPage';
import CrossPodDependencyPage from './pages/reports/CrossPodDependencyPage';
import ProjectHealthPage from './pages/reports/ProjectHealthPage';
import ResourceROIPage from './pages/reports/ResourceROIPage';
import SprintCalendarPage from './pages/SprintCalendarPage';
import ReleaseCalendarPage from './pages/ReleaseCalendarPage';
import ReleaseNotesPage from './pages/ReleaseNotesPage';
import SprintPlanningRecommenderPage from './pages/SprintPlanningRecommenderPage';
import NlpLandingPage from './pages/NlpLandingPage';

import NlpSettingsPage from './pages/settings/NlpSettingsPage';
import NlpOptimizerPage from './pages/settings/NlpOptimizerPage';
import FeedbackHubPage from './pages/settings/FeedbackHubPage';
import ErrorLogPage from './pages/settings/ErrorLogPage';
import DoraMetricsPage from './pages/reports/DoraMetricsPage';
import JiraAnalyticsPage from './pages/reports/JiraAnalyticsPage';
import JiraDashboardBuilderPage from './pages/reports/JiraDashboardBuilderPage';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* All other routes require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShellLayout />}>

          {/* ── Core ─────────────────────────────────────────── */}
          <Route path="/" element={<ProtectedRoute pageKey="dashboard" />}>
            <Route index element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="resources" />}>
            <Route path="/resources" element={<ResourcesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pods" />}>
            <Route path="/pods" element={<PodsPage />} />
            <Route path="/pods/:id" element={<PodDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="projects" />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="availability" />}>
            <Route path="/availability" element={<AvailabilityPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="overrides" />}>
            <Route path="/overrides" element={<OverridesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="team_calendar" />}>
            <Route path="/team-calendar" element={<TeamCalendarPage />} />
          </Route>

          {/* ── Capacity Reports ─────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="capacity_gap" />}>
            <Route path="/reports/capacity-gap" element={<CapacityGapPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="utilization" />}>
            <Route path="/reports/utilization" element={<UtilizationHeatmapPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="slack_buffer" />}>
            <Route path="/reports/slack-buffer" element={<SlackBufferPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="hiring_forecast" />}>
            <Route path="/reports/hiring-forecast" element={<HiringForecastPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="concurrency_risk" />}>
            <Route path="/reports/concurrency" element={<ConcurrencyRiskPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="capacity_demand" />}>
            <Route path="/reports/capacity-demand" element={<CapacityDemandPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_resources" />}>
            <Route path="/reports/pod-resources" element={<PodResourceSummaryPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_capacity" />}>
            <Route path="/reports/pod-capacity" element={<PodCapacityPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="resource_pod_matrix" />}>
            <Route path="/reports/resource-pod-matrix" element={<ResourcePodMatrixPage />} />
          </Route>

          {/* ── Portfolio Analysis ───────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="project_health" />}>
            <Route path="/reports/project-health" element={<ProjectHealthPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="cross_pod_deps" />}>
            <Route path="/reports/cross-pod" element={<CrossPodDependencyPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="owner_demand" />}>
            <Route path="/reports/owner-demand" element={<OwnerDemandPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="deadline_gap" />}>
            <Route path="/reports/deadline-gap" element={<DeadlineGapPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="resource_allocation" />}>
            <Route path="/reports/resource-allocation" element={<ResourceAllocationPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_splits" />}>
            <Route path="/reports/pod-splits" element={<PodSplitsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_project_matrix" />}>
            <Route path="/reports/pod-project-matrix" element={<PodProjectMatrixPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="project_pod_matrix" />}>
            <Route path="/reports/project-pod-matrix" element={<ProjectPodMatrixPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="project_gantt" />}>
            <Route path="/reports/gantt" element={<ProjectGanttPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="budget" />}>
            <Route path="/reports/budget" element={<BudgetPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="resource_roi" />}>
            <Route path="/reports/resource-roi" element={<ResourceROIPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="dora_metrics" />}>
            <Route path="/reports/dora" element={<DoraMetricsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_analytics" />}>
            <Route path="/reports/jira-analytics" element={<JiraAnalyticsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_dashboard_builder" />}>
            <Route path="/reports/jira-dashboard-builder" element={<JiraDashboardBuilderPage />} />
          </Route>

          {/* ── Integrations ─────────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="jira_pods" />}>
            <Route path="/jira-pods" element={<PodDashboardPage />} />
            <Route path="/jira-pods/:id" element={<JiraPodDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_releases" />}>
            <Route path="/jira-releases" element={<ReleasesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="release_notes" />}>
            <Route path="/release-notes" element={<ReleaseNotesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_capex" />}>
            <Route path="/jira-capex" element={<JiraCapexPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_actuals" />}>
            <Route path="/jira-actuals" element={<JiraActualsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_support" />}>
            <Route path="/jira-support" element={<JiraSupportPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_worklog" />}>
            <Route path="/jira-worklog" element={<JiraWorklogPage />} />
          </Route>

          {/* ── Simulators ───────────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="timeline_simulator" />}>
            <Route path="/simulator/timeline" element={<TimelineSimulatorPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="scenario_simulator" />}>
            <Route path="/simulator/scenario" element={<ScenarioSimulatorPage />} />
          </Route>

          {/* ── Sprint & Release Calendar ───────────────────── */}
          <Route element={<ProtectedRoute pageKey="sprint_calendar" />}>
            <Route path="/sprint-calendar" element={<SprintCalendarPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="release_calendar" />}>
            <Route path="/release-calendar" element={<ReleaseCalendarPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="sprint_planner" />}>
            <Route path="/sprint-planner" element={<SprintPlanningRecommenderPage />} />
          </Route>

          {/* ── NLP ──────────────────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="nlp_landing" />}>
            <Route path="/nlp" element={<NlpLandingPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="nlp_settings" />}>
            <Route path="/settings/nlp" element={<NlpSettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="nlp_optimizer" />}>
            <Route path="/settings/nlp-optimizer" element={<NlpOptimizerPage />} />
          </Route>

          {/* ── Feedback & Error Logs ─────────────────────── */}
          <Route element={<ProtectedRoute pageKey="feedback_hub" />}>
            <Route path="/settings/feedback-hub" element={<FeedbackHubPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="error_log" />}>
            <Route path="/settings/error-log" element={<ErrorLogPage />} />
          </Route>

          {/* ── Settings ─────────────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="settings" />}>
            <Route path="/settings/timeline" element={<TimelineSettingsPage />} />
            <Route path="/settings/ref-data" element={<RefDataSettingsPage />} />
            <Route path="/settings/jira" element={<JiraSettingsPage />} />
            <Route path="/settings/releases" element={<ReleaseSettingsPage />} />
            <Route path="/settings/jira-credentials" element={<JiraCredentialsPage />} />
            <Route path="/settings/support-boards" element={<SupportBoardsSettingsPage />} />
          </Route>

          {/* Admin-only pages — no pageKey needed (nav already hides them) */}
          <Route path="/settings/users" element={<UserManagementPage />} />
          <Route path="/settings/audit-log" element={<AuditLogPage />} />
          <Route path="/settings/tables" element={<TablesPage />} />

        </Route>
      </Route>
    </Routes>
  );
}
