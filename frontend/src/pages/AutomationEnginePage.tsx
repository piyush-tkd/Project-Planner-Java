import { useState, useMemo } from 'react';
import {
  Box, Text, Group, Button, Badge, Card, Stack, Switch,
  Modal, TextInput, Textarea, Select, SimpleGrid, Paper, Tooltip,
  ActionIcon, ThemeIcon, Divider, Tabs, ScrollArea, Loader, Center,
  Alert,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconEdit, IconPlayerPlay, IconBolt,
  IconChevronRight, IconCheck, IconX, IconAlertTriangle,
  IconBell, IconFlag, IconArrowsShuffle, IconClipboardList,
  IconShieldExclamation, IconInfoCircle, IconClock, IconRocket,
} from '@tabler/icons-react';
import {
  useAutomationRules, useCreateAutomationRule, useUpdateAutomationRule,
  useToggleAutomationRule, useDeleteAutomationRule, useFireAutomationRule,
  AutomationRule, AutomationRuleRequest,
  TRIGGER_EVENTS, CONDITION_FIELDS, CONDITION_OPERATORS, ACTION_TYPES,
} from '../api/automationRules';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import { AQUA, COLOR_BLUE, COLOR_GREEN, COLOR_ORANGE_ALT, DEEP_BLUE, FONT_FAMILY, SURFACE_LIGHT, TEXT_SUBTLE } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TRIGGER_ICON: Record<string, React.ReactNode> = {
  PROJECT_STATUS_CHANGED:  <IconArrowsShuffle size={16} />,
  TARGET_DATE_PASSED:      <IconClock size={16} />,
  PROJECT_CREATED:         <IconRocket size={16} />,
  UTILIZATION_EXCEEDED:    <IconAlertTriangle size={16} />,
  SPRINT_STARTED:          <IconPlayerPlay size={16} />,
  RESOURCE_OVERALLOCATED:  <IconAlertTriangle size={16} />,
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  SEND_NOTIFICATION: <IconBell size={16} />,
  FLAG_PROJECT:      <IconFlag size={16} />,
  CHANGE_STATUS:     <IconArrowsShuffle size={16} />,
  LOG_ACTIVITY:      <IconClipboardList size={16} />,
  ADD_RISK:          <IconShieldExclamation size={16} />,
};

const ACTION_COLOR: Record<string, string> = {
  SEND_NOTIFICATION: 'blue',
  FLAG_PROJECT:      'orange',
  CHANGE_STATUS:     'teal',
  LOG_ACTIVITY:      'gray',
  ADD_RISK:          'red',
};

