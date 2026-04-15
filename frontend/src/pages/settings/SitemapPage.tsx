import { Title, Text, Stack, Group, Card, Badge, Grid, Box, Container } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA, DEEP_BLUE } from '../../brandTokens';

interface PageItem {
  label: string;
  path: string;
  featureFlag?: string;
  note?: string;
}

interface SectionGroup {
  label: string;
  pages: PageItem[];
}

const SITEMAP_DATA: SectionGroup[] = [
  {
    label: 'Workspace',
    pages: [
      { label: 'Dashboard', path: '/' },
      { label: 'Inbox', path: '/inbox' },
      { label: 'Ask AI', path: '/nlp', featureFlag: 'ai' },
      { label: 'AI Content Studio', path: '/ai-content-studio', featureFlag: 'ai' },
      { label: 'Smart Insights', path: '/smart-insights' },
    ],
  },
  {
    label: 'Portfolio',
    pages: [
      { label: 'Projects', path: '/projects' },
      { label: 'Portfolio Health', path: '/portfolio/health' },
      { label: 'Executive Summary', path: '/reports/executive-summary' },
      { label: 'Timeline', path: '/portfolio/timeline' },
      { label: 'Risk & Issues', path: '/risk-register', featureFlag: 'risk' },
      { label: 'Risk Heatmap', path: '/reports/risk-heatmap' },
      { label: 'Dependencies', path: '/reports/dependency-map' },
      { label: 'Objectives', path: '/objectives', featureFlag: 'okr' },
    ],
  },
  {
    label: 'People',
    pages: [
      { label: 'People', path: '/people/resources' },
      { label: 'Teams', path: '/teams' },
      { label: 'Capacity', path: '/people/capacity' },
      { label: 'Performance', path: '/people/performance', featureFlag: 'advanced_people' },
      { label: 'Skills Matrix', path: '/skills-matrix', featureFlag: 'advanced_people' },
      { label: 'Team Pulse', path: '/reports/team-pulse', featureFlag: 'advanced_people' },
      { label: 'Workforce Planning', path: '/demand-forecast' },
      { label: 'Leave Hub', path: '/leave' },
    ],
  },
  {
    label: 'Delivery',
    pages: [
      { label: 'PODs', path: '/pods' },
      { label: 'Sprint Planner', path: '/sprint-planner' },
      { label: 'Sprint Quality', path: '/reports/sprint-quality', featureFlag: 'jira' },
      { label: 'Engineering Hub',      path: '/engineering/hub',               featureFlag: 'engineering' },
      { label: 'Engineering Analytics', path: '/reports/engineering-analytics', featureFlag: 'engineering',
        note: 'Flow Efficiency · Aging WIP · Throughput · Forecasting · 23 metrics' },
      { label: 'Power Dashboard', path: '/reports/power-dashboard',
        note: 'Dynamic query builder · 10 widget types · any field · any metric' },
      { label: 'Calendar', path: '/calendar' },
      { label: 'Ideas Board', path: '/ideas' },
    ],
  },
  {
    label: 'Delivery — Jira subsection',
    pages: [
      { label: 'Sprint Backlog', path: '/sprint-backlog', featureFlag: 'jira' },
      { label: 'Sprint Retro', path: '/reports/sprint-retro', featureFlag: 'jira' },
      { label: 'POD Dashboard', path: '/delivery/jira', featureFlag: 'jira' },
      { label: 'Dashboard Builder', path: '/reports/jira-dashboard-builder', featureFlag: 'jira' },
      { label: 'Releases', path: '/delivery/releases', featureFlag: 'jira' },
      { label: 'Resource Mapping', path: '/settings/jira-resource-mapping', featureFlag: 'jira' },
      { label: 'Release Mapping', path: '/settings/jira-release-mapping', featureFlag: 'jira' },
      { label: 'Support Boards', path: '/settings/support-boards', featureFlag: 'jira' },
    ],
  },
  {
    label: 'Finance',
    pages: [
      { label: 'Budget & CapEx', path: '/reports/budget-capex', featureFlag: 'financials' },
      { label: 'Engineering Economics', path: '/engineering-economics' },
      { label: 'ROI Calculator', path: '/roi-calculator' },
      { label: 'Scenario Planning', path: '/scenario-planning', featureFlag: 'simulations' },
    ],
  },
  {
    label: 'Admin — Pinned',
    pages: [
      { label: 'Users', path: '/settings/users' },
      { label: 'Quality Config', path: '/settings/quality-config' },
      { label: 'Automation Engine', path: '/automation-engine' },
      { label: 'Jira Credentials', path: '/settings/jira-credentials', featureFlag: 'jira' },
    ],
  },
  {
    label: 'Admin — Organisation',
    pages: [
      { label: 'General Settings', path: '/settings/org' },
      { label: 'Email Templates', path: '/settings/email-templates' },
      { label: 'Notification Prefs', path: '/settings/notification-preferences' },
      { label: 'Cost Rates', path: '/settings/cost-rates' },
      { label: 'Custom Fields', path: '/settings/custom-fields' },
      { label: 'Reference Data', path: '/settings/ref-data' },
      { label: 'Webhooks', path: '/settings/webhooks' },
      { label: 'Timeline Settings', path: '/settings/timeline' },
      { label: 'Release Settings', path: '/settings/releases' },
      { label: 'Azure DevOps', path: '/settings/azure-devops' },
      { label: 'Feedback Hub', path: '/settings/feedback-hub' },
    ],
  },
  {
    label: 'Admin — AI & Intelligence',
    pages: [
      { label: 'AI Settings', path: '/settings/my-ai' },
      { label: 'NLP Optimizer', path: '/settings/nlp-optimizer', featureFlag: 'ai' },
      { label: 'Smart Mapping', path: '/settings/smart-mapping', featureFlag: 'ai' },
      { label: 'Smart Notifications', path: '/reports/smart-notifications', featureFlag: 'ai' },
    ],
  },
  {
    label: 'Admin — Developer Tools',
    pages: [
      { label: 'Audit Log', path: '/settings/audit-log' },
      { label: 'Error Logs', path: '/settings/error-log' },
      { label: 'DB Tables', path: '/settings/tables' },
      { label: 'Sidebar Order', path: '/settings/sidebar-order' },
      { label: 'Sitemap', path: '/settings/sitemap' },
      { label: 'Changelog', path: '/settings/changelog' },
    ],
  },
  {
    label: 'URL / Hub Tab Access Only',
    pages: [
      { label: 'DORA Metrics', path: '/reports/dora', note: 'Via Engineering Hub tab' },
      { label: 'Jira Analytics', path: '/reports/jira-analytics', featureFlag: 'jira', note: 'Via POD Dashboard tab' },
      { label: 'Project Health', path: '/reports/project-health', note: 'Via Portfolio Health tab' },
      { label: 'Resource Intelligence', path: '/reports/resource-intelligence', note: 'Via Performance tab' },
      { label: 'Workload Chart', path: '/reports/workload-chart', note: 'Via Capacity tab' },
      { label: 'Hiring Forecast', path: '/reports/hiring-forecast', note: 'Via Workforce Planning tab' },
      { label: 'Supply vs Demand', path: '/supply-demand', note: 'Via Workforce Planning tab' },
      { label: 'Resource Pools', path: '/resource-pools', note: 'Via Workforce Planning tab' },
      { label: 'Advanced Timeline', path: '/advanced-timeline', note: 'Via Timeline page' },
      { label: 'Gantt Dependencies', path: '/reports/gantt-dependencies', note: 'Via Dependencies tab' },
      { label: 'Team Calendar', path: '/team-calendar', note: 'Via Calendar tab' },
      { label: 'Sprint Calendar', path: '/sprint-calendar', note: 'Via Calendar tab' },
      { label: 'Release Calendar', path: '/reports/release-calendar', note: 'Via Releases tab' },
      { label: 'Delivery Predictability', path: '/reports/delivery-predictability', note: 'Via Engineering Hub tab' },
      { label: 'Jira Portfolio Sync', path: '/reports/jira-portfolio-sync', note: 'Via POD Dashboard tab' },
      { label: 'Status Updates', path: '/reports/status-updates', note: 'Via POD Dashboard tab' },
    ],
  },
];

