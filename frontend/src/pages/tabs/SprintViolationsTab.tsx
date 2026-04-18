import React, { useMemo, useState } from 'react';
import {
  Stack, Group, Text, Badge, Paper, SimpleGrid,
  Table, ThemeIcon, Alert, Box, Anchor,
  TextInput, Loader, Tooltip, Modal, ScrollArea,
  Switch, NumberInput, Select, MultiSelect, Button,
  ActionIcon, UnstyledButton, Popover, Checkbox,
} from '@mantine/core';
import {
  IconAlertTriangle, IconCalendarOff, IconVersions,
  IconClock, IconFlag, IconSearch, IconCircleCheck,
  IconSettings, IconPlus, IconPointFilled, IconRefresh, IconTrash, IconX,
  IconColumns,
} from '@tabler/icons-react';
import { useAllActiveSprintIssues, usePodList, useSprintNames, IssueWithPod } from '../../api/backlog';
import { useJiraStatus } from '../../api/jira';
import {
  ViolationRule, ViolationCheck, RuleType, FieldType,
  isRuleActiveForType, ruleTypeOptionsForField,
  defaultChecksForField, newCheckId,
  useViolationRules, useSaveViolationRules,
  useAvailableViolationFields, useAvailableIssueTypes,
  useSyncFieldNames, useFieldValues,
} from '../../api/violationRules';
import {
  DEEP_BLUE, AQUA, UX_ERROR, UX_WARNING, BORDER_DEFAULT,
} from '../../brandTokens';

// ── Violation detection ───────────────────────────────────────────────────────

interface ViolationHit {
  ruleId: string;   // parent rule (for KPI grouping/filtering)
  checkId: string;  // specific check within rule
  label: string;
  color: string;
}
interface ViolatedIssue extends IssueWithPod { hits: ViolationHit[]; }

function hitColor(type: RuleType, ruleId: string): string {
  if (ruleId === 'overdue')      return 'red';
  if (ruleId === 'missing-date') return 'orange';
  if (ruleId === 'no-version')   return 'gray';
  if (ruleId === 'long-running') return 'yellow';
  if (type === 'not-overdue')    return 'red';
  if (type === 'threshold')      return 'yellow';
  return 'orange';
}

/** Evaluate one check against a custom field value. Returns a hit or null. */
function evalCustomCheck(
  rule: ViolationRule,
  check: ViolationCheck,
  fieldVal: string,
  today: string,
): ViolationHit | null {
  const displayName = rule.fieldName ?? rule.label;
  const base = check.label ?? displayName;
  const id   = { ruleId: rule.id, checkId: check.id };

  switch (check.type) {
    case 'required':
      if (!fieldVal || fieldVal.trim() === '')
        return { ...id, label: `${base} missing`, color: 'orange' };
      break;
    case 'not-overdue':
      if (!fieldVal || fieldVal.trim() === '')
        return { ...id, label: `${base} missing`, color: 'orange' };
      if (fieldVal < today)
        return { ...id, label: `${base} overdue`, color: 'red' };
      break;
    case 'min-value': {
      const num = parseFloat(fieldVal);
      const min = check.threshold ?? 1;
      if (isNaN(num) || num < min)
        return { ...id, label: `${base} below ${min}`, color: 'orange' };
      break;
    }
    case 'one-of': {
      const allowed = check.allowedValues ?? [];
      if (allowed.length > 0 && (!fieldVal || !allowed.includes(fieldVal)))
        return { ...id, label: `${base} invalid value`, color: 'orange' };
      break;
    }
  }
  return null;
}

/** Evaluate one check against a built-in rule. Returns a hit or null. */
function evalBuiltInCheck(
  rule: ViolationRule,
  check: ViolationCheck,
  issue: IssueWithPod,
  today: string,
): ViolationHit | null {
  const id = { ruleId: rule.id, checkId: check.id };
  switch (rule.id) {
    case 'missing-date':
      if (!issue.dueDate)
        return { ...id, label: rule.label, color: hitColor(check.type, rule.id) };
      break;
    case 'overdue':
      if (issue.dueDate && issue.dueDate < today)
        return { ...id, label: rule.label, color: hitColor(check.type, rule.id) };
      break;
    case 'no-version':
      if (!issue.fixVersionName)
        return { ...id, label: rule.label, color: hitColor(check.type, rule.id) };
      break;
    case 'long-running': {
      const thr = check.threshold ?? 5;
      if (issue.statusCategory?.toLowerCase() === 'indeterminate' &&
          (issue.timeInCurrentStatusDays ?? 0) >= thr)
        return { ...id, label: `${rule.label} (${thr}+ d)`, color: hitColor(check.type, rule.id) };
      break;
    }
    case 'no-story-points':
      if (!issue.storyPoints)
        return { ...id, label: rule.label, color: hitColor(check.type, rule.id) };
      break;
  }
  return null;
}

function classifyIssue(issue: IssueWithPod, rules: ViolationRule[]): ViolationHit[] {
  const hits: ViolationHit[] = [];
  if (issue.statusCategory?.toLowerCase() === 'done') return hits;
  const today       = new Date().toISOString().slice(0, 10);
  const issueStatus = issue.statusName ?? '';

  for (const rule of rules) {
    if (!isRuleActiveForType(rule, issue.issueType)) continue;

    for (const check of rule.checks) {
      // Status filter: skip this check if issue is not in allowed statuses
      if (check.statuses.length > 0 && !check.statuses.includes(issueStatus)) continue;

      const hit = rule.builtIn
        ? evalBuiltInCheck(rule, check, issue, today)
        : evalCustomCheck(rule, check, rule.fieldName ? (issue.customFields?.[rule.fieldName] ?? '') : '', today);

      if (hit) hits.push(hit);
    }
  }
  return hits;
}

