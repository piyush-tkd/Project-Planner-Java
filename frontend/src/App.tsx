/**
 * App.tsx — Sprint 7 S7.10
 * All page imports converted to React.lazy for code-splitting.
 * Suspense fallback is provided by AppShell's main area.
 */
import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShellLayout from './components/layout/AppShell';
import ProtectedRoute from './auth/ProtectedRoute';

// ── Public / auth pages (keep eager — they load before AppShell) ─────────────
import LoginPage          from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import NotFoundPage       from './pages/NotFoundPage';

// ── Lazy-loaded page components ──────────────────────────────────────────────
const DashboardPage                 = lazy(() => import('./pages/DashboardPage'));
const ResourcesPage                 = lazy(() => import('./pages/ResourcesPage'));
const PodsPage                      = lazy(() => import('./pages/PodsPage'));
const ProjectsPage                  = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage             = lazy(() => import('./pages/ProjectDetailPage'));
const TeamsPage                     = lazy(() => import('./pages/TeamsPage'));
const TeamDetailPage                = lazy(() => import('./pages/TeamDetailPage'));
const AvailabilityPage              = lazy(() => import('./pages/AvailabilityPage'));
const OverridesPage                 = lazy(() => import('./pages/OverridesPage'));
const UtilizationCenterPage         = lazy(() => import('./pages/reports/UtilizationCenterPage'));
const HiringForecastPage            = lazy(() => import('./pages/reports/HiringForecastPage'));
const DeadlineGapPage               = lazy(() => import('./pages/reports/DeadlineGapPage'));
const BudgetPage                    = lazy(() => import('./pages/reports/BudgetPage'));
const CapacityDemandPage            = lazy(() => import('./pages/reports/CapacityDemandPage'));
const CapacityForecastPage          = lazy(() => import('./pages/reports/CapacityForecastPage'));
const SprintRetroPage               = lazy(() => import('./pages/reports/SprintRetroPage'));
const ResourceSkillsMatrixPage      = lazy(() => import('./pages/reports/ResourceSkillsMatrixPage'));
const RiskHeatmapPage               = lazy(() => import('./pages/reports/RiskHeatmapPage'));
const ExecSummaryPage               = lazy(() => import('./pages/reports/ExecSummaryPage'));
const StatusUpdatesFeedPage         = lazy(() => import('./pages/reports/StatusUpdatesFeedPage'));
const TeamPulsePage                 = lazy(() => import('./pages/reports/TeamPulsePage'));
const ChangelogAdminPage            = lazy(() => import('./pages/settings/ChangelogAdminPage'));
const CustomFieldsAdminPage         = lazy(() => import('./pages/settings/CustomFieldsAdminPage'));
const PodResourceSummaryPage        = lazy(() => import('./pages/reports/PodResourceSummaryPage'));
const PodSplitsPage                 = lazy(() => import('./pages/reports/PodSplitsPage'));
const PodDetailPage                 = lazy(() => import('./pages/PodDetailPage'));
const ProjectPodMatrixPage          = lazy(() => import('./pages/reports/ProjectPodMatrixPage'));
const PodCapacityPage               = lazy(() => import('./pages/reports/PodCapacityPage'));
const JiraActualsPage               = lazy(() => import('./pages/JiraActualsPage'));
const PodDashboardPage              = lazy(() => import('./pages/PodDashboardPage'));
const JiraPodDetailPage             = lazy(() => import('./pages/JiraPodDetailPage'));
const TimelineSimulatorPage         = lazy(() => import('./pages/simulators/TimelineSimulatorPage'));
const ScenarioSimulatorPage         = lazy(() => import('./pages/simulators/ScenarioSimulatorPage'));
const TimelineSettingsPage          = lazy(() => import('./pages/settings/TimelineSettingsPage'));
const RefDataSettingsPage           = lazy(() => import('./pages/settings/RefDataSettingsPage'));
const JiraSettingsPage              = lazy(() => import('./pages/settings/JiraSettingsPage'));
const ReleasesPage                  = lazy(() => import('./pages/ReleasesPage'));
const ReleaseSettingsPage           = lazy(() => import('./pages/settings/ReleaseSettingsPage'));
const JiraCredentialsPage           = lazy(() => import('./pages/settings/JiraCredentialsPage'));
const JiraCapexPage                 = lazy(() => import('./pages/JiraCapexPage'));
const JiraSupportPage               = lazy(() => import('./pages/JiraSupportPage'));
const JiraWorklogPage               = lazy(() => import('./pages/JiraWorklogPage'));
const SupportBoardsSettingsPage     = lazy(() => import('./pages/settings/SupportBoardsSettingsPage'));
const UserManagementPage            = lazy(() => import('./pages/settings/UserManagementPage'));
const AuditLogPage                  = lazy(() => import('./pages/settings/AuditLogPage'));
const TablesPage                    = lazy(() => import('./pages/settings/TablesPage'));
const TeamCalendarPage              = lazy(() => import('./pages/TeamCalendarPage'));
const OwnerDemandPage               = lazy(() => import('./pages/reports/OwnerDemandPage'));
const ProjectHealthPage             = lazy(() => import('./pages/reports/ProjectHealthPage'));
const ResourcePerformancePage       = lazy(() => import('./pages/reports/ResourcePerformancePage'));
const SprintCalendarPage            = lazy(() => import('./pages/SprintCalendarPage'));
const ReleaseCalendarPage           = lazy(() => import('./pages/ReleaseCalendarPage'));
const ReleaseNotesPage              = lazy(() => import('./pages/ReleaseNotesPage'));
const SprintPlanningRecommenderPage = lazy(() => import('./pages/SprintPlanningRecommenderPage'));
const NlpLandingPage                = lazy(() => import('./pages/NlpLandingPage'));
const NlpHistoryPage                = lazy(() => import('./pages/NlpHistoryPage'));
const NlpSettingsPage               = lazy(() => import('./pages/settings/NlpSettingsPage'));
const NlpOptimizerPage              = lazy(() => import('./pages/settings/NlpOptimizerPage'));
const FeedbackHubPage               = lazy(() => import('./pages/settings/FeedbackHubPage'));
const ErrorLogPage                  = lazy(() => import('./pages/settings/ErrorLogPage'));
const DoraMetricsPage               = lazy(() => import('./pages/reports/DoraMetricsPage'));
const JiraAnalyticsPage             = lazy(() => import('./pages/reports/JiraAnalyticsPage'));
const JiraDashboardBuilderPage      = lazy(() => import('./pages/reports/JiraDashboardBuilderPage'));
const EngineeringProductivityPage   = lazy(() => import('./pages/reports/EngineeringProductivityPage'));
const EngineeringIntelligencePage   = lazy(() => import('./pages/reports/EngineeringIntelligencePage'));
const SidebarOrderPage              = lazy(() => import('./pages/settings/SidebarOrderPage'));
const HolidayCalendarPage           = lazy(() => import('./pages/settings/HolidayCalendarPage'));
const LeaveManagementPage           = lazy(() => import('./pages/settings/LeaveManagementPage'));
const JiraResourceMappingPage       = lazy(() => import('./pages/settings/JiraResourceMappingPage'));
const JiraReleaseMappingPage        = lazy(() => import('./pages/settings/JiraReleaseMappingPage'));
const PortfolioHealthDashboardPage  = lazy(() => import('./pages/reports/PortfolioHealthDashboardPage'));
const JiraPortfolioSyncPage         = lazy(() => import('./pages/reports/JiraPortfolioSyncPage'));
const FinancialIntelligencePage     = lazy(() => import('./pages/reports/FinancialIntelligencePage'));
const DeliveryPredictabilityPage    = lazy(() => import('./pages/reports/DeliveryPredictabilityPage'));
const SmartNotificationsPage        = lazy(() => import('./pages/reports/SmartNotificationsPage'));
const PodHoursPage                  = lazy(() => import('./pages/reports/PodHoursPage'));
const DependencyMapPage             = lazy(() => import('./pages/reports/DependencyMapPage'));
const PortfolioTimelinePage         = lazy(() => import('./pages/reports/PortfolioTimelinePage'));
const ResourceIntelligencePage      = lazy(() => import('./pages/reports/ResourceIntelligencePage'));
const BudgetCapexPage               = lazy(() => import('./pages/reports/BudgetCapexPage'));
const ProjectSignalsPage            = lazy(() => import('./pages/reports/ProjectSignalsPage'));
const ResourceBookingsPage          = lazy(() => import('./pages/ResourceBookingsPage'));
const ProjectTemplatesPage          = lazy(() => import('./pages/ProjectTemplatesPage'));
const WorkloadChartPage             = lazy(() => import('./pages/WorkloadChartPage'));
const GanttDependenciesPage         = lazy(() => import('./pages/GanttDependenciesPage'));
const ResourcePoolsPage             = lazy(() => import('./pages/ResourcePoolsPage'));
const SupplyDemandPage              = lazy(() => import('./pages/SupplyDemandPage'));
const EngineeringEconomicsPage      = lazy(() => import('./pages/EngineeringEconomicsPage'));
const ROICalculatorPage             = lazy(() => import('./pages/ROICalculatorPage'));
const OrgSettingsPage               = lazy(() => import('./pages/settings/OrgSettingsPage'));
const SmartMappingPage              = lazy(() => import('./pages/SmartMappingPage'));
const InboxPage                     = lazy(() => import('./pages/InboxPage'));
const AzureDevOpsSettingsPage       = lazy(() => import('./pages/settings/AzureDevOpsSettingsPage'));
const ObjectivesPage                = lazy(() => import('./pages/ObjectivesPage'));
const RiskRegisterPage              = lazy(() => import('./pages/RiskRegisterPage'));
const IdeasBoardPage                = lazy(() => import('./pages/IdeasBoardPage'));
const CalendarHubPage               = lazy(() => import('./pages/CalendarHubPage'));
const CapacityHubPage               = lazy(() => import('./pages/CapacityHubPage'));
const LeaveHubPage                  = lazy(() => import('./pages/LeaveHubPage'));
const AutomationEnginePage          = lazy(() => import('./pages/AutomationEnginePage'));
const SmartInsightsPage             = lazy(() => import('./pages/SmartInsightsPage'));
const NotificationPreferencesPage   = lazy(() => import('./pages/settings/NotificationPreferencesPage'));
const WebhookSettingsPage           = lazy(() => import('./pages/settings/WebhookSettingsPage'));
const EmailTemplatesPage            = lazy(() => import('./pages/settings/EmailTemplatesPage'));
const CustomDashboardPage           = lazy(() => import('./pages/CustomDashboardPage'));
const ProjectApprovalPage           = lazy(() => import('./pages/ProjectApprovalPage'));
const BulkImportPage                = lazy(() => import('./pages/BulkImportPage'));
const AdvancedTimelinePage          = lazy(() => import('./pages/AdvancedTimelinePage'));
const SprintBacklogPage             = lazy(() => import('./pages/SprintBacklogPage'));
const ScheduledReportsPage          = lazy(() => import('./pages/settings/ScheduledReportsPage'));
const AiContentStudioPage           = lazy(() => import('./pages/AiContentStudioPage'));
const CostRatesPage                 = lazy(() => import('./pages/settings/CostRatesPage'));
const SettingsHubPage               = lazy(() => import('./pages/settings/SettingsHubPage'));

