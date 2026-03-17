import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Select, Table,
  Tabs, Alert, Loader, Tooltip, ActionIcon, Modal, NumberInput,
  SegmentedControl, Progress, Paper, Divider, ThemeIcon,
} from '@mantine/core';
import {
  IconTicket, IconLink, IconLinkOff, IconRefresh, IconCheck,
  IconAlertTriangle, IconPlus, IconTrash, IconChartBar, IconSettings,
  IconCircleCheck, IconCircleX, IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  useJiraStatus, useJiraProjects, useJiraMappings, useJiraActuals,
  useSaveMapping, useSaveMappingsBulk, useDeleteMapping,
  JiraProjectInfo, MappingResponse, ActualsRow,
} from '../api/jira';
import { useProjects } from '../api/projects';
import { ProjectResponse } from '../types/project';

const DEEP_BLUE = '#0C2340';
const AGUA = '#1F9196';

// ── Month ordering helper ─────────────────────────────────────────────
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function JiraActualsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('actuals');
  const [unit, setUnit] = useState<'hours' | 'sp'>('hours');

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const { data: projects = [] } = useProjects();
  const { data: jiraProjects = [], isLoading: jiraLoading, refetch: refetchJira, error: jiraError } = useJiraProjects();
  const { data: mappings = [], refetch: refetchMappings } = useJiraMappings();
  const { data: actuals = [], isLoading: actualsLoading, refetch: refetchActuals } = useJiraActuals();

  const saveMapping = useSaveMapping();
  const saveBulk = useSaveMappingsBulk();
  const deleteMapping = useDeleteMapping();

  if (statusLoading) return <Loader />;

  if (!status?.configured) {
    return (
      <Box p="xl">
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
          Add your Jira credentials to{' '}
          <code>backend/src/main/resources/application-local.yml</code> and restart
          the backend with <code>-Dspring.profiles.active=local</code>.
          <br /><br />
          Required fields: <code>jira.base-url</code>, <code>jira.email</code>, <code>jira.api-token</code>
        </Alert>
      </Box>
    );
  }

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
            <IconTicket size={22} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
              Jira Actuals
            </Title>
            <Text size="sm" c="dimmed">
              Compare planned estimates against actual Jira activity · {status.baseUrl}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={unit}
            onChange={v => setUnit(v as 'hours' | 'sp')}
            data={[
              { label: 'Hours', value: 'hours' },
              { label: 'Story Pts', value: 'sp' },
            ]}
          />
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={actualsLoading}
            onClick={() => { refetchActuals(); refetchMappings(); }}
          >
            Sync
          </Button>
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="actuals" leftSection={<IconChartBar size={15} />}>
            Actuals vs Plan
          </Tabs.Tab>
          <Tabs.Tab value="mapper" leftSection={<IconSettings size={15} />}>
            Project Mapper
            {mappings.length > 0 && (
              <Badge size="xs" ml={6} color="teal">{mappings.length}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Actuals Tab ─────────────────────────────────────────── */}
        <Tabs.Panel value="actuals">
          {mappings.length === 0 ? (
            <Alert icon={<IconInfoCircle />} color="blue">
              No project mappings configured yet. Go to the{' '}
              <strong>Project Mapper</strong> tab to link your Jira epics/labels
              to Portfolio Planner projects.
            </Alert>
          ) : actualsLoading ? (
            <Stack align="center" py="xl">
              <Loader />
              <Text size="sm" c="dimmed">Fetching data from Jira…</Text>
            </Stack>
          ) : (
            <ActualsView
              actuals={actuals}
              projects={projects}
              unit={unit}
            />
          )}
        </Tabs.Panel>

        {/* ── Mapper Tab ──────────────────────────────────────────── */}
        <Tabs.Panel value="mapper">
          <MapperView
            jiraProjects={jiraProjects}
            jiraLoading={jiraLoading}
            jiraError={jiraError}
            ppProjects={projects}
            mappings={mappings}
            onSave={async (req) => {
              await saveMapping.mutateAsync(req);
              notifications.show({ message: 'Mapping saved', color: 'teal', icon: <IconCheck size={16} /> });
            }}
            onDelete={async (id) => {
              await deleteMapping.mutateAsync(id);
              notifications.show({ message: 'Mapping removed', color: 'gray' });
            }}
            onBulkSave={async (reqs) => {
              await saveBulk.mutateAsync(reqs);
              notifications.show({
                message: `${reqs.length} mappings saved`,
                color: 'teal',
                icon: <IconCheck size={16} />,
              });
            }}
            onRefreshJira={() => refetchJira()}
          />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

// ── Actuals View ──────────────────────────────────────────────────────

function ActualsView({
  actuals,
  projects,
  unit,
}: {
  actuals: ActualsRow[];
  projects: ProjectResponse[];
  unit: 'hours' | 'sp';
}) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const projectOptions = actuals.map(a => ({
    value: String(a.ppProjectId),
    label: a.ppProjectName,
  }));

  const filtered = selectedProject
    ? actuals.filter(a => String(a.ppProjectId) === selectedProject)
    : actuals;

  // Build chart data: one bar per month showing actual vs estimated
  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];

    // Aggregate across all selected projects
    const monthTotals: Record<number, { actual: number; label: string }> = {};
    for (const row of filtered) {
      if (row.errorMessage) continue;
      for (const m of MONTHS) {
        const label = row.monthLabels?.[m] ?? `M${m}`;
        const hrs = unit === 'hours'
          ? (row.actualHoursByMonth?.[m] ?? 0)
          : (row.totalStoryPoints > 0 ? (row.actualHoursByMonth?.[m] ?? 0) / 4 : 0);
        if (!monthTotals[m]) monthTotals[m] = { actual: 0, label };
        monthTotals[m].actual += hrs;
      }
    }
    return MONTHS
      .filter(m => monthTotals[m])
      .map(m => ({
        month: monthTotals[m].label,
        actual: Math.round(monthTotals[m].actual * 10) / 10,
      }));
  }, [filtered, unit]);

  const totalActual = filtered.reduce((s, r) => {
    if (r.errorMessage) return s;
    const hrs = unit === 'hours'
      ? Object.values(r.actualHoursByMonth ?? {}).reduce((a, b) => a + b, 0)
      : r.storyPointHours;
    return s + hrs;
  }, 0);

  const totalIssues = filtered.reduce((s, r) => s + (r.issueCount ?? 0), 0);
  const totalSP = filtered.reduce((s, r) => s + (r.totalStoryPoints ?? 0), 0);

  return (
    <Stack gap="md">
      {/* Summary cards */}
      <Group grow>
        <SummaryCard
          label="Total Issues"
          value={String(totalIssues)}
          color={DEEP_BLUE}
        />
        <SummaryCard
          label={unit === 'hours' ? 'Actual Hours' : 'Story Points'}
          value={unit === 'hours'
            ? `${Math.round(totalActual).toLocaleString()} h`
            : `${Math.round(totalSP)} SP`}
          color={AGUA}
        />
        <SummaryCard
          label="Mapped Projects"
          value={String(actuals.filter(a => !a.errorMessage).length)}
          color="#2e7d32"
        />
        <SummaryCard
          label="Errors"
          value={String(actuals.filter(a => !!a.errorMessage).length)}
          color={actuals.some(a => a.errorMessage) ? '#d32f2f' : '#9e9e9e'}
        />
      </Group>

      {/* Filter */}
      <Group>
        <Select
          placeholder="All projects"
          clearable
          data={projectOptions}
          value={selectedProject}
          onChange={setSelectedProject}
          style={{ width: 280 }}
          size="sm"
        />
        <Text size="sm" c="dimmed">
          Showing {filtered.length} of {actuals.length} projects
        </Text>
      </Group>

      {/* Chart */}
      {chartData.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="sm" size="sm">
            {unit === 'hours' ? 'Actual Hours' : 'Story Points'} by Month
          </Text>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RTooltip
                formatter={(v: number) =>
                  unit === 'hours' ? [`${v} hrs`, 'Actual'] : [`${v} SP`, 'Actual']}
              />
              <Bar dataKey="actual" fill={AGUA} radius={[3, 3, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Per-project breakdown table */}
      <Paper withBorder radius="md">
        <Table striped highlightOnHover>
          <Table.Thead style={{ backgroundColor: DEEP_BLUE }}>
            <Table.Tr>
              <Table.Th style={{ color: 'white' }}>Project</Table.Th>
              <Table.Th style={{ color: 'white' }}>Jira Key</Table.Th>
              <Table.Th style={{ color: 'white' }}>Match</Table.Th>
              <Table.Th style={{ color: 'white', textAlign: 'right' }}>Issues</Table.Th>
              <Table.Th style={{ color: 'white', textAlign: 'right' }}>Story Pts</Table.Th>
              <Table.Th style={{ color: 'white', textAlign: 'right' }}>Actual Hrs</Table.Th>
              <Table.Th style={{ color: 'white' }}>Data Source</Table.Th>
              <Table.Th style={{ color: 'white' }}>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: '24px' }}>
                  No actuals data yet
                </Table.Td>
              </Table.Tr>
            )}
            {filtered.map(row => {
              const totalHrs = Object.values(row.actualHoursByMonth ?? {})
                .reduce((a, b) => a + b, 0);
              return (
                <Table.Tr key={row.ppProjectId}>
                  <Table.Td fw={500}>{row.ppProjectName}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="outline">{row.jiraProjectKey}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={row.matchValue}>
                      <Badge size="xs" color={row.matchType === 'EPIC_NAME' ? 'blue' : 'violet'}>
                        {row.matchType?.replace('_', ' ')}
                      </Badge>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{row.issueCount ?? 0}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{row.totalStoryPoints ?? 0}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {Math.round(totalHrs).toLocaleString()} h
                  </Table.Td>
                  <Table.Td>
                    {row.hasTimeData
                      ? <Badge size="xs" color="teal">Time Logged</Badge>
                      : <Badge size="xs" color="gray">Story Points</Badge>}
                  </Table.Td>
                  <Table.Td>
                    {row.errorMessage
                      ? (
                        <Tooltip label={row.errorMessage}>
                          <IconCircleX size={18} color="#d32f2f" />
                        </Tooltip>
                      )
                      : <IconCircleCheck size={18} color="#2e7d32" />}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Per-resource breakdown for selected project */}
      {selectedProject && filtered[0] && !filtered[0].errorMessage && (
        <ResourceBreakdown row={filtered[0]} />
      )}
    </Stack>
  );
}

function ResourceBreakdown({ row }: { row: ActualsRow }) {
  const entries = Object.entries(row.actualHoursByResource ?? {})
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;
  const max = entries[0][1];

  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="md" size="sm">Hours by Team Member — {row.ppProjectName}</Text>
      <Stack gap="xs">
        {entries.map(([name, hours]) => (
          <Group key={name} gap="sm">
            <Text size="sm" style={{ width: 180, flexShrink: 0 }}>{name}</Text>
            <Box style={{ flex: 1 }}>
              <Progress
                value={(hours / max) * 100}
                color={AGUA}
                size="sm"
                radius="xs"
              />
            </Box>
            <Text size="sm" c="dimmed" style={{ width: 60, textAlign: 'right' }}>
              {Math.round(hours)} h
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

// ── Mapper View ───────────────────────────────────────────────────────

function MapperView({
  jiraProjects,
  jiraLoading,
  jiraError,
  ppProjects,
  mappings,
  onSave,
  onDelete,
  onBulkSave,
  onRefreshJira,
}: {
  jiraProjects: JiraProjectInfo[];
  jiraLoading: boolean;
  jiraError: unknown;
  ppProjects: ProjectResponse[];
  mappings: MappingResponse[];
  onSave: (req: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBulkSave: (reqs: any[]) => Promise<void>;
  onRefreshJira: () => void;
}) {
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({
    ppProjectId: '',
    jiraProjectKey: '',
    matchType: 'EPIC_NAME',
    matchValue: '',
  });

  // Derived: epics/labels for selected Jira project
  const selectedJiraProject = jiraProjects.find(p => p.key === form.jiraProjectKey);
  const matchOptions = useMemo(() => {
    if (!selectedJiraProject) return [];
    if (form.matchType === 'EPIC_NAME') {
      return selectedJiraProject.epics.map(e => ({ value: e.name, label: `${e.name} (${e.key})` }));
    }
    if (form.matchType === 'LABEL') {
      return selectedJiraProject.labels.map(l => ({ value: l, label: l }));
    }
    return [];
  }, [selectedJiraProject, form.matchType]);

  const mappingIds = new Set(mappings.map(m => `${m.ppProjectId}:${m.jiraProjectKey}`));

  return (
    <Stack gap="md">
      {/* Header row */}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Link each Portfolio Planner project to a Jira project + epic or label.
          Issues under that epic/label will count as actuals for that project.
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={jiraLoading}
            onClick={onRefreshJira}
          >
            Refresh Jira
          </Button>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            style={{ backgroundColor: DEEP_BLUE }}
            onClick={() => setAddModal(true)}
          >
            Add Mapping
          </Button>
        </Group>
      </Group>

      {/* Jira projects overview */}
      {jiraLoading ? (
        <Loader size="sm" />
      ) : jiraError ? (
        <Alert icon={<IconAlertTriangle />} color="red" title="Failed to load Jira projects">
          <Text size="sm">{(jiraError as any)?.message ?? String(jiraError)}</Text>
          <Text size="xs" c="dimmed" mt={4}>
            Check backend logs, or open{' '}
            <code>http://localhost:8080/api/jira/test</code> in your browser to diagnose.
          </Text>
        </Alert>
      ) : jiraProjects.length === 0 ? (
        <Alert icon={<IconInfoCircle />} color="orange" title="No Jira projects returned">
          <Text size="sm">
            The API returned 0 projects. Possible causes:
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li>API token doesn't have project access</li>
              <li>Wrong <code>base-url</code> in <code>application-local.yml</code></li>
              <li>Authentication is failing — check backend logs or hit{' '}
                <code>http://localhost:8080/api/jira/test</code></li>
            </ul>
          </Text>
        </Alert>
      ) : (
        <Group gap="xs" mb="xs">
          {jiraProjects.map(jp => (
            <Badge
              key={jp.key}
              variant="outline"
              leftSection={<IconTicket size={11} />}
            >
              {jp.key} — {jp.name} ({jp.epics.length} epics)
            </Badge>
          ))}
        </Group>
      )}

      <Divider />

      {/* Mappings table */}
      <Paper withBorder radius="md">
        <Table>
          <Table.Thead style={{ backgroundColor: '#f8fafb' }}>
            <Table.Tr>
              <Table.Th>Portfolio Planner Project</Table.Th>
              <Table.Th>Jira Project</Table.Th>
              <Table.Th>Match Type</Table.Th>
              <Table.Th>Match Value</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mappings.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                  No mappings yet — click "Add Mapping" to get started
                </Table.Td>
              </Table.Tr>
            )}
            {mappings.map(m => (
              <Table.Tr key={m.id}>
                <Table.Td fw={500}>{m.ppProjectName}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="outline" color="blue">{m.jiraProjectKey}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={m.matchType === 'EPIC_NAME' ? 'indigo' : 'violet'}>
                    {m.matchType?.replace('_', ' ')}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" truncate maw={200}>{m.matchValue}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    onClick={() => onDelete(m.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* PP projects with no mapping */}
      {ppProjects.filter(p =>
        p.status === 'ACTIVE' &&
        !mappings.some(m => m.ppProjectId === p.id)
      ).length > 0 && (
        <Alert icon={<IconInfoCircle />} color="blue" title="Projects without Jira mappings">
          <Text size="sm">
            {ppProjects
              .filter(p => p.status === 'ACTIVE' && !mappings.some(m => m.ppProjectId === p.id))
              .map(p => p.name)
              .join(', ')}
          </Text>
        </Alert>
      )}

      {/* Add mapping modal */}
      <Modal
        opened={addModal}
        onClose={() => setAddModal(false)}
        title="Add Jira Mapping"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Portfolio Planner Project"
            placeholder="Select project"
            required
            data={ppProjects
              .filter(p => p.status === 'ACTIVE')
              .map(p => ({ value: String(p.id), label: p.name }))}
            value={form.ppProjectId}
            onChange={v => setForm(f => ({ ...f, ppProjectId: v ?? '' }))}
          />
          <Select
            label="Jira Project"
            placeholder="Select Jira project"
            required
            data={jiraProjects.map(p => ({ value: p.key, label: `${p.key} — ${p.name}` }))}
            value={form.jiraProjectKey}
            onChange={v => setForm(f => ({ ...f, jiraProjectKey: v ?? '', matchValue: '' }))}
          />
          <SegmentedControl
            fullWidth
            size="xs"
            value={form.matchType}
            onChange={v => setForm(f => ({ ...f, matchType: v, matchValue: '' }))}
            data={[
              { label: 'Epic Name', value: 'EPIC_NAME' },
              { label: 'Label', value: 'LABEL' },
              { label: 'Project Name', value: 'PROJECT_NAME' },
            ]}
          />
          {form.matchType !== 'PROJECT_NAME' ? (
            <Select
              label={form.matchType === 'EPIC_NAME' ? 'Epic' : 'Label'}
              placeholder={`Select ${form.matchType === 'EPIC_NAME' ? 'epic' : 'label'}`}
              required
              data={matchOptions}
              value={form.matchValue}
              onChange={v => setForm(f => ({ ...f, matchValue: v ?? '' }))}
              disabled={!form.jiraProjectKey}
              searchable
            />
          ) : (
            <Alert color="gray" icon={<IconInfoCircle />}>
              All issues in the Jira project will be counted for this PP project.
            </Alert>
          )}
          <Button
            fullWidth
            style={{ backgroundColor: DEEP_BLUE }}
            mt="sm"
            disabled={!form.ppProjectId || !form.jiraProjectKey ||
              (form.matchType !== 'PROJECT_NAME' && !form.matchValue)}
            onClick={async () => {
              await onSave({
                ppProjectId: Number(form.ppProjectId),
                jiraProjectKey: form.jiraProjectKey,
                matchType: form.matchType,
                matchValue: form.matchType === 'PROJECT_NAME'
                  ? form.jiraProjectKey
                  : form.matchValue,
              });
              setAddModal(false);
              setForm({ ppProjectId: '', jiraProjectKey: '', matchType: 'EPIC_NAME', matchValue: '' });
            }}
          >
            Save Mapping
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Small summary card ────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">{label}</Text>
      <Text size="xl" fw={700} style={{ color }}>{value}</Text>
    </Paper>
  );
}