// ── Column config ─────────────────────────────────────────────────────────────

const CONFIGURABLE_COLS = [
  { id: 'pod',          label: 'POD' },
  { id: 'issueType',    label: 'Type' },
  { id: 'assignee',     label: 'Assignee' },
  { id: 'status',       label: 'Status' },
  { id: 'priority',     label: 'Priority' },
  { id: 'dueDate',      label: 'Due Date' },
  { id: 'timeInStatus', label: 'Days in Status' },
  { id: 'epic',         label: 'Epic' },
  { id: 'storyPoints',  label: 'Story Points' },
] as const;

const DEFAULT_COL_IDS = new Set(['pod', 'issueType', 'assignee', 'status', 'priority', 'timeInStatus']);

// ── KPI card ──────────────────────────────────────────────────────────────────

function ViolationKpi({ label, count, icon, color, active, onClick }: {
  label: string; count: number; icon: React.ReactNode; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <Paper withBorder p="md" radius="md" onClick={onClick}
      style={{ cursor: 'pointer', borderColor: active ? UX_ERROR : BORDER_DEFAULT, borderWidth: active ? 2 : 1 }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
          <Text size="xl" fw={700} c={count > 0 ? UX_ERROR : 'green'}>{count}</Text>
        </Stack>
        <ThemeIcon variant="light" size="lg" radius="md" color={color}>{icon}</ThemeIcon>
      </Group>
      {active && <Badge size="xs" color="red" variant="filled" mt={6}>Filtered</Badge>}
    </Paper>
  );
}

// ── Issue table ───────────────────────────────────────────────────────────────

function IssueTable({ violations, search, jiraBaseUrl, visibleCols }: {
  violations: ViolatedIssue[];
  search: string;
  jiraBaseUrl: string;
  visibleCols: Set<string>;
}) {
  const today    = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return violations;
    return violations.filter(v =>
      v.key.toLowerCase().includes(q) || v.summary.toLowerCase().includes(q) ||
      (v.assignee ?? '').toLowerCase().includes(q) || v.podDisplayName.toLowerCase().includes(q)
    );
  }, [violations, search]);

  const col = (id: string) => visibleCols.has(id);

  if (filtered.length === 0)
    return <Alert icon={<IconCircleCheck size={14} />} color="green" mt="sm">No violations found{search ? ' matching your search' : ''}.</Alert>;

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover style={{ minWidth: 700 }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 90 }}>Key</Table.Th>
            <Table.Th>Summary</Table.Th>
            {col('pod')          && <Table.Th>POD</Table.Th>}
            {col('issueType')    && <Table.Th>Type</Table.Th>}
            {col('assignee')     && <Table.Th>Assignee</Table.Th>}
            {col('status')       && <Table.Th>Status</Table.Th>}
            {col('priority')     && <Table.Th>Priority</Table.Th>}
            {col('dueDate')      && <Table.Th>Due Date</Table.Th>}
            {col('timeInStatus') && <Table.Th>Days in Status</Table.Th>}
            {col('epic')         && <Table.Th>Epic</Table.Th>}
            {col('storyPoints')  && <Table.Th>SP</Table.Th>}
            <Table.Th>Violations</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map(v => {
            const overdue     = v.dueDate && v.dueDate < today;
            const longRunning = (v.timeInCurrentStatusDays ?? 0) >= 5;
            return (
              <Table.Tr key={`${v.podId}-${v.key}`}>
                {/* Key — always visible, links to Jira */}
                <Table.Td>
                  <Anchor
                    href={jiraBaseUrl ? `${jiraBaseUrl}/browse/${v.key}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    size="xs"
                    fw={600}
                    c={AQUA}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {v.key}
                  </Anchor>
                </Table.Td>
                {/* Summary — always visible */}
                <Table.Td>
                  <Tooltip label={v.summary} disabled={v.summary.length < 60}>
                    <Text size="xs" truncate style={{ maxWidth: 260 }}>{v.summary}</Text>
                  </Tooltip>
                </Table.Td>
                {col('pod') && (
                  <Table.Td><Badge size="xs" variant="outline" color="gray">{v.podDisplayName}</Badge></Table.Td>
                )}
                {col('issueType') && (
                  <Table.Td><Text size="xs" c="dimmed">{v.issueType ?? '—'}</Text></Table.Td>
                )}
                {col('assignee') && (
                  <Table.Td>
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 120 }}>
                      {v.assigneeAvatarUrl ? (
                        <img
                          src={v.assigneeAvatarUrl}
                          alt={v.assignee ?? ''}
                          style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }}
                        />
                      ) : (
                        v.assignee && (
                          <Box style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--mantine-color-blue-2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700, color: 'var(--mantine-color-blue-7)',
                          }}>
                            {v.assignee.charAt(0).toUpperCase()}
                          </Box>
                        )
                      )}
                      <Text size="xs" c="dimmed">{v.assignee ?? '—'}</Text>
                    </Group>
                  </Table.Td>
                )}
                {col('status') && (
                  <Table.Td>
                    <Badge size="xs" variant="light"
                      color={v.statusCategory === 'done' ? 'green' : v.statusCategory === 'indeterminate' ? 'blue' : 'gray'}>
                      {v.statusName}
                    </Badge>
                  </Table.Td>
                )}
                {col('priority') && (
                  <Table.Td>
                    <Badge size="xs" variant="light"
                      color={{ Highest: 'red', High: 'orange', Medium: 'yellow', Low: 'blue', Lowest: 'gray' }[v.priorityName ?? ''] ?? 'gray'}>
                      {v.priorityName ?? '—'}
                    </Badge>
                  </Table.Td>
                )}
                {col('dueDate') && (
                  <Table.Td>
                    <Text size="xs" c={overdue ? UX_ERROR : 'dimmed'} fw={overdue ? 600 : 400}>
                      {v.dueDate ?? '—'}
                    </Text>
                  </Table.Td>
                )}
                {col('timeInStatus') && (
                  <Table.Td>
                    <Text size="xs" c={longRunning ? UX_WARNING : 'dimmed'} fw={longRunning ? 600 : 400}>
                      {v.timeInCurrentStatusDays ?? '—'}d
                    </Text>
                  </Table.Td>
                )}
                {col('epic') && (
                  <Table.Td>
                    <Text size="xs" c="dimmed" truncate style={{ maxWidth: 140 }}>{v.epicName ?? '—'}</Text>
                  </Table.Td>
                )}
                {col('storyPoints') && (
                  <Table.Td>
                    <Text size="xs" c="dimmed" ta="center">{v.storyPoints ?? '—'}</Text>
                  </Table.Td>
                )}
                {/* Violations — always visible */}
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    {v.hits.map(h => <Badge key={`${h.ruleId}:${h.checkId}`} size="xs" color={h.color} variant="light">{h.label}</Badge>)}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

// ── CheckRow — one editable check within a rule ───────────────────────────────

const CHECK_TYPE_LABELS: Record<RuleType, string> = {
  required:    'Required (not empty)',
  'not-overdue': 'Not Overdue (future date)',
  'min-value': 'Minimum Value',
  'one-of':    'Must be one of',
  threshold:   'Threshold (days)',
};

function CheckRow({
  check, fieldType, fieldId, statuses, isBuiltIn, readonly,
  onUpdate, onRemove,
}: {
  check: ViolationCheck;
  fieldType: FieldType | undefined;
  fieldId: string | undefined;
  statuses: string[];
  isBuiltIn: boolean;
  readonly: boolean;
  onUpdate: (patch: Partial<ViolationCheck>) => void;
  onRemove: () => void;
}) {
  const { data: fieldValues = [] } = useFieldValues(
    check.type === 'one-of' ? fieldId : undefined
  );

  return (
    <Box style={{ background: 'var(--mantine-color-default-border)', borderRadius: 6, padding: '1px' }}>
      <Box style={{ background: 'var(--mantine-color-body)', borderRadius: 5, padding: '8px 10px' }}>
        <Group gap="xs" align="flex-start" wrap="nowrap">
          {/* Check type — readonly for built-in (type is fixed), editable for custom */}
          {isBuiltIn ? (
            <Text size="xs" fw={500} style={{ minWidth: 190, paddingTop: 2 }}>
              {CHECK_TYPE_LABELS[check.type] ?? check.type}
            </Text>
          ) : (
            <Select
              size="xs"
              style={{ minWidth: 200 }}
              data={ruleTypeOptionsForField(fieldType ?? 'string')}
              value={check.type}
              disabled={readonly}
              onChange={val => onUpdate({ type: (val as RuleType) ?? 'required' })}
              comboboxProps={{ withinPortal: true, zIndex: 400 }}
            />
          )}

          {/* Remove check (custom rules only, not readonly) */}
          {!isBuiltIn && !readonly && (
            <ActionIcon size="sm" variant="subtle" color="red" mt={2} onClick={onRemove} title="Remove check">
              <IconTrash size={12} />
            </ActionIcon>
          )}
        </Group>

        {/* Status filter — pill toggles (avoids portal/close-on-click issues) */}
        <Box mt={6}>
          <Group gap={4} mb={4} justify="space-between">
            <Text size="xs" c="dimmed" fw={500}>Apply when status is:</Text>
            {check.statuses.length > 0 && !readonly && (
              <Text
                size="xs" c="red" style={{ cursor: 'pointer' }}
                onClick={() => onUpdate({ statuses: [] })}
              >
                Clear all
              </Text>
            )}
          </Group>
          <Group gap={4} wrap="wrap">
            {statuses.length === 0 && (
              <Text size="xs" c="dimmed" fs="italic">No statuses loaded yet</Text>
            )}
            {statuses.map(s => {
              const selected = check.statuses.includes(s);
              return (
                <Badge
                  key={s}
                  size="sm"
                  variant={selected ? 'filled' : 'outline'}
                  color={selected ? 'blue' : 'gray'}
                  style={{ cursor: readonly ? 'default' : 'pointer', userSelect: 'none' }}
                  onClick={() => {
                    if (readonly) return;
                    onUpdate({
                      statuses: selected
                        ? check.statuses.filter(x => x !== s)
                        : [...check.statuses, s],
                    });
                  }}
                >
                  {s}
                </Badge>
              );
            })}
          </Group>
          {check.statuses.length === 0 && (
            <Text size="xs" c="dimmed" fs="italic" mt={4}>No filter — fires for all statuses</Text>
          )}
        </Box>

        {/* Threshold (long-running or min-value) */}
        {(check.type === 'threshold' || check.type === 'min-value') && (
          <NumberInput
            label={check.type === 'threshold' ? 'Days threshold' : 'Minimum value'}
            size="xs" mt={6} min={0} style={{ maxWidth: 140 }}
            value={check.threshold ?? (check.type === 'threshold' ? 5 : 1)}
            disabled={readonly}
            onChange={val => onUpdate({ threshold: typeof val === 'number' ? val : undefined })}
          />
        )}

        {/* Allowed values (one-of) */}
        {check.type === 'one-of' && (
          <MultiSelect
            label="Allowed values"
            placeholder={fieldValues.length ? 'Pick allowed values…' : 'No values synced yet'}
            size="xs" mt={6}
            data={fieldValues}
            value={check.allowedValues ?? []}
            disabled={readonly}
            onChange={val => onUpdate({ allowedValues: val })}
            searchable clearable
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
        )}
      </Box>
    </Box>
  );
}

// ── Rule row ──────────────────────────────────────────────────────────────────

function RuleRow({
  rule, active, isOverridden, readonlyControls, statuses,
  onToggle, onUpdate, onRemove,
}: {
  rule: ViolationRule;
  active: boolean;
  isOverridden: boolean;
  readonlyControls: boolean;
  statuses: string[];
  onToggle: () => void;
  onUpdate: (patch: Partial<ViolationRule>) => void;
  onRemove?: () => void;
}) {
  function updateCheck(checkId: string, patch: Partial<ViolationCheck>) {
    onUpdate({
      checks: rule.checks.map(c => c.id === checkId ? { ...c, ...patch } : c),
    });
  }

  function removeCheck(checkId: string) {
    onUpdate({ checks: rule.checks.filter(c => c.id !== checkId) });
  }

  function addCheck() {
    const opts = ruleTypeOptionsForField((rule.fieldType ?? 'string') as FieldType);
    onUpdate({
      checks: [...rule.checks, { id: newCheckId(), type: opts[0].value, statuses: [] }],
    });
  }

  return (
    <Paper withBorder p="sm" radius="md"
      style={{ borderColor: active ? 'var(--mantine-color-blue-3)' : undefined, opacity: active ? 1 : 0.55 }}>
      {/* Rule header */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconPointFilled size={8} color={active ? '#40c057' : '#aaa'} style={{ flexShrink: 0 }} />
          <Text size="sm" fw={600} truncate>{rule.fieldName ?? rule.label}</Text>
          {rule.fieldId && rule.fieldName === rule.fieldId && (
            <Badge size="xs" variant="outline" color="gray">{rule.fieldId}</Badge>
          )}
          {isOverridden && <Badge size="xs" color="violet" variant="light">overridden</Badge>}
        </Group>
        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Switch size="sm" checked={active} onChange={onToggle} />
          {onRemove && !readonlyControls && (
            <ActionIcon size="sm" variant="subtle" color="red" onClick={onRemove} title="Remove rule">
              <IconTrash size={12} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Checks section */}
      {readonlyControls ? (
        // Per-type view: show compact check summary (read-only)
        <Stack gap={4} mt={8}>
          {rule.checks.map(check => (
            <Group key={check.id} gap={6} wrap="wrap">
              <Badge size="xs" variant="light" color="blue">{CHECK_TYPE_LABELS[check.type] ?? check.type}</Badge>
              {check.statuses.length > 0
                ? check.statuses.map(s => <Badge key={s} size="xs" variant="outline" color="gray">{s}</Badge>)
                : <Badge size="xs" variant="outline" color="gray">all statuses</Badge>
              }
              {(check.type === 'threshold' || check.type === 'min-value') && check.threshold != null && (
                <Badge size="xs" variant="outline" color="teal">≥ {check.threshold}</Badge>
              )}
              {check.type === 'one-of' && (check.allowedValues?.length ?? 0) > 0 && (
                <Badge size="xs" variant="outline" color="teal">{check.allowedValues!.length} allowed values</Badge>
              )}
            </Group>
          ))}
        </Stack>
      ) : (
        // All-types view: full check editor
        <Stack gap={6} mt={10}>
          <Group justify="space-between" align="center">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              Checks
            </Text>
            {!rule.builtIn && (
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={10} />} onClick={addCheck}>
                Add Check
              </Button>
            )}
          </Group>
          {rule.checks.map(check => (
            <CheckRow
              key={check.id}
              check={check}
              fieldType={rule.fieldType as FieldType | undefined}
              fieldId={rule.fieldId}
              statuses={statuses}
              isBuiltIn={rule.builtIn}
              readonly={readonlyControls}
              onUpdate={patch => updateCheck(check.id, patch)}
              onRemove={() => removeCheck(check.id)}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

// ── Config modal ──────────────────────────────────────────────────────────────

const ALL_TYPES_KEY = '__all__';

function RulesConfigModal({ opened, onClose, rules, onChange, onSave, saving, statuses }: {
  opened: boolean; onClose: () => void;
  rules: ViolationRule[]; onChange: (r: ViolationRule[]) => void;
  onSave: () => void; saving: boolean;
  /** Distinct issue statuses derived from currently-loaded sprint issues */
  statuses: string[];
}) {
  const { data: availableFields = [], isLoading: fieldsLoading } = useAvailableViolationFields();
  const { data: issueTypes = [],      isLoading: typesLoading }  = useAvailableIssueTypes();
  const { mutate: syncNames, isPending: syncing, data: syncResult } = useSyncFieldNames();

  const [selectedType, setSelectedType] = useState<string>(ALL_TYPES_KEY);
  const [newFieldId,   setNewFieldId]   = useState<string | null>(null);

  function toggleRule(ruleId: string, current: boolean) {
    onChange(rules.map(r => {
      if (r.id !== ruleId) return r;
      if (selectedType === ALL_TYPES_KEY) return { ...r, enabled: !current };
      const overrides = { ...(r.typeEnabled ?? {}) };
      if (!current) {
        overrides[selectedType] = true;
      } else {
        if (r.enabled) overrides[selectedType] = false;
        else delete overrides[selectedType];
      }
      return { ...r, typeEnabled: overrides };
    }));
  }

  function updateRule(ruleId: string, patch: Partial<ViolationRule>) {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...patch } : r));
  }

  function addCustomField() {
    if (!newFieldId) return;
    const af = availableFields.find(f => f.fieldId === newFieldId);
    if (!af || rules.some(r => r.fieldId === af.fieldId)) return;
    onChange([...rules, {
      id:        `custom:${af.fieldId}`,
      label:     af.fieldName,
      enabled:   true,
      builtIn:   false,
      fieldId:   af.fieldId,
      fieldName: af.fieldName,
      fieldType: af.fieldType,
      checks:    defaultChecksForField(af.fieldType),
      typeEnabled: {},
    }]);
    setNewFieldId(null);
  }

  const navTypes      = [ALL_TYPES_KEY, ...issueTypes];
  const builtInRules  = rules.filter(r => r.builtIn);
  const customRules   = rules.filter(r => !r.builtIn);
  const unusedFields  = availableFields.filter(af => !rules.some(r => r.fieldId === af.fieldId));
  const typeForClassify  = selectedType === ALL_TYPES_KEY ? null : selectedType;
  const readonlyControls = selectedType !== ALL_TYPES_KEY;

  const activeCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of navTypes) {
      counts[t] = rules.filter(r => isRuleActiveForType(r, t === ALL_TYPES_KEY ? null : t)).length;
    }
    return counts;
  }, [rules, navTypes]);

  return (
    <Modal opened={opened} onClose={onClose} size="90%"
      title={
        <Group gap={8}>
          <IconSettings size={16} />
          <Text fw={600} size="sm">Configure Violation Rules</Text>
          <Text size="xs" c="dimmed">· Rules apply per issue type · Checks apply per status</Text>
        </Group>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Group align="stretch" gap={0} style={{ height: '72vh', overflow: 'hidden' }}>

        {/* ── Left nav ──────────────────────────────────────────────────────── */}
        <Box style={{ width: 220, borderRight: `1px solid ${BORDER_DEFAULT}`, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Box p="xs" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}`, flexShrink: 0 }}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>Issue Types</Text>
          </Box>

          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={2} p="xs">
              {typesLoading && <Loader size="xs" mx="auto" mt="sm" />}
              {navTypes.map(t => {
                const label    = t === ALL_TYPES_KEY ? 'All Types (default)' : t;
                const count    = activeCountByType[t] ?? 0;
                const isActive = selectedType === t;
                return (
                  <UnstyledButton key={t} onClick={() => setSelectedType(t)}
                    style={{
                      padding: '7px 10px', borderRadius: 6, display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : 'transparent',
                    }}>
                    <Text size="sm" fw={isActive ? 600 : 400} c={isActive ? 'blue' : undefined} truncate>{label}</Text>
                    <Badge size="xs" variant={isActive ? 'filled' : 'light'} color={isActive ? 'blue' : 'gray'}>{count}</Badge>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea>

          {/* ── Add field rule panel — pinned at bottom ──────────────────── */}
          <Box style={{ borderTop: `1px solid ${BORDER_DEFAULT}`, flexShrink: 0, maxHeight: 240, overflowY: 'auto' }} p="xs">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.06em' }}>Add Field Rule</Text>

            <Button size="xs" variant="light" color="blue" fullWidth mb={6}
              leftSection={<IconRefresh size={12} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />}
              onClick={() => syncNames()} loading={syncing}>
              Sync Field Names
            </Button>
            {syncResult && (
              <Text size="xs" c={syncResult.status === 'ok' ? 'teal' : 'red'} mb={6} style={{ lineHeight: 1.3 }}>
                {syncResult.message}
              </Text>
            )}

            {fieldsLoading && <Loader size="xs" />}
            {!fieldsLoading && unusedFields.length === 0 && customRules.length > 0 && (
              <Text size="xs" c="dimmed">All available fields added.</Text>
            )}
            {!fieldsLoading && unusedFields.length > 0 && (
              <Stack gap={6}>
                <Select
                  placeholder="Pick a field…"
                  size="xs"
                  data={unusedFields.map(f => ({
                    value: f.fieldId,
                    label: f.fieldName !== f.fieldId ? f.fieldName : f.fieldId,
                    description: f.fieldType,
                  }))}
                  value={newFieldId}
                  onChange={setNewFieldId}
                  searchable clearable
                  comboboxProps={{ withinPortal: true, zIndex: 400 }}
                  renderOption={({ option }) => (
                    <Stack gap={0}>
                      <Text size="xs" fw={500}>{option.label}</Text>
                      <Text size="xs" c="dimmed">{(option as any).description}</Text>
                    </Stack>
                  )}
                />
                <Button size="xs" variant="filled" color="blue"
                  leftSection={<IconPlus size={12} />}
                  onClick={addCustomField} disabled={!newFieldId} fullWidth>
                  Add Rule
                </Button>
              </Stack>
            )}
          </Box>
        </Box>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <Box style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
          <ScrollArea h="100%">
            <Box p="lg">
              <Box mb="md">
                <Text fw={600} size="sm" c={DEEP_BLUE}>
                  {selectedType === ALL_TYPES_KEY ? 'Default Rules (All Issue Types)' : `Rules for: ${selectedType}`}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {selectedType === ALL_TYPES_KEY
                    ? 'Configure check types, status filters, and thresholds here. These are the global defaults.'
                    : `Toggle rules on/off for ${selectedType}. Check details are set globally in "All Types".`}
                </Text>
              </Box>

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: '0.05em' }}>Built-in Rules</Text>
              <Stack gap="xs" mb="lg">
                {builtInRules.map(rule => (
                  <RuleRow key={rule.id} rule={rule}
                    active={isRuleActiveForType(rule, typeForClassify)}
                    isOverridden={selectedType !== ALL_TYPES_KEY && !!rule.typeEnabled && selectedType in rule.typeEnabled}
                    readonlyControls={readonlyControls}
                    statuses={statuses}
                    onToggle={() => toggleRule(rule.id, isRuleActiveForType(rule, typeForClassify))}
                    onUpdate={patch => updateRule(rule.id, patch)}
                  />
                ))}
              </Stack>

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: '0.05em' }}>Custom Field Rules</Text>
              {customRules.length === 0
                ? <Text size="xs" c="dimmed">No custom field rules yet. Add one from the left panel.</Text>
                : (
                  <Stack gap="xs">
                    {customRules.map(rule => (
                      <RuleRow key={rule.id} rule={rule}
                        active={isRuleActiveForType(rule, typeForClassify)}
                        isOverridden={selectedType !== ALL_TYPES_KEY && !!rule.typeEnabled && selectedType in rule.typeEnabled}
                        readonlyControls={readonlyControls}
                        statuses={statuses}
                        onToggle={() => toggleRule(rule.id, isRuleActiveForType(rule, typeForClassify))}
                        onUpdate={patch => updateRule(rule.id, patch)}
                        onRemove={() => onChange(rules.filter(r => r.id !== rule.id))}
                      />
                    ))}
                  </Stack>
                )}
            </Box>
          </ScrollArea>
        </Box>
      </Group>

      <Box p="md" style={{ borderTop: `1px solid ${BORDER_DEFAULT}` }}>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} loading={saving} leftSection={<IconCircleCheck size={14} />} color="blue">Save Rules</Button>
        </Group>
      </Box>
    </Modal>
  );
}

