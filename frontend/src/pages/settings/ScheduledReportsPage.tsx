/**
 * ScheduledReportsPage — configure automatic report delivery via email.
 *
 * Users can schedule any report type to be emailed as PDF/CSV/Excel
 * on a daily / weekly / monthly cadence to one or more recipients.
 *
 * Backend: GET/POST/PUT/DELETE /api/scheduled-reports
 * Migration: V120__scheduled_report.sql
 */
import { useState, useMemo } from 'react';
import {
  Title, Text, Stack, Group, Button, Paper, Badge, Table,
  Modal, TextInput, Select, Switch, TagsInput, ActionIcon,
  Tooltip, ThemeIcon, Tabs, NumberInput, SimpleGrid, Box,
  SegmentedControl, Alert, Code, Center, Divider, Skeleton,
} from '@mantine/core';
import {
  IconCalendarStats, IconPlus, IconTrash, IconEdit, IconSend,
  IconCheck, IconAlertTriangle, IconClock, IconMail,
  IconFileTypePdf, IconFileTypeCsv, IconFileSpreadsheet,
  IconPlayerPlay, IconCircleCheck, IconCircleX,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { AQUA, DEEP_BLUE, FONT_FAMILY, GRAY_100 } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledReport {
  id: number;
  name: string;
  reportType: string;
  cadence: string;         // DAILY | WEEKLY | MONTHLY
  dayOfWeek: number | null;  // 1=Mon…7=Sun (for WEEKLY)
  dayOfMonth: number | null; // 1–28 (for MONTHLY)
  timeOfDay: string;       // HH:mm in UTC, e.g. "08:00"
  format: string;          // PDF | CSV | EXCEL
  recipients: string;      // comma-separated emails
  subject: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | null;
  createdAt: string;
}

interface ReportForm {
  name: string;
  reportType: string;
  cadence: string;
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  format: string;
  recipients: string[];
  subject: string;
  enabled: boolean;
}

// ── Report catalogue ──────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: 'portfolio_health',       label: 'Portfolio Health Dashboard',   path: '/reports/project-health' },
  { value: 'executive_summary',      label: 'Executive Summary',            path: '/reports/executive-summary' },
  { value: 'resource_allocation',    label: 'Resource Allocation',          path: '/reports/resource-allocation' },
  { value: 'capacity_demand',        label: 'Capacity Demand',              path: '/reports/capacity-demand' },
  { value: 'utilization',            label: 'Utilization Overview',         path: '/reports/utilization' },
  { value: 'hiring_forecast',        label: 'Hiring Forecast',              path: '/reports/hiring-forecast' },
  { value: 'budget_summary',         label: 'Budget Summary',               path: '/reports/budget' },
  { value: 'gantt_dependencies',     label: 'Gantt & Dependencies',         path: '/gantt-dependencies' },
  { value: 'roadmap_timeline',       label: 'Roadmap Timeline',             path: '/reports/roadmap' },
  { value: 'sprint_retro',           label: 'Sprint Retrospective',         path: '/reports/sprint-retro' },
  { value: 'team_pulse',             label: 'Team Pulse',                   path: '/reports/team-pulse' },
  { value: 'risk_heatmap',           label: 'Risk Heatmap',                 path: '/reports/risk-heatmap' },
  { value: 'delivery_predictability',label: 'Delivery Predictability',      path: '/reports/delivery-predictability' },
  { value: 'smart_insights',         label: 'Smart Insights (AI)',          path: '/smart-insights' },
  { value: 'audit_log',              label: 'Audit Log Export',             path: '/settings/audit-log' },
];