const PROJECT_STATUSES = ['NOT_STARTED', 'IN_DISCOVERY', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITIES       = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST', 'BLOCKER', 'MINOR'];
const FLAG_COLORS      = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const SEVERITIES       = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const RECIPIENT_OPTS   = [
  { value: 'owner',   label: 'Project owner' },
  { value: 'admin',   label: 'Admins only' },
  { value: 'all',     label: 'All users' },
];

function labelOf(arr: { value: string; label: string }[], val: string | null | undefined) {
  return arr.find(x => x.value === val)?.label ?? val ?? '—';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString();
}

// ── Empty builder state ────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<AutomationRuleRequest, never> = {
  name: '',
  description: '',
  enabled: true,
  triggerEvent: '',
  triggerValue: null as unknown as string,
  conditionField: null as unknown as string,
  conditionOperator: null as unknown as string,
  conditionValue: null as unknown as string,
  actionType: '',
  actionPayload: {},
};

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onFire,
}: {
  rule: AutomationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onFire: () => void;
}) {
  const dark = useDarkMode();
  const trigger = TRIGGER_EVENTS.find(t => t.value === rule.triggerEvent);
  const action  = ACTION_TYPES.find(a => a.value === rule.actionType);

  return (
    <Card
      withBorder
      radius="md"
      p={0}
      style={{
        opacity: rule.enabled ? 1 : 0.55,
        borderLeft: `4px solid ${rule.enabled ? AQUA : TEXT_SUBTLE}`,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Header */}
      <Box p="md" pb="xs">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Group gap="sm" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <ThemeIcon
              size={36}
              radius="md"
              variant="light"
              color={rule.enabled ? 'cyan' : 'gray'}
              style={{ flexShrink: 0 }}
            >
              <IconBolt size={18} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text fw={700} size="sm" style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                {rule.name}
              </Text>
              {rule.description && (
                <Text size="xs" c="dimmed" lineClamp={1} style={{ fontFamily: FONT_FAMILY }}>
                  {rule.description}
                </Text>
              )}
            </Box>
          </Group>
          <Group gap={6} style={{ flexShrink: 0 }}>
            <Switch
              size="xs"
              checked={rule.enabled}
              onChange={onToggle}
              color="cyan"
            />
            <Tooltip label="Test-fire rule">
              <ActionIcon size="sm" variant="subtle" color="teal" onClick={onFire}>
                <IconPlayerPlay size={14} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon size="sm" variant="subtle" color="blue" onClick={onEdit}>
              <IconEdit size={14} />
            </ActionIcon>
            <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      <Divider />

      {/* Pipeline: trigger → condition → action */}
      <Group p="md" pt="xs" gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
        {/* Trigger */}
        <Paper
          p="xs"
          radius="sm"
          style={{
            background: dark ? 'rgba(45,204,211,0.08)' : '#f0fdfe',
            border: `1px solid ${AQUA}33`,
            minWidth: 140, flexShrink: 0,
          }}
        >
          <Text size="10px" fw={700} tt="uppercase" c="dimmed" mb={3} style={{ letterSpacing: '0.5px' }}>
            WHEN
          </Text>
          <Group gap={4}>
            <span style={{ color: AQUA }}>{TRIGGER_ICON[rule.triggerEvent]}</span>
            <Text size="xs" fw={600} style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {trigger?.label ?? rule.triggerEvent}
            </Text>
          </Group>
          {rule.triggerValue && (
            <Badge size="xs" color="cyan" variant="light" mt={4}>= {rule.triggerValue}</Badge>
          )}
        </Paper>

        <IconChevronRight size={14} color={TEXT_SUBTLE} style={{ flexShrink: 0 }} />

        {/* Condition (optional) */}
        {rule.conditionField ? (
          <>
            <Paper
              p="xs"
              radius="sm"
              style={{
                background: dark ? 'rgba(99,102,241,0.08)' : '#f5f3ff',
                border: '1px solid #a5b4fc44',
                minWidth: 140, flexShrink: 0,
              }}
            >
              <Text size="10px" fw={700} tt="uppercase" c="dimmed" mb={3} style={{ letterSpacing: '0.5px' }}>
                IF
              </Text>
              <Text size="xs" fw={600} style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                {labelOf(CONDITION_FIELDS, rule.conditionField)}
              </Text>
              <Text size="xs" c="dimmed">
                {labelOf(CONDITION_OPERATORS, rule.conditionOperator)} {rule.conditionValue}
              </Text>
            </Paper>
            <IconChevronRight size={14} color={TEXT_SUBTLE} style={{ flexShrink: 0 }} />
          </>
        ) : null}

        {/* Action */}
        <Paper
          p="xs"
          radius="sm"
          style={{
            background: dark ? `rgba(${ACTION_COLOR[rule.actionType] === 'blue' ? '59,130,246' : '249,115,22'},0.08)` : '#fff7ed',
            border: `1px solid ${ACTION_COLOR[rule.actionType] ?? 'orange'}33`,
            minWidth: 140, flexShrink: 0,
          }}
        >
          <Text size="10px" fw={700} tt="uppercase" c="dimmed" mb={3} style={{ letterSpacing: '0.5px' }}>
            THEN
          </Text>
          <Group gap={4}>
            <span style={{ color: ACTION_COLOR[rule.actionType] === 'blue' ? COLOR_BLUE : COLOR_ORANGE_ALT }}>
              {ACTION_ICON[rule.actionType]}
            </span>
            <Text size="xs" fw={600} style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {action?.label ?? rule.actionType}
            </Text>
          </Group>
        </Paper>
      </Group>

      {/* Footer stats */}
      <Box
        px="md"
        pb="xs"
        style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : SURFACE_LIGHT}` }}
      >
        <Group gap="lg" mt="xs">
          <Text size="xs" c="dimmed">
            Fired <strong>{rule.fireCount}</strong> {rule.fireCount === 1 ? 'time' : 'times'}
          </Text>
          {rule.lastFiredAt && (
            <Text size="xs" c="dimmed">
              Last: {formatDate(rule.lastFiredAt)}
            </Text>
          )}
          {rule.createdBy && (
            <Text size="xs" c="dimmed">
              By {rule.createdBy}
            </Text>
          )}
        </Group>
      </Box>
    </Card>
  );
}

// ── Action payload fields ──────────────────────────────────────────────────────

function ActionPayloadFields({
  actionType,
  payload,
  onChange,
}: {
  actionType: string;
  payload: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const v = (k: string) => (payload[k] as string) ?? '';

  if (actionType === 'SEND_NOTIFICATION') return (
    <Stack gap="sm">
      <Select
        label="Recipients"
        data={RECIPIENT_OPTS}
        value={v('recipients') || 'owner'}
        onChange={val => onChange('recipients', val)}
        size="sm"
      />
      <Textarea
        label="Message"
        placeholder="e.g. Project {{name}} has been placed on hold"
        value={v('message')}
        onChange={e => onChange('message', e.currentTarget.value)}
        rows={2}
        size="sm"
      />
    </Stack>
  );

  if (actionType === 'FLAG_PROJECT') return (
    <Stack gap="sm">
      <Select
        label="Flag colour"
        data={FLAG_COLORS.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
        value={v('flagColor') || 'red'}
        onChange={val => onChange('flagColor', val)}
        size="sm"
      />
      <TextInput
        label="Reason"
        placeholder="e.g. At risk — target date passed"
        value={v('reason')}
        onChange={e => onChange('reason', e.currentTarget.value)}
        size="sm"
      />
    </Stack>
  );

  if (actionType === 'CHANGE_STATUS') return (
    <Select
      label="New status"
      data={PROJECT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }))}
      value={v('newStatus') || 'ON_HOLD'}
      onChange={val => onChange('newStatus', val)}
      size="sm"
    />
  );

  if (actionType === 'LOG_ACTIVITY') return (
    <Textarea
      label="Log message"
      placeholder="e.g. Automatically flagged as overdue"
      value={v('logMessage')}
      onChange={e => onChange('logMessage', e.currentTarget.value)}
      rows={2}
      size="sm"
    />
  );

  if (actionType === 'ADD_RISK') return (
    <Stack gap="sm">
      <TextInput
        label="Risk title"
        placeholder="e.g. Overdue project with active blockers"
        value={v('title')}
        onChange={e => onChange('title', e.currentTarget.value)}
        size="sm"
      />
      <Select
        label="Severity"
        data={SEVERITIES.map(s => ({ value: s, label: s }))}
        value={v('severity') || 'HIGH'}
        onChange={val => onChange('severity', val)}
        size="sm"
      />
    </Stack>
  );

  return null;
}

// ── Rule builder modal ────────────────────────────────────────────────────────

function RuleModal({
  opened,
  initial,
  onClose,
  onSave,
  saving,
}: {
  opened: boolean;
  initial: AutomationRuleRequest & { id?: number };
  onClose: () => void;
  onSave: (data: AutomationRuleRequest & { id?: number }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  // Reset form when initial changes (edit vs new)
  const setF = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  const selectedTrigger = TRIGGER_EVENTS.find(t => t.value === form.triggerEvent);
  const selectedAction  = ACTION_TYPES.find(a => a.value === form.actionType);

  const valid = form.name.trim() && form.triggerEvent && form.actionType;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size={28} radius="md" variant="light" color="cyan">
            <IconBolt size={16} />
          </ThemeIcon>
          <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
            {initial.id ? 'Edit automation rule' : 'New automation rule'}
          </Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="lg">
        {/* Basics */}
        <Stack gap="sm">
          <TextInput
            label="Rule name"
            placeholder="e.g. Flag overdue active projects"
            value={form.name}
            onChange={e => setF({ name: e.currentTarget.value })}
            required
            size="sm"
          />
          <Textarea
            label="Description (optional)"
            placeholder="What does this rule do?"
            value={form.description ?? ''}
            onChange={e => setF({ description: e.currentTarget.value })}
            rows={2}
            size="sm"
          />
        </Stack>

        <Divider label="Trigger — when should this fire?" labelPosition="left" />

        {/* Trigger */}
        <Stack gap="sm">
          <Select
            label="Event"
            placeholder="Pick a trigger event…"
            data={TRIGGER_EVENTS.map(t => ({ value: t.value, label: t.label }))}
            value={form.triggerEvent || null}
            onChange={val => setF({ triggerEvent: val ?? '', triggerValue: null as unknown as string })}
            size="sm"
          />
          {selectedTrigger?.description && (
            <Text size="xs" c="dimmed">{selectedTrigger.description}</Text>
          )}
          {selectedTrigger?.hasValue && (
            <Select
              label="Trigger value"
              placeholder="Specific value to match (optional)"
              data={
                form.triggerEvent === 'PROJECT_STATUS_CHANGED'
                  ? PROJECT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }))
                  : form.triggerEvent === 'UTILIZATION_EXCEEDED'
                  ? ['80', '90', '100', '110', '120'].map(v => ({ value: v, label: `>${v}%` }))
                  : []
              }
              value={form.triggerValue ?? null}
              onChange={val => setF({ triggerValue: val as string })}
              clearable
              size="sm"
            />
          )}
        </Stack>

        <Divider label="Condition — optional extra filter" labelPosition="left" />

        {/* Condition */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <Select
            label="Field"
            placeholder="Any"
            data={CONDITION_FIELDS}
            value={form.conditionField ?? null}
            onChange={val => setF({ conditionField: val as string, conditionValue: null as unknown as string })}
            clearable
            size="sm"
          />
          <Select
            label="Operator"
            placeholder="—"
            data={CONDITION_OPERATORS}
            value={form.conditionOperator ?? null}
            onChange={val => setF({ conditionOperator: val as string })}
            disabled={!form.conditionField}
            clearable
            size="sm"
          />
          {form.conditionField === 'status' ? (
            <Select
              label="Value"
              placeholder="—"
              data={PROJECT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }))}
              value={form.conditionValue ?? null}
              onChange={val => setF({ conditionValue: val as string })}
              disabled={!form.conditionField}
              clearable
              size="sm"
            />
          ) : form.conditionField === 'priority' ? (
            <Select
              label="Value"
              placeholder="—"
              data={PRIORITIES}
              value={form.conditionValue ?? null}
              onChange={val => setF({ conditionValue: val as string })}
              disabled={!form.conditionField}
              clearable
              size="sm"
            />
          ) : (
            <TextInput
              label="Value"
              placeholder="—"
              value={form.conditionValue ?? ''}
              onChange={e => setF({ conditionValue: e.currentTarget.value })}
              disabled={!form.conditionField}
              size="sm"
            />
          )}
        </SimpleGrid>

        <Divider label="Action — what should happen?" labelPosition="left" />

        {/* Action */}
        <Stack gap="sm">
          <Select
            label="Action type"
            placeholder="Pick an action…"
            data={ACTION_TYPES.map(a => ({ value: a.value, label: a.label }))}
            value={form.actionType || null}
            onChange={val => setF({ actionType: val ?? '', actionPayload: {} })}
            size="sm"
          />
          {selectedAction?.description && (
            <Text size="xs" c="dimmed">{selectedAction.description}</Text>
          )}
          {form.actionType && (
            <ActionPayloadFields
              actionType={form.actionType}
              payload={form.actionPayload ?? {}}
              onChange={(k, v) => setF({ actionPayload: { ...(form.actionPayload ?? {}), [k]: v } })}
            />
          )}
        </Stack>

        {/* Footer */}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            leftSection={saving ? <Loader size={14} /> : <IconCheck size={14} />}
            disabled={!valid || saving}
            onClick={() => onSave(form)}
            style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
          >
            {initial.id ? 'Save changes' : 'Create rule'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AutomationEnginePage() {
  const dark = useDarkMode();
  const { data: rules, isLoading, isError } = useAutomationRules();

  const createRule  = useCreateAutomationRule();
  const updateRule  = useUpdateAutomationRule();
  const toggleRule  = useToggleAutomationRule();
  const deleteRule  = useDeleteAutomationRule();
  const fireRule    = useFireAutomationRule();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<(AutomationRuleRequest & { id?: number }) | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AutomationRule | null>(null);
  const [activeTab, setActiveTab]   = useState<string | null>('all');

  const enabledCount  = rules?.filter(r => r.enabled).length  ?? 0;
  const disabledCount = rules?.filter(r => !r.enabled).length ?? 0;
  const totalFires    = rules?.reduce((s, r) => s + r.fireCount, 0) ?? 0;

  const filtered = useMemo(() => {
    if (!rules) return [];
    if (activeTab === 'enabled')  return rules.filter(r =>  r.enabled);
    if (activeTab === 'disabled') return rules.filter(r => !r.enabled);
    return rules;
  }, [rules, activeTab]);

  function openCreate() {
    setEditTarget({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditTarget({
      id:                rule.id,
      name:              rule.name,
      description:       rule.description ?? '',
      enabled:           rule.enabled,
      triggerEvent:      rule.triggerEvent,
      triggerValue:      rule.triggerValue ?? null as unknown as string,
      conditionField:    rule.conditionField ?? null as unknown as string,
      conditionOperator: rule.conditionOperator ?? null as unknown as string,
      conditionValue:    rule.conditionValue ?? null as unknown as string,
      actionType:        rule.actionType,
      actionPayload:     rule.actionPayload ?? {},
    });
    setModalOpen(true);
  }

  async function handleSave(data: AutomationRuleRequest & { id?: number }) {
    try {
      if (data.id) {
        await updateRule.mutateAsync({ id: data.id, data });
        notifications.show({ title: 'Saved', message: 'Rule updated', color: 'teal', icon: <IconCheck size={16} /> });
      } else {
        await createRule.mutateAsync(data);
        notifications.show({ title: 'Created', message: 'Automation rule created', color: 'teal', icon: <IconCheck size={16} /> });
      }
      setModalOpen(false);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save rule', color: 'red', icon: <IconX size={16} /> });
    }
  }

  async function handleDelete(rule: AutomationRule) {
    try {
      await deleteRule.mutateAsync(rule.id);
      notifications.show({ title: 'Deleted', message: `"${rule.name}" removed`, color: 'gray' });
      setDeleteConfirm(null);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete rule', color: 'red' });
    }
  }

  async function handleFire(rule: AutomationRule) {
    try {
      await fireRule.mutateAsync(rule.id);
      notifications.show({ title: 'Fired!', message: `Rule "${rule.name}" test-fired successfully`, color: 'teal', icon: <IconPlayerPlay size={16} /> });
    } catch {
      notifications.show({ title: 'Error', message: 'Test fire failed', color: 'red' });
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (isError)   return <PageError context="Loading automation rules" />;

  return (
    <PPPageLayout title="Automation Engine" subtitle="Create and manage workflow automation rules" animate
      actions={
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openCreate}
          style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
        >
          New Rule
        </Button>
      }
    >
      <Box style={{ fontFamily: FONT_FAMILY, paddingBottom: 40 }}>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        {[
          { label: 'Total rules',      value: rules?.length ?? 0, color: DEEP_BLUE },
          { label: 'Active',           value: enabledCount,        color: COLOR_GREEN },
          { label: 'Inactive',         value: disabledCount,       color: TEXT_SUBTLE },
          { label: 'Total executions', value: totalFires,          color: AQUA },
        ].map(({ label, value, color }) => (
          <Paper key={label} withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb={4} style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
            <Text fw={800} size="xl" style={{ color, fontFamily: FONT_FAMILY }}>{value}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* ── Info banner (no backend yet) ───────────────────────────────────── */}
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="lg" style={{ fontSize: 13 }}>
        Rules are stored and managed here. Automatic execution hooks into project mutations and the
        nightly scheduler — ensure the backend Automation Engine service is deployed to run rules in production.
        Use the <strong>▶ test-fire</strong> button to simulate a rule manually.
      </Alert>

      {/* ── Tabs + list ────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="md" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="all">All ({rules?.length ?? 0})</Tabs.Tab>
          <Tabs.Tab value="enabled">
            <Group gap={4}>Active <Badge size="xs" color="green" variant="light">{enabledCount}</Badge></Group>
          </Tabs.Tab>
          <Tabs.Tab value="disabled">
            <Group gap={4}>Inactive <Badge size="xs" color="gray" variant="light">{disabledCount}</Badge></Group>
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {filtered.length === 0 ? (
        <Center py={80}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="cyan">
              <IconBolt size={32} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600} size="lg" style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {activeTab === 'all' ? 'No automation rules yet' : `No ${activeTab} rules`}
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={400} style={{ fontFamily: FONT_FAMILY }}>
              {activeTab === 'all'
                ? 'Create your first rule to automatically flag overdue projects, send notifications when status changes, or trigger risk items.'
                : `Switch to the All tab to see all rules.`}
            </Text>
            {activeTab === 'all' && (
              <Button leftSection={<IconPlus size={14} />} onClick={openCreate}
                style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}>
                Create first rule
              </Button>
            )}
          </Stack>
        </Center>
      ) : (
        <ScrollArea>
          <Stack gap="md">
            {filtered.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => openEdit(rule)}
                onDelete={() => setDeleteConfirm(rule)}
                onToggle={() => toggleRule.mutate(rule.id)}
                onFire={() => handleFire(rule)}
              />
            ))}
          </Stack>
        </ScrollArea>
      )}

      {/* ── Rule builder modal ─────────────────────────────────────────────── */}
      {editTarget && (
        <RuleModal
          opened={modalOpen}
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={createRule.isPending || updateRule.isPending}
        />
      )}

      {/* ── Delete confirm modal ───────────────────────────────────────────── */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={<Text fw={700} c="red" size="sm">Delete rule?</Text>}
        size="xs"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              color="red"
              leftSection={deleteRule.isPending ? <Loader size={14} /> : <IconTrash size={14} />}
              disabled={deleteRule.isPending}
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
      </Box>
    </PPPageLayout>
  );
}
