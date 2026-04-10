import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal, Stack, Text, Group, Button, Progress, ThemeIcon,
  Box, SimpleGrid, Badge, Title,
} from '@mantine/core';
import {
  IconDashboard, IconBriefcase, IconHexagons, IconChartBar,
  IconTicket, IconPlayerPlay, IconCalendar, IconCoin,
  IconArrowRight, IconArrowLeft, IconCheck, IconExternalLink,
  IconBrain, IconCalendarEvent, IconKeyboard, IconHistory,
} from '@tabler/icons-react';
import { useTourStatus, useMarkTourSeen } from '../../api/tour';
import { useAuth } from '../../auth/AuthContext';
import { AQUA, COLOR_BLUE_LIGHT, COLOR_VIOLET_LIGHT, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, GRAY_BORDER} from '../../brandTokens';

// ── Tour steps ────────────────────────────────────────────────────────────────

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlights: string[];
  color: string;
  path?: string;          // page to navigate to on "Explore this page"
  pageLabel?: string;     // button label override
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <IconDashboard size={32} />,
    title: 'Welcome to Engineering Portfolio Planner',
    description:
      'Your command centre for tracking engineering capacity, planning projects, and monitoring team health across all PODs.',
    highlights: ['Live capacity alerts', 'POD utilisation summary', 'Project health at a glance'],
    color: AQUA,
    path: '/',
    pageLabel: 'Go to Dashboard',
  },
  {
    icon: <IconBriefcase size={32} />,
    title: 'Projects & PODs',
    description:
      'Create projects, assign them to PODs, set T-shirt sizes and effort patterns, and track status from kickoff to delivery. Each POD has its own capacity pool and sprint cadence.',
    highlights: ['T-shirt sizing with effort patterns', 'Multi-POD allocation', 'Block / dependency tracking'],
    color: COLOR_BLUE_LIGHT,
    path: '/projects',
    pageLabel: 'View Projects',
  },
  {
    icon: <IconChartBar size={32} />,
    title: 'Capacity Reports',
    description:
      'See exactly where each POD is over- or under-allocated month by month. Spot hiring gaps, concurrency risks, and slack buffers before they become problems.',
    highlights: ['Capacity Gap heatmap', 'Hiring Forecast', 'Slack & Buffer view'],
    color: '#f59f00',
    path: '/reports/capacity-gap',
    pageLabel: 'Open Capacity Gap',
  },
  {
    icon: <IconHexagons size={32} />,
    title: 'Portfolio Analysis',
    description:
      'Cross-project intelligence: health scores, Gantt charts, budget tracking, cross-POD dependencies, and full resource ROI once Jira hours are synced.',
    highlights: ['Project Health scorecard', 'Budget & Cost tracker', 'Resource ROI'],
    color: COLOR_VIOLET_LIGHT,
    path: '/reports/project-health',
    pageLabel: 'Open Project Health',
  },
  {
    icon: <IconTicket size={32} />,
    title: 'Jira Integrations',
    description:
      'Connect your Jira instance to automatically pull in sprint actuals, CapEx/OpEx classification, release tracking, worklog breakdowns, and the support queue — all synced in real time.',
    highlights: ['Worklog hours per person', 'Support Queue with SLA alerts', 'CapEx vs OpEx classification'],
    color: '#20c997',
    path: '/jira-actuals',
    pageLabel: 'Open Jira Actuals',
  },
  {
    icon: <IconCalendar size={32} />,
    title: 'Team Calendar',
    description:
      'A heatmap view of POD utilisation across every month. Click any cell to see which projects are active in that POD during that period.',
    highlights: ['Colour-coded utilisation bands', 'Project count per cell', 'Drill-down detail modal'],
    color: '#f76707',
    path: '/team-calendar',
    pageLabel: 'Open Team Calendar',
  },
  {
    icon: <IconPlayerPlay size={32} />,
    title: 'Simulators',
    description:
      'Model "what-if" scenarios before committing to changes — adjust timelines, swap resources, or add projects and instantly see the downstream capacity impact.',
    highlights: ['Timeline Simulator', 'Scenario Simulator', 'No data is saved until you apply'],
    color: '#e64980',
    path: '/simulator/timeline',
    pageLabel: 'Try Timeline Simulator',
  },
  {
    icon: <IconCoin size={32} />,
    title: "You're all set!",
    description:
      "Explore at your own pace. The left nav groups pages by section — click any section header to expand it. Admins can control who sees what via Settings → Users.",
    highlights: ['Left nav groups collapse / expand', 'Notification bell for critical Jira alerts', 'Dark mode toggle in the header'],
    color: DEEP_BLUE,
  },
  {
    icon: <IconBrain size={32} />,
    title: 'Ask AI — Natural Language Search',
    description:
      "Type questions in plain English to look up resources, projects, PODs, and more. Ask AI understands queries like 'show me P0 projects' or 'who is John?' and navigates you straight to the answer.",
    highlights: ['Natural language queries', 'Auto-navigation', 'Entity drill-down'],
    color: AQUA,
    path: '/nlp',
    pageLabel: 'Try Ask AI',
  },
  {
    icon: <IconCalendarEvent size={32} />,
    title: 'Sprint & Release Planning',
    description:
      'Plan sprints, manage release calendars, and track code-freeze dates. The Sprint Planner uses AI to recommend optimal resource allocation across PODs.',
    highlights: ['Sprint calendar view', 'AI-powered allocation', 'Release tracking'],
    color: COLOR_WARNING,
    path: '/sprint-calendar',
    pageLabel: 'View Sprint Calendar',
  },
  {
    icon: <IconChartBar size={32} />,
    title: 'Jira Actuals & Variance',
    description:
      'See actual vs planned hours by sprint, budget burn rates, and velocity trends. Export to CSV anytime.',
    highlights: ['Sprint velocity trend chart', 'Budget burn % with color coding', 'CSV export'],
    color: 'blue',
    path: '/delivery/jira',
    pageLabel: 'Open Jira Actuals',
  },
  {
    icon: <IconHistory size={32} />,
    title: 'AI Conversation History',
    description:
      'Every query is saved. Resume past conversations with full context restored — the AI remembers where you left off.',
    highlights: ['Pin important conversations', 'Resume with context', 'Search past queries'],
    color: 'teal',
    path: '/nlp/history',
    pageLabel: 'View History',
  },
  {
    icon: <IconKeyboard size={32} />,
    title: 'Keyboard Shortcuts',
    description:
      "Navigate faster with keyboard shortcuts. Press ⌘K to search, ? for the shortcuts panel, or G followed by a letter to jump directly to any page.",
    highlights: ['⌘K for search', '? for shortcuts', 'G+D for Dashboard, G+P for Projects'],
    color: '#6366f1',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TourGuide() {
  const { isAuthenticated } = useAuth();
  const { data: tourStatus, isLoading } = useTourStatus();
  const markSeen  = useMarkTourSeen();
  const navigate  = useNavigate();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isLoading && tourStatus?.showTour) {
      setStep(0);
      setOpen(true);
    }
  }, [isLoading, tourStatus?.showTour]);

  if (!isAuthenticated) return null;

  const current = TOUR_STEPS[step];
  const total   = TOUR_STEPS.length;
  const isLast  = step === total - 1;
  const isFirst = step === 0;

  function handleClose() {
    setOpen(false);
    markSeen.mutate();
  }

  function next() {
    if (isLast) { handleClose(); return; }
    setStep(s => s + 1);
  }

  function prev() {
    if (!isFirst) setStep(s => s - 1);
  }

  function goToPage() {
    if (current.path) {
      navigate(current.path);
      handleClose();
    }
  }

  return (
    <Modal
      opened={open}
      onClose={handleClose}
      size="lg"
      centered
      withCloseButton
      radius="lg"
      overlayProps={{ blur: 3, backgroundOpacity: 0.4 }}
      styles={{
        header: { background: DEEP_BLUE, padding: '16px 24px' },
        title: { color: '#fff', fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 15 },
        close: { color: '#fff', '&:hover': { background: 'rgba(255,255,255,0.15)' } },
        body: { padding: 0 },
      }}
      title={`Quick tour  ·  ${step + 1} of ${total}`}
    >
      {/* Progress bar */}
      <Progress
        value={((step + 1) / total) * 100}
        size={3}
        color={current.color}
        radius={0}
      />

      <Stack gap={0}>
        {/* Main content */}
        <Box p="xl">
          <Stack gap="lg">
            {/* Icon + title */}
            <Group gap="md" align="flex-start">
              <ThemeIcon
                size={64}
                radius="xl"
                style={{ background: current.color + '18', color: current.color, flexShrink: 0 }}
              >
                {current.icon}
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Group gap="xs" align="center" mb={4}>
                  <Title order={3} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 700, lineHeight: 1.3 }}>
                    {current.title}
                  </Title>
                  {current.path && (
                    <Badge
                      size="xs"
                      variant="dot"
                      color="teal"
                      style={{ cursor: 'pointer' }}
                      onClick={goToPage}
                    >
                      {current.pageLabel ?? 'Go to page'}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  {current.description}
                </Text>
              </div>
            </Group>

            {/* Highlights */}
            <SimpleGrid cols={3} spacing="xs">
              {current.highlights.map((h, i) => (
                <Box
                  key={i}
                  p="sm"
                  style={{
                    borderRadius: 8,
                    background: current.color + '10',
                    border: `1px solid ${current.color}28`,
                  }}
                >
                  <Group gap={6} wrap="nowrap">
                    <Box
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: current.color, flexShrink: 0,
                      }}
                    />
                    <Text size="xs" fw={500} style={{ color: DEEP_BLUE, lineHeight: 1.4 }}>
                      {h}
                    </Text>
                  </Group>
                </Box>
              ))}
            </SimpleGrid>

            {/* Step dots */}
            <Group justify="center" gap={6}>
              {TOUR_STEPS.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setStep(i)}
                  style={{
                    width: i === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === step ? current.color : GRAY_BORDER,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                />
              ))}
            </Group>
          </Stack>
        </Box>

        {/* Footer nav */}
        <Box
          px="xl"
          py="md"
          style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '0 0 12px 12px' }}
        >
          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconArrowLeft size={15} />}
              onClick={prev}
              disabled={isFirst}
              size="sm"
            >
              Back
            </Button>

            <Group gap="sm">
              {/* "Take me there" button — visible when step has a path and is not last */}
              {current.path && !isLast && (
                <Button
                  variant="light"
                  size="sm"
                  color="teal"
                  rightSection={<IconExternalLink size={14} />}
                  onClick={goToPage}
                >
                  {current.pageLabel ?? 'Go to page'}
                </Button>
              )}
              <Button variant="subtle" color="gray" size="sm" onClick={handleClose}>
                Skip tour
              </Button>
              <Button
                size="sm"
                style={{ background: current.color }}
                rightSection={isLast ? <IconCheck size={15} /> : <IconArrowRight size={15} />}
                onClick={next}
              >
                {isLast ? 'Get started' : 'Next'}
              </Button>
            </Group>
          </Group>
        </Box>
      </Stack>
    </Modal>
  );
}