export default function SitemapPage() {
  const dark = useDarkMode();
  const headingColor = dark ? AQUA : DEEP_BLUE;

  const getFeatureBadgeColor = (featureFlag?: string): string => {
    if (!featureFlag) return 'gray';
    const colors: Record<string, string> = {
      'ai': 'blue',
      'risk': 'red',
      'okr': 'violet',
      'advanced_people': 'cyan',
      'jira': 'orange',
      'engineering': 'teal',
      'financials': 'green',
      'simulations': 'indigo',
    };
    return colors[featureFlag] || 'gray';
  };

  return (
    <Container size="xl" py="xl">
      <Stack className="page-enter stagger-children" gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2} c={headingColor} fw={700}>
              Sitemap
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Complete visual guide to all pages in the Portfolio Planner. Organized by section with feature flags and access notes.
            </Text>
          </div>
          <IconMapPin size={32} color={headingColor} />
        </Group>

        {/* Legend */}
        <Card withBorder p="sm" bg={dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}>
          <Group gap="lg" wrap="wrap">
            <div>
              <Text size="xs" fw={700} mb={4}>Feature Flags:</Text>
              <Group gap={4} wrap="wrap">
                {['ai', 'risk', 'okr', 'advanced_people', 'jira', 'engineering', 'financials', 'simulations'].map(flag => (
                  <Badge key={flag} size="xs" variant="light" color={getFeatureBadgeColor(flag)}>
                    {flag}
                  </Badge>
                ))}
              </Group>
            </div>
            <div>
              <Text size="xs" fw={700} mb={4}>Access Notes:</Text>
              <Group gap={4} wrap="wrap">
                <Badge size="xs" variant="light" color="yellow">Hub tab access</Badge>
                <Badge size="xs" variant="light" color="yellow">URL access</Badge>
              </Group>
            </div>
          </Group>
        </Card>

        {/* Sections */}
        <Stack gap="xl">
          {SITEMAP_DATA.map(section => (
            <div key={section.label}>
              <Group justify="space-between" mb="sm">
                <Title order={3} size="h4" c={headingColor} fw={700}>
                  {section.label}
                </Title>
                <Badge size="sm" variant="light" color="gray">
                  {section.pages.length} pages
                </Badge>
              </Group>

              <Grid gutter="sm">
                {section.pages.map(page => (
                  <Grid.Col key={page.path} span={{ base: 12, sm: 6, md: 4 }}>
                    <Card
                      withBorder
                      p="sm"
                      style={{
                        backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Stack gap={6}>
                        <Group justify="space-between" align="flex-start">
                          <Text fw={600} size="sm" style={{ flex: 1, wordBreak: 'break-word' }}>
                            {page.label}
                          </Text>
                          {page.featureFlag && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={getFeatureBadgeColor(page.featureFlag)}
                              style={{ flexShrink: 0 }}
                            >
                              {page.featureFlag}
                            </Badge>
                          )}
                        </Group>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            backgroundColor: dark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                            padding: '4px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {page.path}
                        </Text>
                        {page.note && (
                          <Badge size="xs" variant="dot" color="yellow">
                            {page.note}
                          </Badge>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            </div>
          ))}
        </Stack>

        {/* Footer note */}
        <Card withBorder p="sm" bg={dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}>
          <Stack gap={4}>
            <Text size="xs" fw={700}>Notes:</Text>
            <Text size="xs" c="dimmed">
              • Pages marked with feature flags are only visible when the feature is enabled in organization settings.
            </Text>
            <Text size="xs" c="dimmed">
              • &quot;Hub tab access&quot; means the page is accessible as a tab within a parent hub page.
            </Text>
            <Text size="xs" c="dimmed">
              • &quot;URL access&quot; means the page can be accessed directly via URL but may not be in the main sidebar navigation.
            </Text>
            <Text size="xs" c="dimmed">
              • Some pages (like Reports) may be accessible through multiple routes or navigation paths.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
