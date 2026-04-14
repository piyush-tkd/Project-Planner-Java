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
 * Requires an AI key (org-level or personal) — configure in Settings → My AI Settings.
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
import { useAiStatus } from '../api/userAiConfig';
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

// ── API call ──────────────────────────────────────────────────────────────────

async function callGenerateApi(req: GenerateRequest): Promise<string> {
  const res = await apiClient.post<{ output: string }>('/ai/generate', req);
  return res.data.output;
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
  const { data: aiStatus } = useAiStatus();
  const aiKeyMissing = aiStatus?.source === 'NONE';

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
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error as string | undefined;
      if (status === 503) {
        notifications.show({
          title: 'No AI key configured',
          message: 'Go to Settings → My AI Settings to add your personal API key, or ask your admin to configure an org-level key.',
          color: 'orange',
          autoClose: 10000,
        });
      } else {
        notifications.show({
          title: 'AI generation failed',
          message: serverMsg || 'An unexpected error occurred. Please try again.',
          color: 'red',
          autoClose: 6000,
        });
      }
      onDone('');
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

        {/* No-key warning banner */}
        {aiKeyMissing && (
          <Alert
            variant="light"
            color="orange"
            radius="md"
            icon={<IconAlertTriangle size={16} />}
            styles={{ root: { border: '1px solid rgba(245,159,0,0.4)' } }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                No AI key configured. Add your personal key or ask your admin to set an org-level key to use this feature.
              </Text>
              <Button
                component="a"
                href="/settings/my-ai"
                size="xs"
                variant="outline"
                color="orange"
                style={{ whiteSpace: 'nowrap' }}
              >
                Configure key →
              </Button>
            </Group>
          </Alert>
        )}

        {/* Info banner */}
        {!aiKeyMissing && (
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
              {aiStatus?.source === 'ORG' && <> Using <strong>org API key</strong>.</>}
              {aiStatus?.source === 'USER' && <> Using your <strong>personal API key</strong>.</>}
            </Text>
          </Alert>
        )}

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
