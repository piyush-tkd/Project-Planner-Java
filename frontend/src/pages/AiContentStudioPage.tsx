/**
 * AiContentStudioPage — AI-powered content generation for engineering portfolio reports.
 *
 * Features:
 *   1. Status Update Email  — draft a project status email from live project data
 *   2. Sprint Retro Summary — synthesise retro notes into themed action items
 *   3. Risk Brief           — generate an executive-ready risk summary
 *   4. Meeting Notes → Actions — paste notes, extract action items + owners
 *
 * Calls POST /api/ai/generate  { type, context }  → { output: string }
 * Falls back to templated mock output when backend not available.
 */
import { useState, useMemo } from 'react';
import {
  Title, Text, Stack, Group, Button, Paper, Textarea, Select,
  ThemeIcon, Box, SimpleGrid, CopyButton,
  ActionIcon, Tooltip, Alert, UnstyledButton,
} from '@mantine/core';
import {
  IconBrain, IconMail, IconListCheck, IconAlertTriangle,
  IconNotes, IconSparkles, IconCopy, IconCheck, IconRefresh,
  IconChevronRight,
} from '@tabler/icons-react';
import { useComputedColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { useProjects } from '../api/projects';
import { PPPageLayout } from '../components/pp';
import {
  AQUA, AQUA_TINTS, COLOR_VIOLET, DEEP_BLUE, DEEP_BLUE_TINTS,
  FONT_FAMILY, BORDER_DEFAULT,
} from '../brandTokens';
import type { ProjectResponse } from '../types/project';

// ── Types ─────────────────────────────────────────────────────────────────────

type GenerationType = 'status_email' | 'retro_summary' | 'risk_brief' | 'meeting_actions';

interface GenerateRequest {
  type: GenerationType;
  projectId?: number;
  context: string;
  tone?: string;
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Array<{
  id: GenerationType | string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
}> = [
  {
    id: 'status-email',
    label: 'Status Email',
    description: 'Project update email from live data',
    icon: <IconMail size={20} />,
    accentColor: AQUA,
    accentBg: AQUA_TINTS[10],
  },
  {
    id: 'retro-summary',
    label: 'Retro Summary',
    description: 'Synthesise sprint retro notes',
    icon: <IconListCheck size={20} />,
    accentColor: '#22c55e',
    accentBg: 'rgba(34, 197, 94, 0.1)',
  },
  {
    id: 'risk-brief',
    label: 'Risk Brief',
    description: 'Executive portfolio risk summary',
    icon: <IconAlertTriangle size={20} />,
    accentColor: '#f59f00',
    accentBg: 'rgba(245, 159, 0, 0.1)',
  },
  {
    id: 'meeting-actions',
    label: 'Meeting → Actions',
    description: 'Extract actions and owners',
    icon: <IconNotes size={20} />,
    accentColor: COLOR_VIOLET,
    accentBg: '#ede9fe',
  },
];

// ── Mock outputs ──────────────────────────────────────────────────────────────

function mockStatusEmail(project: ProjectResponse | null): string {
  if (!project) return '';
  const status   = project.status ?? 'ACTIVE';
  const priority = project.priority ?? 'P1';
  const today    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Subject: ${project.name} — Status Update ${today}

Hi Team,

I wanted to share a quick update on **${project.name}** (${priority}).

**Current Status:** ${status.replace(/_/g, ' ')}
${project.targetDate ? `**Target Completion:** ${new Date(project.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}

**Progress this week:**
- Core feature development is progressing as planned
- Engineering team has been working through the backlog items
- No critical blockers identified at this time

**Risks & watch items:**
${status === 'AT_RISK' ? '⚠️  Timeline risk — target date is approaching and scope may need adjustment' : '✅  No major risks to report this week'}

**Next steps:**
- Continue sprint execution
- Stakeholder review scheduled for next week
- Will update this report following the next planning session

Please reach out if you have any questions or concerns.

Best regards,
Portfolio Planning Team`.trim();
}

function mockRetroSummary(notes: string): string {
  if (!notes.trim()) return '';
  return `## Sprint Retrospective Summary
Generated: ${new Date().toLocaleDateString('en-GB')}

### 🟢 What went well
- Team collaboration and communication were strong throughout the sprint
- Delivery against sprint goals exceeded expectations (based on velocity trends)
- Reduced time spent in refinement meetings — better pre-grooming paid off

### 🔴 What needs improvement
- Several story points carried over due to unclear acceptance criteria at sprint start
- Cross-team dependency on the platform team caused a 2-day delay mid-sprint
- Test coverage slipped on two components — needs attention next sprint

### ⚡ Action items
| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | Define clear AC template for all P0/P1 stories | Scrum Master | Next planning |
| 2 | Schedule dependency alignment call with Platform team | EM | This week |
| 3 | Add unit test coverage for auth and dashboard modules | Dev Lead | Sprint +1 |
| 4 | Share velocity chart with stakeholders before next demo | PM | End of week |

### 💡 Team mood
Overall sentiment: **Positive** · Energy level: **Medium-high**
The team feels the workload is sustainable. Main frustration is external blockers.`.trim();
}

function mockRiskBrief(projectIds: string): string {
  return `## Engineering Portfolio — Risk Brief
${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

### Executive Summary
The portfolio contains ${projectIds ? projectIds.split(',').length : 'several'} active initiatives.
Two items require immediate attention; overall portfolio health is **Amber**.

### 🔴 Critical Risks (Action Required)
1. **Capacity Bottleneck — Platform POD**
   Three projects are competing for the same platform engineering resources in Q2.
   Recommended: Stagger start dates by 3–4 weeks or hire one additional backend engineer.

2. **Deadline Risk — Core Product Rework**
   Target date in 6 weeks with 40% of scope still unestimated.
   Recommended: Scope reduction or timeline extension — bring to steering committee.

### 🟡 Watch Items
- **Third-party API integration** — vendor SLA response time averaging 4 days. Mitigation: build internal mock layer.
- **Compliance review** — security sign-off not yet scheduled. Must complete 2 weeks before release.

### 🟢 On Track
- Data infrastructure migration: 80% complete, on schedule
- Developer tooling improvements: delivered ahead of plan

### Recommended Actions
1. Schedule a capacity planning session with POD leads this week
2. Escalate deadline risk to steering committee before next sprint
3. Assign compliance review owner immediately`.trim();
}

function mockMeetingActions(notes: string): string {
  if (!notes.trim()) return '';
  return `## Extracted Action Items
${new Date().toLocaleDateString('en-GB')} — AI-generated from meeting notes

| # | Action Item | Owner | Priority | Due Date |
|---|-------------|-------|----------|----------|
| 1 | Share updated project timeline with stakeholders | PM | High | EOW |
| 2 | Investigate performance regression on dashboard load | Dev Lead | High | Next sprint |
| 3 | Set up recurring sync with Design team | EM | Medium | This week |
| 4 | Review and merge pending PRs before code freeze | Dev team | High | Tomorrow |
| 5 | Update Confluence documentation for new API endpoints | Dev Lead | Low | Sprint +1 |
| 6 | Prepare demo environment for client walkthrough | QA Lead | High | Next Monday |

### Decisions Made
- ✅ Agreed to push release by 1 week to incorporate QA feedback
- ✅ Platform team will own the migration scripts
- ✅ Weekly stakeholder update email to continue through Q2

### Open Questions
- ❓ Budget approval for additional infrastructure — pending finance review
- ❓ Which team owns the post-launch monitoring dashboard?`.trim();
}

// ── API call ──────────────────────────────────────────────────────────────────

async function callGenerateApi(req: GenerateRequest): Promise<string> {
  try {
    const res = await apiClient.post<{ output: string }>('/ai/generate', req);
    return res.data.output;
  } catch {
    throw new Error('MOCK_FALLBACK');
  }
}

// ── Tone options ──────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'concise',      label: 'Concise' },
  { value: 'executive',    label: 'Executive brief' },
  { value: 'technical',    label: 'Technical' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiContentStudioPage() {
  const colorScheme = useComputedColorScheme('light');
  const isDark = colorScheme === 'dark';
  const { data: projects = [] } = useProjects();

  const [activeTab, setActiveTab] = useState('status-email');

  // Status email state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [emailTone,         setEmailTone]         = useState('professional');
  const [emailOutput,       setEmailOutput]       = useState('');

  // Retro summary state
  const [retroNotes,  setRetroNotes]  = useState('');
  const [retroOutput, setRetroOutput] = useState('');

  // Risk brief state
  const [riskOutput, setRiskOutput] = useState('');

  // Meeting actions state
  const [meetingNotes,  setMeetingNotes]  = useState('');
  const [meetingOutput, setMeetingOutput] = useState('');

  const [loading, setLoading] = useState<GenerationType | null>(null);

  // ── Surface tokens ────────────────────────────────────────────────────────
  const surfaceBg  = isDark ? 'var(--mantine-color-dark-7)' : '#ffffff';
  const surfaceAlt = isDark ? 'var(--mantine-color-dark-6)' : '#f8fafc';
  const borderCol  = isDark ? 'var(--mantine-color-dark-4)' : BORDER_DEFAULT;
  const textPrimary   = isDark ? '#e9ecef' : DEEP_BLUE;
  const textSecondary = isDark ? '#adb5bd' : DEEP_BLUE_TINTS[60];

  const projectOptions = useMemo(() =>
    (projects as ProjectResponse[]).map(p => ({
      value: String(p.id),
      label: `${p.name} (${p.status ?? 'ACTIVE'})`,
    })),
    [projects],
  );

  const selectedProject = useMemo(() =>
    (projects as ProjectResponse[]).find(p => String(p.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function generate(type: GenerationType, context: string, onDone: (out: string) => void) {
    setLoading(type);
    try {
      const out = await callGenerateApi({ type, context, projectId: selectedProject?.id, tone: emailTone });
      onDone(out);
    } catch {
      // AI backend unavailable — show user a warning and use template fallback
      notifications.show({
        title: 'AI service unavailable',
        message: 'Using a template preview. Connect the AI backend (/api/ai/generate) for live generation.',
        color: 'orange',
        autoClose: 6000,
      });
      let mock = '';
      if (type === 'status_email')    mock = mockStatusEmail(selectedProject);
      if (type === 'retro_summary')   mock = mockRetroSummary(context);
      if (type === 'risk_brief')      mock = mockRiskBrief(projectOptions.map(p => p.value).join(','));
      if (type === 'meeting_actions') mock = mockMeetingActions(context);
      onDone(mock);
    } finally {
      setLoading(null);
    }
  }

  const isLoading = (type: GenerationType) => loading === type;

  const activeTabDef = TABS.find(t => t.id === activeTab);

  // ── Generate button helper ────────────────────────────────────────────────
  function GenButton({
    type, disabled, onClick, label,
    bgColor = AQUA,
    textColor = DEEP_BLUE,
  }: {
    type: GenerationType;
    disabled?: boolean;
    onClick: () => void;
    label: string;
    bgColor?: string;
    textColor?: string;
  }) {
    return (
      <Button
        leftSection={<IconSparkles size={15} color={textColor} />}
        disabled={disabled}
        loading={isLoading(type)}
        onClick={onClick}
        styles={{
          root: {
            background: disabled ? undefined : bgColor,
            color: textColor,
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            border: 'none',
          },
          label: { color: textColor },
          section: { color: textColor },
        }}
      >
        {label}
      </Button>
    );
  }

  // ── Output panel ──────────────────────────────────────────────────────────
  function OutputPanel({ output, type }: { output: string; type: GenerationType }) {
    if (!output) return null;
    const tabDef = TABS.find(t => t.id === activeTab);
    const accent = tabDef?.accentColor ?? AQUA;
    return (
      <Paper
        withBorder
        radius="md"
        p="md"
        style={{ background: surfaceBg, borderColor: accent + '55', borderLeftWidth: 3, borderLeftColor: accent }}
      >
        <Group justify="space-between" mb="sm">
          <Group gap={8}>
            <ThemeIcon size={26} radius="md" style={{ background: accent + '20' }}>
              <IconSparkles size={14} color={accent} />
            </ThemeIcon>
            <div>
              <Text size="xs" fw={700} style={{ color: textPrimary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                AI Draft
              </Text>
              <Text size="10px" style={{ color: textSecondary }}>Review before sending · editable below</Text>
            </div>
          </Group>
          <Group gap={6}>
            <CopyButton value={output}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied!' : 'Copy to clipboard'}>
                  <ActionIcon
                    size="sm"
                    variant="light"
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                  >
                    {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
            <Tooltip label="Regenerate">
              <ActionIcon
                size="sm"
                variant="light"
                color="blue"
                loading={isLoading(type)}
                onClick={() => {
                  if (type === 'status_email')    generate(type, emailTone,    setEmailOutput);
                  if (type === 'retro_summary')   generate(type, retroNotes,   setRetroOutput);
                  if (type === 'risk_brief')      generate(type, '',           setRiskOutput);
                  if (type === 'meeting_actions') generate(type, meetingNotes, setMeetingOutput);
                }}
              >
                <IconRefresh size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Textarea
          value={output}
          onChange={e => {
            if (type === 'status_email')    setEmailOutput(e.currentTarget.value);
            if (type === 'retro_summary')   setRetroOutput(e.currentTarget.value);
            if (type === 'risk_brief')      setRiskOutput(e.currentTarget.value);
            if (type === 'meeting_actions') setMeetingOutput(e.currentTarget.value);
          }}
          autosize
          minRows={8}
          styles={{
            input: {
              fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: 12,
              background: surfaceAlt,
              color: textPrimary,
              border: `1px solid ${borderCol}`,
            },
          }}
        />
      </Paper>
    );
  }

  // ── Tab selector ──────────────────────────────────────────────────────────
  function TabSelector() {
    return (
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <UnstyledButton
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                borderRadius: 12,
                padding: '12px 14px',
                border: isActive
                  ? `2px solid ${tab.accentColor}`
                  : `2px solid ${borderCol}`,
                background: isActive
                  ? (isDark ? tab.accentColor + '22' : tab.accentBg)
                  : surfaceBg,
                transition: 'all 180ms ease',
                cursor: 'pointer',
              }}
            >
              <Group gap={10} wrap="nowrap">
                <ThemeIcon
                  size={36}
                  radius="md"
                  style={{
                    background: isActive ? tab.accentColor : (isDark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10]),
                    flexShrink: 0,
                  }}
                >
                  <Box style={{ color: isActive ? DEEP_BLUE : (isDark ? '#adb5bd' : DEEP_BLUE_TINTS[60]) }}>
                    {tab.icon}
                  </Box>
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text
                    size="sm"
                    fw={700}
                    style={{
                      color: isActive ? (isDark ? tab.accentColor : tab.accentColor === AQUA ? DEEP_BLUE : tab.accentColor) : textPrimary,
                      fontFamily: FONT_FAMILY,
                      lineHeight: 1.2,
                    }}
                  >
                    {tab.label}
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      color: textSecondary,
                      fontFamily: FONT_FAMILY,
                      marginTop: 2,
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {tab.description}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PPPageLayout
      title="AI Content Studio"
      subtitle="Generate status emails, retro summaries, risk briefs, and meeting action items"
      animate
    >
      <Stack gap="md">

        {/* Info banner */}
        <Alert
          variant="light"
          color="teal"
          radius="md"
          icon={<IconBrain size={16} color={AQUA} />}
          styles={{
            root: { background: isDark ? AQUA + '15' : AQUA_TINTS[10], border: `1px solid ${AQUA}40` },
            message: { color: textPrimary },
          }}
        >
          <Text size="sm" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
            AI drafts are generated from live project data and your inputs.
            Always review before sending — outputs are editable and copy-paste ready.
          </Text>
        </Alert>

        {/* Tab selector */}
        <TabSelector />

        {/* Active tab header strip */}
        {activeTabDef && (
          <Paper
            radius="md"
            p="sm"
            style={{
              background: isDark ? activeTabDef.accentColor + '18' : activeTabDef.accentBg,
              border: `1px solid ${activeTabDef.accentColor}40`,
            }}
          >
            <Group gap={10}>
              <ThemeIcon size={32} radius="md" style={{ background: activeTabDef.accentColor }}>
                <Box style={{ color: DEEP_BLUE }}>{activeTabDef.icon}</Box>
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                  {activeTabDef.label}
                </Text>
                <Text size="xs" style={{ color: textSecondary }}>
                  {activeTabDef.description}
                </Text>
              </div>
              <Box style={{ marginLeft: 'auto' }}>
                <IconChevronRight size={16} color={activeTabDef.accentColor} />
              </Box>
            </Group>
          </Paper>
        )}

        {/* ══ STATUS EMAIL ══ */}
        {activeTab === 'status-email' && (
          <Stack gap="md">
            <Paper withBorder radius="md" p="md" style={{ background: surfaceBg, borderColor: borderCol }}>
              <Text size="sm" fw={600} mb="md" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                Draft a project status update email from live data
              </Text>
              <Group gap="sm" align="flex-end">
                <Select
                  label={<Text size="xs" fw={600} style={{ color: textSecondary }}>Project</Text>}
                  placeholder="Select a project…"
                  data={projectOptions}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  searchable
                  style={{ flex: 1 }}
                  styles={{ input: { color: textPrimary } }}
                />
                <Select
                  label={<Text size="xs" fw={600} style={{ color: textSecondary }}>Tone</Text>}
                  data={TONE_OPTIONS}
                  value={emailTone}
                  onChange={v => setEmailTone(v ?? 'professional')}
                  style={{ width: 180 }}
                  styles={{ input: { color: textPrimary } }}
                />
                <GenButton
                  type="status_email"
                  disabled={!selectedProjectId}
                  onClick={() => generate('status_email', emailTone, setEmailOutput)}
                  label="Generate Draft"
                  bgColor={AQUA}
                  textColor={DEEP_BLUE}
                />
              </Group>

              {selectedProject && (
                <SimpleGrid cols={3} spacing="xs" mt="md">
                  {[
                    { label: 'Status',   value: selectedProject.status ?? '—' },
                    { label: 'Priority', value: selectedProject.priority ?? '—' },
                    { label: 'Target',   value: selectedProject.targetDate ? new Date(selectedProject.targetDate).toLocaleDateString() : 'Not set' },
                  ].map(s => (
                    <Box
                      key={s.label}
                      p="xs"
                      style={{ borderRadius: 8, background: surfaceAlt, border: `1px solid ${borderCol}` }}
                    >
                      <Text size="10px" tt="uppercase" fw={700} style={{ color: textSecondary }}>{s.label}</Text>
                      <Text size="sm" fw={600} mt={2} style={{ color: textPrimary }}>{s.value}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Paper>
            <OutputPanel output={emailOutput} type="status_email" />
          </Stack>
        )}

        {/* ══ RETRO SUMMARY ══ */}
        {activeTab === 'retro-summary' && (
          <Stack gap="md">
            <Paper withBorder radius="md" p="md" style={{ background: surfaceBg, borderColor: borderCol }}>
              <Text size="sm" fw={600} mb={4} style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                Paste sprint retro notes or bullet points
              </Text>
              <Text size="xs" mb="md" style={{ color: textSecondary }}>
                Works with raw sticky-note exports, Confluence pages, or free-form text.
              </Text>
              <Textarea
                placeholder={`What went well:\n- Good team communication\n- Hit sprint goals\n\nWhat needs improvement:\n- Too many interruptions\n- Story estimates were off\n\nAction items:\n- Set up focus time blocks\n- Run story-point calibration session`}
                value={retroNotes}
                onChange={e => setRetroNotes(e.currentTarget.value)}
                autosize
                minRows={6}
                mb="md"
                styles={{
                  input: { background: surfaceAlt, color: textPrimary, border: `1px solid ${borderCol}` },
                }}
              />
              <GenButton
                type="retro_summary"
                disabled={!retroNotes.trim()}
                onClick={() => generate('retro_summary', retroNotes, setRetroOutput)}
                label="Summarise & Extract Actions"
                bgColor="#22c55e"
                textColor="#ffffff"
              />
            </Paper>
            <OutputPanel output={retroOutput} type="retro_summary" />
          </Stack>
        )}

        {/* ══ RISK BRIEF ══ */}
        {activeTab === 'risk-brief' && (
          <Stack gap="md">
            <Paper withBorder radius="md" p="md" style={{ background: surfaceBg, borderColor: borderCol }}>
              <Group gap="sm" align="flex-start">
                <ThemeIcon size={44} radius="xl" style={{ background: '#f59f00', flexShrink: 0 }}>
                  <IconAlertTriangle size={22} color="#ffffff" />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={700} style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                    Portfolio Risk Brief
                  </Text>
                  <Text size="xs" mt={4} style={{ color: textSecondary }}>
                    Analyses all active projects using health scores, capacity data, and status flags.
                    Generates an executive-ready risk summary ready to paste into a board report.
                  </Text>
                </div>
              </Group>
              <Box mt="md">
                <GenButton
                  type="risk_brief"
                  onClick={() => generate('risk_brief', '', setRiskOutput)}
                  label="Generate Risk Brief"
                  bgColor="#f59f00"
                  textColor="#ffffff"
                />
              </Box>
            </Paper>
            <OutputPanel output={riskOutput} type="risk_brief" />
          </Stack>
        )}

        {/* ══ MEETING → ACTIONS ══ */}
        {activeTab === 'meeting-actions' && (
          <Stack gap="md">
            <Paper withBorder radius="md" p="md" style={{ background: surfaceBg, borderColor: borderCol }}>
              <Text size="sm" fw={600} mb={4} style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                Paste meeting notes or transcript
              </Text>
              <Text size="xs" mb="md" style={{ color: textSecondary }}>
                AI extracts action items with owners and due dates, and flags decisions and open questions.
              </Text>
              <Textarea
                placeholder={`Meeting: Sprint Review — 7 April 2026\nAttendees: Piyush, Sarah, Dev team\n\nDiscussion:\n- Reviewed sprint velocity — slightly below target due to unplanned work\n- Sarah raised performance issue on the dashboard — dev lead to investigate\n- Agreed to push release by 1 week for QA feedback\n- Platform team confirmed they will own migration scripts\n- Need budget approval for extra infrastructure — Piyush to follow up with finance\n\n...`}
                value={meetingNotes}
                onChange={e => setMeetingNotes(e.currentTarget.value)}
                autosize
                minRows={7}
                mb="md"
                styles={{
                  input: { background: surfaceAlt, color: textPrimary, border: `1px solid ${borderCol}` },
                }}
              />
              <GenButton
                type="meeting_actions"
                disabled={!meetingNotes.trim()}
                onClick={() => generate('meeting_actions', meetingNotes, setMeetingOutput)}
                label="Extract Action Items"
                bgColor={COLOR_VIOLET}
                textColor="#ffffff"
              />
            </Paper>
            <OutputPanel output={meetingOutput} type="meeting_actions" />
          </Stack>
        )}

      </Stack>
    </PPPageLayout>
  );
}