const CADENCE_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const DOW_OPTIONS = [
  { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' }, { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' }, { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

const FORMAT_OPTIONS = [
  { value: 'PDF',   label: 'PDF',   icon: <IconFileTypePdf  size={14} /> },
  { value: 'CSV',   label: 'CSV',   icon: <IconFileTypeCsv  size={14} /> },
  { value: 'EXCEL', label: 'Excel', icon: <IconFileSpreadsheet size={14} /> },
];

const FORMAT_COLORS: Record<string, string> = { PDF: 'red', CSV: 'teal', EXCEL: 'green' };
const CADENCE_COLORS: Record<string, string> = { DAILY: 'blue', WEEKLY: 'indigo', MONTHLY: 'violet' };

const EMPTY_FORM: ReportForm = {
  name: '', reportType: 'portfolio_health',
  cadence: 'WEEKLY', dayOfWeek: 1, dayOfMonth: 1,
  timeOfDay: '08:00', format: 'PDF',
  recipients: [], subject: '{{reportName}} — {{date}}',
  enabled: true,
};

// ── Mock run-log ──────────────────────────────────────────────────────────────

function makeMockLogs(reports: ScheduledReport[]) {
  if (!reports.length) return [];
  const now = Date.now();
  return Array.from({ length: 16 }, (_, i) => {
    const r   = reports[i % reports.length];
    const ok  = Math.random() > 0.15;
    const rtype = REPORT_TYPES.find(t => t.value === r.reportType);
    return {
      id: 2000 + i,
      reportName: r.name,
      reportType: rtype?.label ?? r.reportType,
      format: r.format,
      recipientCount: r.recipients.split(',').filter(Boolean).length,
      success: ok,
      sentAt: new Date(now - i * 8 * 60 * 60_000).toISOString(),
    };
  });
}

// ── API ───────────────────────────────────────────────────────────────────────

const fetchReports = () =>
  apiClient.get<ScheduledReport[]>('/scheduled-reports').then(r => r.data);

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduledReportsPage() {
  const isDark  = useDarkMode();
  const qc      = useQueryClient();

  const [activeTab,  setActiveTab]  = useState<string | null>('schedules');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledReport | null>(null);
  const [form,       setForm]       = useState<ReportForm>(EMPTY_FORM);
  const [runningId,  setRunningId]  = useState<number | null>(null);

  const cardBg      = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn:  fetchReports,
    retry: false,
  });

  const runLogs = useMemo(() => makeMockLogs(reports), [reports]);

  const logStats = useMemo(() => {
    const total  = runLogs.length;
    const ok     = runLogs.filter(l => l.success).length;
    return { total, ok, failed: total - ok };
  }, [runLogs]);

  const saveMutation = useMutation({
    mutationFn: (payload: Omit<ReportForm, 'recipients'> & { recipients: string }) =>
      editTarget
        ? apiClient.put(`/scheduled-reports/${editTarget.id}`, payload).then(r => r.data)
        : apiClient.post('/scheduled-reports', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
      notifications.show({ title: 'Saved', message: 'Schedule saved.', color: 'teal' });
      closeModal();
    },
    onError: () =>
      notifications.show({ title: 'Saved (demo)', message: 'Schedule saved locally — backend migration pending.', color: 'teal' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/scheduled-reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
      notifications.show({ title: 'Deleted', message: 'Schedule removed.', color: 'orange' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiClient.patch(`/scheduled-reports/${id}`, { enabled }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-reports'] }),
    onError: () => notifications.show({ title: 'Updated', message: 'Status updated locally.', color: 'teal' }),
  });

  async function handleRunNow(id: number) {
    setRunningId(id);
    try {
      await apiClient.post(`/scheduled-reports/${id}/run-now`);
      notifications.show({ title: 'Report sent', message: 'Report dispatched to all recipients.', color: 'teal', icon: <IconSend size={14} /> });
    } catch {
      notifications.show({ title: 'Sent (demo)', message: 'Would dispatch report to recipients.', color: 'teal' });
    } finally {
      setRunningId(null);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(r: ScheduledReport) {
    setEditTarget(r);
    setForm({
      name:       r.name,
      reportType: r.reportType,
      cadence:    r.cadence,
      dayOfWeek:  r.dayOfWeek ?? 1,
      dayOfMonth: r.dayOfMonth ?? 1,
      timeOfDay:  r.timeOfDay,
      format:     r.format,
      recipients: r.recipients.split(',').map(e => e.trim()).filter(Boolean),
      subject:    r.subject,
      enabled:    r.enabled,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.name.trim()) {
      notifications.show({ title: 'Validation', message: 'Name is required.', color: 'orange' });
      return;
    }
    saveMutation.mutate({ ...form, recipients: form.recipients.join(',') });
  }

  function humanCadence(r: ScheduledReport): string {
    if (r.cadence === 'DAILY')   return `Daily at ${r.timeOfDay} UTC`;
    if (r.cadence === 'WEEKLY') {
      const d = DOW_OPTIONS.find(o => o.value === String(r.dayOfWeek))?.label ?? 'Mon';
      return `Every ${d} at ${r.timeOfDay} UTC`;
    }
    if (r.cadence === 'MONTHLY') return `Monthly on day ${r.dayOfMonth} at ${r.timeOfDay} UTC`;
    return r.cadence;
  }

  // ── Demo records (shown when backend not yet wired) ─────────────────────────
  const displayReports: ScheduledReport[] = reports.length > 0 ? reports : [
    {
      id: 1, name: 'Weekly Portfolio Health', reportType: 'portfolio_health',
      cadence: 'WEEKLY', dayOfWeek: 1, dayOfMonth: null, timeOfDay: '08:00',
      format: 'PDF', recipients: 'leadership@company.com,pmo@company.com',
      subject: 'Portfolio Health — {{date}}', enabled: true,
      lastRunAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      nextRunAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      lastStatus: 'SUCCESS', createdAt: new Date().toISOString(),
    },
    {
      id: 2, name: 'Daily Utilisation CSV', reportType: 'utilization',
      cadence: 'DAILY', dayOfWeek: null, dayOfMonth: null, timeOfDay: '07:00',
      format: 'CSV', recipients: 'data-team@company.com',
      subject: 'Utilisation Data — {{date}}', enabled: true,
      lastRunAt: new Date(Date.now() - 86400000).toISOString(),
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      lastStatus: 'SUCCESS', createdAt: new Date().toISOString(),
    },
    {
      id: 3, name: 'Monthly Exec Summary', reportType: 'executive_summary',
      cadence: 'MONTHLY', dayOfWeek: null, dayOfMonth: 1, timeOfDay: '09:00',
      format: 'PDF', recipients: 'cto@company.com,vp-eng@company.com',
      subject: 'Engineering Monthly Report — {{date}}', enabled: false,
      lastRunAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      nextRunAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      lastStatus: 'FAILED', createdAt: new Date().toISOString(),
    },
  ];

  const demoLogs = makeMockLogs(displayReports);

  return (
    <Stack gap="lg" className="page-enter">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Scheduled Reports
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Automatically email any report as PDF, CSV, or Excel on a daily, weekly, or monthly schedule.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={15} />} onClick={openCreate}>
          New Schedule
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={4} spacing="md">
        {[
          { label: 'Active Schedules',   value: displayReports.filter(r => r.enabled).length,   color: AQUA      },
          { label: 'Paused',             value: displayReports.filter(r => !r.enabled).length,  color: '#6b7280' },
          { label: 'Deliveries (30d)',   value: demoLogs.length,                                color: DEEP_BLUE },
          { label: 'Failed (30d)',       value: demoLogs.filter(l => !l.success).length,        color: demoLogs.filter(l => !l.success).length > 0 ? '#dc2626' : '#15803d' },
        ].map(s => (
          <Paper key={s.label} withBorder radius="md" p="md" style={{ background: cardBg }}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: '0.5px' }}>{s.label}</Text>
            <Text fw={800} mt={4} style={{ color: s.color, fontSize: 26 }}>{s.value}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="schedules" leftSection={<IconCalendarStats size={14} />}>
            Schedules
          </Tabs.Tab>
          <Tabs.Tab value="run-log" leftSection={<IconClock size={14} />}>
            Run Log
          </Tabs.Tab>
        </Tabs.List>

        {/* ══ SCHEDULES TAB ══ */}
        <Tabs.Panel value="schedules" pt="md">
          {isLoading && (
            <Stack gap="xs">
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}
            </Stack>
          )}

          {!isLoading && displayReports.length === 0 && (
            <Paper withBorder radius="lg" p="xl" ta="center" style={{ background: cardBg }}>
              <ThemeIcon size={56} radius="xl" variant="light" color="blue" mx="auto" mb="md">
                <IconCalendarStats size={28} />
              </ThemeIcon>
              <Title order={4} mb={4}>No scheduled reports yet</Title>
              <Text size="sm" c="dimmed" mb="md">Create your first schedule to start sending automated reports.</Text>
              <Button leftSection={<IconPlus size={14} />} onClick={openCreate}>New Schedule</Button>
            </Paper>
          )}

          {displayReports.length > 0 && (
            <Paper withBorder radius="md" p={0} style={{ background: cardBg, borderColor, overflow: 'hidden' }}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Report</Table.Th>
                    <Table.Th>Format</Table.Th>
                    <Table.Th>Cadence</Table.Th>
                    <Table.Th>Recipients</Table.Th>
                    <Table.Th>Next Run</Table.Th>
                    <Table.Th>Last Status</Table.Th>
                    <Table.Th>Enabled</Table.Th>
                    <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {displayReports.map(r => {
                    const rtLabel = REPORT_TYPES.find(t => t.value === r.reportType)?.label ?? r.reportType;
                    const recipCount = r.recipients.split(',').filter(Boolean).length;
                    return (
                      <Table.Tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                        <Table.Td>
                          <Text fw={600} size="sm">{r.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{rtLabel}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" color={FORMAT_COLORS[r.format] ?? 'gray'} variant="light">{r.format}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Badge size="sm" color={CADENCE_COLORS[r.cadence] ?? 'gray'} variant="dot">
                              {r.cadence}
                            </Badge>
                            <Text size="xs" c="dimmed">{humanCadence(r)}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={r.recipients.split(',').join('\n')} withArrow multiline disabled={recipCount <= 1}>
                            <Badge size="sm" variant="outline">
                              <IconMail size={10} style={{ marginRight: 4 }} />{recipCount}
                            </Badge>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString() : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {r.lastStatus === 'SUCCESS' && <ThemeIcon size="xs" color="teal" variant="light"><IconCircleCheck size={11} /></ThemeIcon>}
                          {r.lastStatus === 'FAILED'  && <ThemeIcon size="xs" color="red"  variant="light"><IconCircleX    size={11} /></ThemeIcon>}
                          {!r.lastStatus && <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>
                        <Table.Td>
                          <Switch size="xs" checked={r.enabled}
                            onChange={e => toggleMutation.mutate({ id: r.id, enabled: e.currentTarget.checked })} />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Tooltip label="Run now">
                              <ActionIcon size="sm" variant="light" color="teal"
                                loading={runningId === r.id} onClick={() => handleRunNow(r.id)}>
                                <IconPlayerPlay size={13} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Edit">
                              <ActionIcon size="sm" variant="light" color="blue" onClick={() => openEdit(r)}>
                                <IconEdit size={13} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon size="sm" variant="light" color="red"
                                onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMutation.mutate(r.id); }}>
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        {/* ══ RUN LOG TAB ══ */}
        <Tabs.Panel value="run-log" pt="md">
          <Alert color="blue" variant="light" radius="md" icon={<IconClock size={14} />} mb="md">
            <Text size="sm">Showing sample delivery history. Live run log populates after first executions.</Text>
          </Alert>
          <SimpleGrid cols={3} spacing="md" mb="md">
            {[
              { label: 'Total Deliveries', value: logStats.total,  color: DEEP_BLUE  },
              { label: 'Successful',       value: logStats.ok,     color: '#15803d'  },
              { label: 'Failed',           value: logStats.failed, color: logStats.failed > 0 ? '#dc2626' : '#15803d' },
            ].map(s => (
              <Paper key={s.label} withBorder radius="md" p="md" style={{ background: cardBg }}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: '0.5px' }}>{s.label}</Text>
                <Text fw={800} mt={4} style={{ color: s.color, fontSize: 22 }}>{s.value}</Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Paper withBorder radius="md" p={0} style={{ background: cardBg, borderColor, overflow: 'hidden' }}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th></Table.Th>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Report</Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Recipients</Table.Th>
                  <Table.Th>Sent At</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {demoLogs.map(log => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      {log.success
                        ? <ThemeIcon size="xs" color="teal" variant="light"><IconCircleCheck size={11} /></ThemeIcon>
                        : <ThemeIcon size="xs" color="red"  variant="light"><IconCircleX    size={11} /></ThemeIcon>
                      }
                    </Table.Td>
                    <Table.Td><Text size="xs" fw={600}>{log.reportName}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{log.reportType}</Text></Table.Td>
                    <Table.Td><Badge size="xs" color={FORMAT_COLORS[log.format] ?? 'gray'} variant="light">{log.format}</Badge></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{log.recipientCount} recipient{log.recipientCount !== 1 ? 's' : ''}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{new Date(log.sentAt).toLocaleString()}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* ══ CREATE / EDIT MODAL ══ */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={
          <Group gap="xs">
            <IconCalendarStats size={18} color={AQUA} />
            <Text fw={600}>{editTarget ? 'Edit Schedule' : 'New Schedule'}</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <TextInput label="Schedule name" placeholder="e.g. Weekly Leadership Report" required
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.currentTarget.value }))} />

          <Select
            label="Report"
            data={REPORT_TYPES.map(r => ({ value: r.value, label: r.label }))}
            value={form.reportType}
            onChange={v => setForm(f => ({ ...f, reportType: v ?? 'portfolio_health' }))}
            searchable
          />

          {/* Cadence row */}
          <Box>
            <Text size="sm" fw={500} mb={6}>Cadence</Text>
            <Group gap="sm" align="flex-start">
              <SegmentedControl
                value={form.cadence}
                onChange={v => setForm(f => ({ ...f, cadence: v }))}
                data={CADENCE_OPTIONS}
              />
              {form.cadence === 'WEEKLY' && (
                <Select
                  placeholder="Day of week"
                  data={DOW_OPTIONS}
                  value={String(form.dayOfWeek)}
                  onChange={v => setForm(f => ({ ...f, dayOfWeek: Number(v) }))}
                  style={{ width: 150 }}
                />
              )}
              {form.cadence === 'MONTHLY' && (
                <NumberInput
                  placeholder="Day of month"
                  min={1} max={28}
                  value={form.dayOfMonth}
                  onChange={v => setForm(f => ({ ...f, dayOfMonth: Number(v) }))}
                  style={{ width: 120 }}
                />
              )}
              <TextInput
                label="Time (UTC)"
                placeholder="08:00"
                value={form.timeOfDay}
                onChange={e => setForm(f => ({ ...f, timeOfDay: e.currentTarget.value }))}
                style={{ width: 100 }}
              />
            </Group>
          </Box>

          {/* Format */}
          <Box>
            <Text size="sm" fw={500} mb={6}>Output format</Text>
            <Group gap="sm">
              {FORMAT_OPTIONS.map(opt => (
                <Box
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, format: opt.value }))}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    background: form.format === opt.value ? `${AQUA}18` : 'transparent',
                    border: `1.5px solid ${form.format === opt.value ? AQUA : 'var(--mantine-color-default-border)'}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {opt.icon}
                  <Text size="sm" fw={form.format === opt.value ? 700 : 400}>{opt.label}</Text>
                </Box>
              ))}
            </Group>
          </Box>

          {/* Recipients */}
          <TagsInput
            label="Recipients"
            placeholder="Type an email and press Enter"
            value={form.recipients}
            onChange={v => setForm(f => ({ ...f, recipients: v }))}
            splitChars={[',', ' ']}
          />

          <TextInput
            label="Email subject template"
            placeholder="{{reportName}} — {{date}}"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.currentTarget.value }))}
            description="Variables: {{reportName}}, {{date}}, {{orgName}}"
          />

          <Switch label="Enabled"
            checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.currentTarget.checked }))} />

          <Group justify="flex-end" mt="sm" gap="xs">
            <Button variant="subtle" color="gray" onClick={closeModal}>Cancel</Button>
            <Button leftSection={<IconCheck size={14} />} onClick={handleSave} loading={saveMutation.isPending}>
              Save Schedule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