// ── KPI icon helpers ──────────────────────────────────────────────────────────

function kpiIcon(ruleId: string) {
  switch (ruleId) {
    case 'missing-date':    return <IconCalendarOff size={16} />;
    case 'no-version':      return <IconVersions size={16} />;
    case 'overdue':         return <IconAlertTriangle size={16} />;
    case 'long-running':    return <IconClock size={16} />;
    case 'no-story-points': return <IconFlag size={16} />;
    default:                return <IconPointFilled size={16} />;
  }
}
function kpiColor(ruleId: string) {
  if (ruleId === 'overdue')      return 'red';
  if (ruleId === 'missing-date') return 'orange';
  if (ruleId === 'long-running') return 'yellow';
  return 'blue';
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function SprintViolationsTab() {
  const { issues, isLoading, isError }                = useAllActiveSprintIssues();
  const { data: pods = [] }                           = usePodList();
  const { data: sprintNames = [] }                    = useSprintNames();
  const { data: rules = [], isLoading: rulesLoading } = useViolationRules();
  const { mutate: saveRules, isPending: saving }      = useSaveViolationRules();
  const { data: jiraStatus }                          = useJiraStatus();
  const jiraBaseUrl                                   = jiraStatus?.baseUrl ?? '';

  const [filterRuleId, setFilterRuleId] = useState<string>('all');
  const [search,       setSearch]       = useState('');
  const [configOpen,   setConfigOpen]   = useState(false);
  const [draftRules,   setDraftRules]   = useState<ViolationRule[]>([]);
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [visibleCols,  setVisibleCols]  = useState<Set<string>>(new Set(DEFAULT_COL_IDS));

  // Default selected sprints = all active sprint names (once sprint data loads)
  const activeSprints = useMemo(
    () => sprintNames.filter(s => s.state === 'active').map(s => s.name),
    [sprintNames]
  );
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  // Sync default once active sprints are known
  const [sprintsDefaulted, setSprintsDefaulted] = useState(false);
  React.useEffect(() => {
    if (!sprintsDefaulted && activeSprints.length > 0) {
      setSelectedSprints(activeSprints);
      setSprintsDefaulted(true);
    }
  }, [activeSprints, sprintsDefaulted]);

  // Derive distinct statuses from the already-loaded issues
  const availableStatuses = useMemo(() =>
    [...new Set(issues.map(i => i.statusName).filter((s): s is string => !!s))].sort(),
    [issues]
  );


  const isDefaultSprints = useMemo(
    () => activeSprints.length > 0 &&
          selectedSprints.length === activeSprints.length &&
          selectedSprints.every(s => activeSprints.includes(s)),
    [selectedSprints, activeSprints]
  );

  function openConfig() { setDraftRules(rules); setConfigOpen(true); }
  function handleSave()  { saveRules(draftRules, { onSuccess: () => setConfigOpen(false) }); }

  // Apply POD + Sprint filters before violation detection
  const filteredIssues = useMemo(() => {
    let result = issues;
    if (selectedPods.length > 0)
      result = result.filter(i => selectedPods.includes(String(i.podId)));
    if (selectedSprints.length > 0)
      result = result.filter(i => i.sprintName != null && selectedSprints.includes(i.sprintName));
    return result;
  }, [issues, selectedPods, selectedSprints]);

  const violations = useMemo(() =>
    filteredIssues.map(i => ({ ...i, hits: classifyIssue(i, rules) })).filter(i => i.hits.length > 0),
    [filteredIssues, rules]
  );

  // Count distinct issues per rule (not per check — avoids double-counting
  // when multiple checks on the same rule fail for the same issue).
  const counts = useMemo(() => {
    const perRule: Record<string, Set<string>> = {};
    for (const v of violations) {
      for (const h of v.hits) {
        if (!perRule[h.ruleId]) perRule[h.ruleId] = new Set();
        perRule[h.ruleId].add(v.key);
      }
    }
    const result: Record<string, number> = { all: violations.length };
    for (const [ruleId, keys] of Object.entries(perRule)) {
      result[ruleId] = keys.size;
    }
    return result;
  }, [violations]);

  const displayed = useMemo(() =>
    filterRuleId === 'all' ? violations : violations.filter(v => v.hits.some(h => h.ruleId === filterRuleId)),
    [violations, filterRuleId]
  );

  const enabledRules = useMemo(() => rules.filter(r => r.enabled), [rules]);
  const filterLabel  = filterRuleId === 'all' ? 'All Violations'
    : (rules.find(r => r.id === filterRuleId)?.fieldName ?? rules.find(r => r.id === filterRuleId)?.label ?? filterRuleId);

  if (isError)
    return <Alert icon={<IconAlertTriangle size={14} />} color="red" mt="md">Failed to load sprint issue data. Check your Jira sync status.</Alert>;

  return (
    <Stack gap="lg" pb="xl">
      <SimpleGrid cols={{ base: 2, sm: 3, md: Math.min(enabledRules.length + 1, 6) }} spacing="sm">
        <ViolationKpi label="Total Violations" count={counts.all ?? 0} icon={<IconFlag size={16} />}
          color="red" active={filterRuleId === 'all'} onClick={() => setFilterRuleId('all')} />
        {enabledRules.map(rule => (
          <ViolationKpi key={rule.id}
            label={rule.fieldName ?? rule.label}
            count={counts[rule.id] ?? 0}
            icon={kpiIcon(rule.id)} color={kpiColor(rule.id)}
            active={filterRuleId === rule.id} onClick={() => setFilterRuleId(rule.id)} />
        ))}
      </SimpleGrid>

      {/* ── POD + Sprint filter chips ───────────────────────────────────── */}
      <Paper withBorder radius="md" p="sm">
        <Stack gap={8}>
          {/* POD chips */}
          <Group gap={6} align="center" wrap="wrap">
            <Text size="xs" fw={600} c="dimmed" style={{ minWidth: 46 }}>PODs</Text>
            {selectedPods.length === 0 ? (
              <Badge size="sm" variant="outline" color="gray">All PODs</Badge>
            ) : (
              selectedPods.map(podId => {
                const pod = pods.find(p => String(p.id) === podId);
                return (
                  <Badge key={podId} size="sm" variant="filled" color="blue"
                    rightSection={
                      <IconX size={9} style={{ cursor: 'pointer', marginLeft: 2 }}
                        onClick={() => setSelectedPods(selectedPods.filter(id => id !== podId))} />
                    }>
                    {pod?.displayName ?? podId}
                  </Badge>
                );
              })
            )}
            {/* Add POD dropdown */}
            {pods.filter(p => !selectedPods.includes(String(p.id))).length > 0 && (
              <Select
                size="xs" placeholder="+ POD"
                data={pods.filter(p => !selectedPods.includes(String(p.id))).map(p => ({ value: String(p.id), label: p.displayName }))}
                value={null}
                onChange={v => v && setSelectedPods([...selectedPods, v])}
                style={{ width: 120 }}
                styles={{ input: { height: 22, minHeight: 22, fontSize: 11 } }}
                comboboxProps={{ withinPortal: true, zIndex: 200 }}
                searchable
              />
            )}
          </Group>

          {/* Sprint chips */}
          <Group gap={6} align="center" wrap="wrap">
            <Text size="xs" fw={600} c="dimmed" style={{ minWidth: 46 }}>Sprints</Text>
            {selectedSprints.length === 0 ? (
              <Badge size="sm" variant="outline" color="gray">No sprints selected</Badge>
            ) : (
              selectedSprints.map(name => {
                const isActive = activeSprints.includes(name);
                return (
                  <Badge key={name} size="sm" variant="filled" color={isActive ? 'green' : 'gray'}
                    rightSection={
                      <IconX size={9} style={{ cursor: 'pointer', marginLeft: 2 }}
                        onClick={() => setSelectedSprints(selectedSprints.filter(s => s !== name))} />
                    }>
                    {name}
                  </Badge>
                );
              })
            )}
            {/* Add sprint dropdown — proper Mantine v7 nested grouped format */}
            {sprintNames.filter(s => !selectedSprints.includes(s.name)).length > 0 && (
              <Select
                size="xs" placeholder="+ Sprint"
                data={(() => {
                  const activeItems = activeSprints
                    .filter(n => !selectedSprints.includes(n))
                    .map(n => ({ value: n, label: n }));
                  const closedItems = sprintNames
                    .filter(s => s.state === 'closed' && !selectedSprints.includes(s.name))
                    .map(s => ({ value: s.name, label: s.name }));
                  const groups: { group: string; items: { value: string; label: string }[] }[] = [];
                  if (activeItems.length > 0) groups.push({ group: '🟢 Active', items: activeItems });
                  if (closedItems.length > 0) groups.push({ group: '📁 Closed (last 90 days)', items: closedItems });
                  return groups;
                })()}
                value={null}
                onChange={v => v && setSelectedSprints([...selectedSprints, v])}
                style={{ width: 180 }}
                styles={{ input: { height: 22, minHeight: 22, fontSize: 11 } }}
                comboboxProps={{ withinPortal: true, zIndex: 200 }}
                searchable
              />
            )}
            {!isDefaultSprints && activeSprints.length > 0 && (
              <Text size="xs" c="blue" style={{ cursor: 'pointer' }}
                onClick={() => setSelectedSprints(activeSprints)}>
                Reset to active
              </Text>
            )}
          </Group>
        </Stack>
        {(selectedPods.length > 0 || !isDefaultSprints) && (
          <Text size="xs" c="dimmed" style={{ cursor: 'pointer', marginTop: 6 }}
            onClick={() => { setSelectedPods([]); setSelectedSprints(activeSprints); }}>
            Clear all filters
          </Text>
        )}
      </Paper>

      {/* ── Search + controls bar ──────────────────────────────────────── */}
      <Group>
        <TextInput placeholder="Search by key, summary, assignee, or POD…"
          leftSection={<IconSearch size={14} />} value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 440 }} size="sm" />
        {(isLoading || rulesLoading) && <Loader size="xs" />}
        {!isLoading && !rulesLoading && (
          <Text size="xs" c="dimmed">
            {displayed.length} issue{displayed.length !== 1 ? 's' : ''}
            {filterRuleId !== 'all' ? ` · "${filterLabel}"` : ' with violations'}
            {(selectedPods.length > 0 || !isDefaultSprints) ? ' · filtered' : ''}
          </Text>
        )}
        {/* Column visibility toggle */}
        <Popover width={200} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <Button variant="light" size="xs" leftSection={<IconColumns size={14} />}>
              Columns
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap={8}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                Visible Columns
              </Text>
              {CONFIGURABLE_COLS.map(c => (
                <Checkbox
                  key={c.id}
                  size="xs"
                  label={c.label}
                  checked={visibleCols.has(c.id)}
                  onChange={e => {
                    const next = new Set(visibleCols);
                    if (e.currentTarget.checked) next.add(c.id); else next.delete(c.id);
                    setVisibleCols(next);
                  }}
                />
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Button variant="light" size="xs" leftSection={<IconSettings size={14} />} onClick={openConfig}>
          Configure Rules
        </Button>
      </Group>

      {isLoading ? (
        <Stack align="center" justify="center" h={200} gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading sprint issues across all PODs…</Text>
        </Stack>
      ) : (
        <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
          <Box p="sm" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}` }}>
            <Group justify="space-between">
              <Box>
                <Text size="sm" fw={600} c={DEEP_BLUE}>{filterLabel}</Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {selectedPods.length > 0 ? `${selectedPods.length} POD${selectedPods.length > 1 ? 's' : ''}` : 'All PODs'}
                  {' · '}
                  {isDefaultSprints ? 'Active sprints' : `${selectedSprints.length} sprint${selectedSprints.length !== 1 ? 's' : ''} selected`}
                  {` · Non-done only · ${enabledRules.length} rule${enabledRules.length !== 1 ? 's' : ''} active`}
                </Text>
              </Box>
              {(counts.all ?? 0) === 0 && (
                <Badge color="green" variant="light" leftSection={<IconCircleCheck size={11} />}>All clear</Badge>
              )}
            </Group>
          </Box>
          <Box p="sm"><IssueTable violations={displayed} search={search} jiraBaseUrl={jiraBaseUrl} visibleCols={visibleCols} /></Box>
        </Paper>
      )}

      <RulesConfigModal opened={configOpen} onClose={() => setConfigOpen(false)}
        rules={draftRules} onChange={setDraftRules} onSave={handleSave} saving={saving}
        statuses={availableStatuses} />
    </Stack>
  );
}
