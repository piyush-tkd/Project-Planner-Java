import { Routes, Route, Navigate } from 'react-router-dom';
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
import UtilizationCenterPage from './pages/reports/UtilizationCenterPage';
import HiringForecastPage from './pages/reports/HiringForecastPage';
import DeadlineGapPage from './pages/reports/DeadlineGapPage';
import BudgetPage from './pages/reports/BudgetPage';
import CapacityDemandPage from './pages/reports/CapacityDemandPage';
import CapacityForecastPage from './pages/reports/CapacityForecastPage';
import SprintRetroPage from './pages/reports/SprintRetroPage';
import ResourceSkillsMatrixPage from './pages/reports/ResourceSkillsMatrixPage';
import RiskHeatmapPage from './pages/reports/RiskHeatmapPage';
import ExecSummaryPage from './pages/reports/ExecSummaryPage';
import StatusUpdatesFeedPage from './pages/reports/StatusUpdatesFeedPage';
import TeamPulsePage from './pages/reports/TeamPulsePage';
import ChangelogAdminPage from './pages/settings/ChangelogAdminPage';
import CustomFieldsAdminPage from './pages/settings/CustomFieldsAdminPage';
import PodResourceSummaryPage from './pages/reports/PodResourceSummaryPage';
import PodSplitsPage from './pages/reports/PodSplitsPage';
import PodDetailPage from './pages/PodDetailPage';
import ProjectPodMatrixPage from './pages/reports/ProjectPodMatrixPage';
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
import OwnerDemandPage from './pages/reports/OwnerDemandPage';
import ProjectHealthPage from './pages/reports/ProjectHealthPage';
import ResourcePerformancePage from './pages/reports/ResourcePerformancePage';
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
import EngineeringProductivityPage from './pages/reports/EngineeringProductivityPage';
import EngineeringIntelligencePage from './pages/reports/EngineeringIntelligencePage';
import SidebarOrderPage from './pages/settings/SidebarOrderPage';
import HolidayCalendarPage from './pages/settings/HolidayCalendarPage';
import LeaveManagementPage from './pages/settings/LeaveManagementPage';
import JiraResourceMappingPage from './pages/settings/JiraResourceMappingPage';
import JiraReleaseMappingPage from './pages/settings/JiraReleaseMappingPage';
import PortfolioHealthDashboardPage from './pages/reports/PortfolioHealthDashboardPage';
import JiraPortfolioSyncPage from './pages/reports/JiraPortfolioSyncPage';
import FinancialIntelligencePage from './pages/reports/FinancialIntelligencePage';
import DeliveryPredictabilityPage from './pages/reports/DeliveryPredictabilityPage';
import SmartNotificationsPage from './pages/reports/SmartNotificationsPage';
import PodHoursPage from './pages/reports/PodHoursPage';
import DependencyMapPage from './pages/reports/DependencyMapPage';
import PortfolioTimelinePage from './pages/reports/PortfolioTimelinePage';
import ResourceIntelligencePage from './pages/reports/ResourceIntelligencePage';
import BudgetCapexPage from './pages/reports/BudgetCapexPage';
import ProjectSignalsPage from './pages/reports/ProjectSignalsPage';
import ResourceBookingsPage from './pages/ResourceBookingsPage';
import ProjectTemplatesPage from './pages/ProjectTemplatesPage';
import WorkloadChartPage from './pages/WorkloadChartPage';
import GanttDependenciesPage from './pages/GanttDependenciesPage';
import OrgSettingsPage from './pages/settings/OrgSettingsPage';
import SmartMappingPage from './pages/SmartMappingPage';
import InboxPage from './pages/InboxPage';
import AzureDevOpsSettingsPage from './pages/settings/AzureDevOpsSettingsPage';
import ObjectivesPage from './pages/ObjectivesPage';
import RiskRegisterPage from './pages/RiskRegisterPage';
import IdeasBoardPage from './pages/IdeasBoardPage';
import CalendarHubPage from './pages/CalendarHubPage';
import CapacityHubPage from './pages/CapacityHubPage';
import LeaveHubPage from './pages/LeaveHubPage';


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

          {/* ── Phase 1/5 New Pages ───────────────────────── */}
          <Route element={<ProtectedRoute pageKey="inbox" />}>
            <Route path="/inbox" element={<InboxPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="objectives" />}>
            <Route path="/objectives" element={<ObjectivesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="risk_register" />}>
            <Route path="/risk-register" element={<RiskRegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="ideas_board" />}>
            <Route path="/ideas" element={<IdeasBoardPage />} />
          </Route>

          {/* ── Phase 2/3 Merged Hub Pages ────────────────── */}
          <Route element={<ProtectedRoute pageKey="calendar_hub" />}>
            <Route path="/calendar" element={<CalendarHubPage />} />
          </Route>
          {/* Team calendar legacy redirect */}
          <Route path="/settings/holiday-calendar" element={<Navigate to="/leave" replace />} />

          <Route element={<ProtectedRoute pageKey="capacity_hub" />}>
            <Route path="/capacity" element={<CapacityHubPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="leave_hub" />}>
            <Route path="/leave" element={<LeaveHubPage />} />
          </Route>
          {/* Legacy leave route redirect */}
          <Route path="/settings/leave-management" element={<Navigate to="/leave" replace />} />

          <Route element={<ProtectedRoute pageKey="overrides" />}>
            <Route path="/overrides" element={<OverridesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="team_calendar" />}>
            <Route path="/team-calendar" element={<TeamCalendarPage />} />
          </Route>

          {/* ── Capacity Reports ─────────────────────────────── */}
          {/* Merged Utilization Center (replaces capacity-gap, utilization, slack-buffer) */}
          <Route element={<ProtectedRoute pageKey="utilization" />}>
            <Route path="/reports/utilization" element={<UtilizationCenterPage />} />
          </Route>

          {/* Legacy redirects — keep old URLs working */}
          <Route path="/reports/capacity-gap" element={<Navigate to="/reports/utilization" replace />} />
          <Route path="/reports/slack-buffer" element={<Navigate to="/reports/utilization" replace />} />

          <Route element={<ProtectedRoute pageKey="hiring_forecast" />}>
            <Route path="/reports/hiring-forecast" element={<HiringForecastPage />} />
          </Route>

          {/* Concurrency Risk is now a tab inside UtilizationCenter — redirect legacy URL */}
          <Route path="/reports/concurrency" element={<Navigate to="/reports/utilization" replace />} />

          <Route element={<ProtectedRoute pageKey="capacity_demand" />}>
            <Route path="/reports/capacity-demand" element={<CapacityDemandPage />} />
          </Route>

          <Route path="/reports/capacity-forecast" element={<CapacityForecastPage />} />
          <Route path="/reports/sprint-retro" element={<SprintRetroPage />} />
          <Route path="/reports/skills-matrix" element={<ResourceSkillsMatrixPage />} />
          <Route path="/reports/risk-heatmap" element={<RiskHeatmapPage />} />
          <Route path="/reports/executive-summary" element={<ExecSummaryPage />} />
          <Route path="/reports/status-updates" element={<StatusUpdatesFeedPage />} />
          <Route path="/reports/team-pulse" element={<TeamPulsePage />} />
          <Route path="/settings/changelog" element={<ChangelogAdminPage />} />
          <Route path="/settings/custom-fields" element={<CustomFieldsAdminPage />} />

          <Route element={<ProtectedRoute pageKey="pod_resources" />}>
            <Route path="/reports/pod-resources" element={<PodResourceSummaryPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_capacity" />}>
            <Route path="/reports/pod-capacity" element={<PodCapacityPage />} />
          </Route>

          {/* Resource Intelligence — consolidates Allocation, POD Matrix, ROI, Forecast */}
          <Route element={<ProtectedRoute pageKey="resource_intelligence" />}>
            <Route path="/reports/resource-intelligence" element={<ResourceIntelligencePage />} />
          </Route>

          {/* Legacy redirects for merged resource pages */}
          <Route path="/reports/resource-pod-matrix"  element={<Navigate to="/reports/resource-intelligence" replace />} />
          <Route path="/reports/resource-allocation"  element={<Navigate to="/reports/resource-intelligence" replace />} />
          <Route path="/reports/resource-roi"         element={<Navigate to="/reports/resource-intelligence" replace />} />
          <Route path="/reports/resource-forecast"    element={<Navigate to="/reports/resource-intelligence" replace />} />

          {/* ── Portfolio Analysis ───────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="project_health" />}>
            <Route path="/reports/project-health" element={<ProjectHealthPage />} />
          </Route>

          {/* Dependency Map — consolidates Cross-POD + Team Dependencies */}
          <Route element={<ProtectedRoute pageKey="dependency_map" />}>
            <Route path="/reports/dependency-map" element={<DependencyMapPage />} />
          </Route>

          {/* Legacy redirects for merged dependency pages */}
          <Route path="/reports/cross-pod"              element={<Navigate to="/reports/dependency-map" replace />} />
          <Route path="/reports/cross-team-dependency"  element={<Navigate to="/reports/dependency-map" replace />} />

          {/* Portfolio Timeline — consolidates Roadmap + Gantt + Team Calendar */}
          <Route element={<ProtectedRoute pageKey="portfolio_timeline" />}>
            <Route path="/reports/portfolio-timeline" element={<PortfolioTimelinePage />} />
          </Route>

          {/* Legacy redirects for merged timeline pages */}
          <Route path="/reports/roadmap-timeline" element={<Navigate to="/reports/portfolio-timeline" replace />} />
          <Route path="/reports/gantt"            element={<Navigate to="/reports/portfolio-timeline" replace />} />

          {/* Project Signals — consolidates Owner Demand + Deadline Gap + POD Splits */}
          <Route element={<ProtectedRoute pageKey="project_signals" />}>
            <Route path="/reports/project-signals" element={<ProjectSignalsPage />} />
          </Route>

          {/* Legacy redirects for merged project-signal pages */}
          <Route path="/reports/owner-demand" element={<Navigate to="/reports/project-signals" replace />} />
          <Route path="/reports/deadline-gap" element={<Navigate to="/reports/project-signals" replace />} />
          <Route path="/reports/pod-splits"   element={<Navigate to="/reports/project-signals" replace />} />

          {/* Merged POD·Project Matrix (grid + list tabs) */}
          <Route element={<ProtectedRoute pageKey="project_pod_matrix" />}>
            <Route path="/reports/project-pod-matrix" element={<ProjectPodMatrixPage />} />
          </Route>

          {/* Legacy redirect from old separate grid page */}
          <Route path="/reports/pod-project-matrix" element={<Navigate to="/reports/project-pod-matrix" replace />} />

          {/* Budget & CapEx — consolidates Budget/Cost + CapEx/OpEx */}
          <Route element={<ProtectedRoute pageKey="budget_capex" />}>
            <Route path="/reports/budget-capex" element={<BudgetCapexPage />} />
          </Route>

          {/* Legacy redirects for merged budget/capex pages */}
          <Route path="/reports/budget" element={<Navigate to="/reports/budget-capex" replace />} />
          <Route path="/jira-capex"     element={<Navigate to="/reports/budget-capex" replace />} />

          <Route element={<ProtectedRoute pageKey="resource_performance" />}>
            <Route path="/reports/resource-performance" element={<ResourcePerformancePage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="pod_hours" />}>
            <Route path="/reports/pod-hours" element={<PodHoursPage />} />
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

          <Route element={<ProtectedRoute pageKey="engineering_intelligence" />}>
            <Route path="/reports/engineering-intelligence" element={<EngineeringIntelligencePage />} />
          </Route>
          {/* Legacy redirects — keep old bookmarks working */}
          <Route path="/reports/engineering-productivity" element={<Navigate to="/reports/engineering-intelligence" replace />} />

          {/* ── Strategic Insights ────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="portfolio_health_dashboard" />}>
            <Route path="/reports/portfolio-health-dashboard" element={<PortfolioHealthDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_portfolio_sync" />}>
            <Route path="/reports/jira-portfolio-sync" element={<JiraPortfolioSyncPage />} />
          </Route>

          <Route path="/reports/financial-intelligence" element={<Navigate to="/reports/engineering-intelligence" replace />} />

          <Route element={<ProtectedRoute pageKey="delivery_predictability" />}>
            <Route path="/reports/delivery-predictability" element={<DeliveryPredictabilityPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="smart_notifications" />}>
            <Route path="/reports/smart-notifications" element={<SmartNotificationsPage />} />
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

          <Route element={<ProtectedRoute pageKey="jira_resource_mapping" />}>
            <Route path="/settings/jira-resource-mapping" element={<JiraResourceMappingPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="jira_release_mapping" />}>
            <Route path="/settings/jira-release-mapping" element={<JiraReleaseMappingPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="sidebar_order" />}>
            <Route path="/settings/sidebar-order" element={<SidebarOrderPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="org_settings" />}>
            <Route path="/settings/org" element={<OrgSettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="azure_devops_settings" />}>
            <Route path="/settings/azure-devops" element={<AzureDevOpsSettingsPage />} />
          </Route>

          {/* /settings/holiday-calendar and /settings/leave-management
              redirect to /leave hub — see Phase 2 redirects above */}

          {/* ── Resource Bookings & Templates ─────────────────── */}
          <Route element={<ProtectedRoute pageKey="resource_bookings" />}>
            <Route path="/resource-bookings" element={<ResourceBookingsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="project_templates" />}>
            <Route path="/project-templates" element={<ProjectTemplatesPage />} />
          </Route>

          {/* ── New Reports ──────────────────────────────────── */}
          <Route element={<ProtectedRoute pageKey="workload_chart" />}>
            <Route path="/reports/workload-chart" element={<WorkloadChartPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="gantt_dependencies" />}>
            <Route path="/reports/gantt-dependencies" element={<GanttDependenciesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="smart_mapping_admin" />}>
            <Route path="/settings/smart-mapping" element={<SmartMappingPage />} />
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