// ── DL-9: Tabbed consolidation pages ─────────────────────────────────────────
const PortfolioHealthTabs  = lazy(() => import('./pages/tabs/PortfolioHealthTabs'));
const PortfolioTimelineTabs= lazy(() => import('./pages/tabs/PortfolioTimelineTabs'));
const ResourcesTabs        = lazy(() => import('./pages/tabs/ResourcesTabs'));
const CapacityTabs         = lazy(() => import('./pages/tabs/CapacityTabs'));
const PerformanceTabs      = lazy(() => import('./pages/tabs/PerformanceTabs'));
const ReleasesTabs         = lazy(() => import('./pages/tabs/ReleasesTabs'));
const JiraDashboardTabs    = lazy(() => import('./pages/tabs/JiraDashboardTabs'));
const EngineeringHubTabs   = lazy(() => import('./pages/tabs/EngineeringHubTabs'));
const ScenarioToolsTabs    = lazy(() => import('./pages/tabs/ScenarioToolsTabs'));

// ── Sprint 6, 11, 15: New Pages ─────────────────────────────────────────────
const DemandForecastPage   = lazy(() => import('./pages/DemandForecastPage'));
const SkillsMatrixPage     = lazy(() => import('./pages/SkillsMatrixPage'));
const ScenarioPlanningPage = lazy(() => import('./pages/ScenarioPlanningPage'));

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/reset-password"   element={<ResetPasswordPage />} />

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

          <Route element={<ProtectedRoute pageKey="teams" />}>
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
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

          {/* ── Sprint 8 Resource Pools ───────────────────────── */}
          <Route element={<ProtectedRoute pageKey="resource_pools" />}>
            <Route path="/resource-pools" element={<ResourcePoolsPage />} />
            <Route path="/resource-pools/:id" element={<ResourcePoolsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="supply_demand" />}>
            <Route path="/supply-demand" element={<SupplyDemandPage />} />
          </Route>

          {/* ── Sprint 13 Engineering Economics ───────────────── */}
          <Route element={<ProtectedRoute pageKey="engineering_economics" />}>
            <Route path="/engineering-economics" element={<EngineeringEconomicsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="roi_calculator" />}>
            <Route path="/roi-calculator" element={<ROICalculatorPage />} />
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

          <Route element={<ProtectedRoute pageKey="capacity_forecast" />}>
            <Route path="/reports/capacity-forecast" element={<CapacityForecastPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="sprint_retro" />}>
            <Route path="/reports/sprint-retro" element={<SprintRetroPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="sprint_backlog" />}>
            <Route path="/sprint-backlog" element={<SprintBacklogPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="skills_matrix" />}>
            <Route path="/reports/skills-matrix" element={<ResourceSkillsMatrixPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="risk_heatmap" />}>
            <Route path="/reports/risk-heatmap" element={<RiskHeatmapPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="exec_summary" />}>
            <Route path="/reports/executive-summary" element={<ExecSummaryPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="status_updates" />}>
            <Route path="/reports/status-updates" element={<StatusUpdatesFeedPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="team_pulse" />}>
            <Route path="/reports/team-pulse" element={<TeamPulsePage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="changelog_admin" />}>
            <Route path="/settings/changelog" element={<ChangelogAdminPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="automation_engine" />}>
            <Route path="/automation-engine" element={<AutomationEnginePage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="custom_fields_admin" />}>
            <Route path="/settings/custom-fields" element={<CustomFieldsAdminPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="smart_insights" />}>
            <Route path="/smart-insights" element={<SmartInsightsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="notification_preferences" />}>
            <Route path="/settings/notification-preferences" element={<NotificationPreferencesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="custom_dashboard" />}>
            <Route path="/custom-dashboard" element={<CustomDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="project_approvals" />}>
            <Route path="/approvals" element={<ProjectApprovalPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="bulk_import" />}>
            <Route path="/bulk-import" element={<BulkImportPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="advanced_timeline" />}>
            <Route path="/advanced-timeline" element={<AdvancedTimelinePage />} />
          </Route>

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

          {/* ── Sprint 6, 11, 15: Demand, Skills, Scenario Planning ────────── */}
          <Route element={<ProtectedRoute pageKey="demand_forecast" />}>
            <Route path="/demand-forecast" element={<DemandForecastPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="skills_matrix_new" />}>
            <Route path="/skills-matrix" element={<SkillsMatrixPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="scenario_planning" />}>
            <Route path="/scenario-planning" element={<ScenarioPlanningPage />} />
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

          <Route element={<ProtectedRoute pageKey="nlp_history" />}>
            <Route path="/nlp/history" element={<NlpHistoryPage />} />
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
            <Route path="/settings" element={<SettingsHubPage />} />
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

          <Route element={<ProtectedRoute pageKey="email_templates" />}>
            <Route path="/settings/email-templates" element={<EmailTemplatesPage />} />
          </Route>
          <Route element={<ProtectedRoute pageKey="webhook_settings" />}>
            <Route path="/settings/webhooks" element={<WebhookSettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="scheduled_reports" />}>
            <Route path="/settings/scheduled-reports" element={<ScheduledReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="cost_rates" />}>
            <Route path="/settings/cost-rates" element={<CostRatesPage />} />
          </Route>

          <Route element={<ProtectedRoute pageKey="ai_content_studio" />}>
            <Route path="/ai-content-studio" element={<AiContentStudioPage />} />
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

          {/* Admin-only pages — guarded by org_settings permission */}
          <Route element={<ProtectedRoute pageKey="org_settings" />}>
            <Route path="/settings/users" element={<UserManagementPage />} />
            <Route path="/settings/audit-log" element={<AuditLogPage />} />
            <Route path="/settings/tables" element={<TablesPage />} />
          </Route>

          {/* ── DL-9: Consolidated tabbed pages ──────────────────────────────── */}
          {/* Portfolio Health → tabs: Overview | Project Health | Status Updates  */}
          <Route element={<ProtectedRoute pageKey="portfolio_health_dashboard" />}>
            <Route path="/portfolio/health" element={<PortfolioHealthTabs />} />
          </Route>
          {/* Portfolio Timeline → tabs: Timeline | Gantt & Dependencies           */}
          <Route element={<ProtectedRoute pageKey="portfolio_timeline" />}>
            <Route path="/portfolio/timeline" element={<PortfolioTimelineTabs />} />
          </Route>
          {/* Resources → tabs: Directory | Availability | Bookings               */}
          <Route element={<ProtectedRoute pageKey="resources" />}>
            <Route path="/people/resources" element={<ResourcesTabs />} />
          </Route>
          {/* Capacity → tabs: Capacity | Overrides | Leave                       */}
          <Route element={<ProtectedRoute pageKey="capacity_hub" />}>
            <Route path="/people/capacity" element={<CapacityTabs />} />
          </Route>
          {/* Performance → tabs: Resource Performance | Resource Intelligence    */}
          <Route element={<ProtectedRoute pageKey="resource_performance" />}>
            <Route path="/people/performance" element={<PerformanceTabs />} />
          </Route>
          {/* Releases → tabs: Releases | Release Notes                           */}
          <Route element={<ProtectedRoute pageKey="jira_releases" />}>
            <Route path="/delivery/releases" element={<ReleasesTabs />} />
          </Route>
          {/* Jira Dashboard → tabs: Pods | Actuals | Support | Worklog           */}
          <Route element={<ProtectedRoute pageKey="jira_pods" />}>
            <Route path="/delivery/jira" element={<JiraDashboardTabs />} />
          </Route>
          {/* Engineering Hub → tabs: Intelligence | DORA | Predictability        */}
          <Route element={<ProtectedRoute pageKey="engineering_intelligence" />}>
            <Route path="/engineering/hub" element={<EngineeringHubTabs />} />
          </Route>
          {/* Scenario Tools → tabs: Timeline Sim | Scenario Sim                 */}
          <Route element={<ProtectedRoute pageKey="timeline_simulator" />}>
            <Route path="/tools/scenarios" element={<ScenarioToolsTabs />} />
          </Route>

          {/* ── DL-9 backward-compat redirects — keep old bookmarks working ── */}
          <Route path="/resources"                         element={<Navigate to="/people/resources" replace />} />
          <Route path="/availability"                      element={<Navigate to="/people/resources?tab=availability" replace />} />
          <Route path="/resource-bookings"                 element={<Navigate to="/people/resources?tab=bookings" replace />} />
          <Route path="/capacity"                          element={<Navigate to="/people/capacity" replace />} />
          <Route path="/reports/portfolio-health-dashboard" element={<Navigate to="/portfolio/health" replace />} />
          <Route path="/reports/portfolio-timeline"        element={<Navigate to="/portfolio/timeline" replace />} />
          <Route path="/reports/gantt-dependencies"        element={<Navigate to="/portfolio/timeline?tab=gantt" replace />} />
          <Route path="/jira-releases"                     element={<Navigate to="/delivery/releases" replace />} />
          <Route path="/jira-pods"                         element={<Navigate to="/delivery/jira" replace />} />
          <Route path="/reports/engineering-intelligence"  element={<Navigate to="/engineering/hub" replace />} />
          <Route path="/simulator/timeline"                element={<Navigate to="/tools/scenarios" replace />} />
          <Route path="/delivery/sprint-backlog"           element={<Navigate to="/sprint-backlog" replace />} />
          <Route path="/delivery/sprint-retro"            element={<Navigate to="/reports/sprint-retro" replace />} />

        </Route>
      </Route>

      {/* ── 404 catch-all — must be last ─────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
  );
}
