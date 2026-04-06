import { useState, useCallback } from 'react';
import {
  Popover, Button, Stack, Group, Select, TextInput, MultiSelect, ActionIcon,
  Text, SegmentedControl, Divider, Tooltip, Badge,
} from '@mantine/core';
import { IconFilter, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

/* ── Types ─────────────────────────────────────────────────────────────── */
export type FieldType = 'text' | 'select' | 'multiselect' | 'boolean';
export type FilterOperator =
  | 'contains' | 'not_contains'
  | 'is' | 'is_not'
  | 'in' | 'not_in';

export interface FilterField {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

export interface FilterCondition {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  /** Single string for text/select/boolean, array for multiselect */
  value: string | string[];
}

export type FilterLogic = 'AND' | 'OR';

export interface AdvancedFilters {
  logic: FilterLogic;
  conditions: FilterCondition[];
}

interface AdvancedFilterPanelProps {
  fields: FilterField[];
  value: AdvancedFilters;
  onChange: (v: AdvancedFilters) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
const OPERATORS_FOR_TYPE: Record<FieldType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'is', label: 'is exactly' },
    { value: 'is_not', label: 'is not' },
  ],
  select: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  multiselect: [
    { value: 'in', label: 'is any of' },
    { value: 'not_in', label: 'is none of' },
  ],
  boolean: [
    { value: 'is', label: 'is' },
  ],
};

function newCondition(fieldKey: string, type: FieldType): FilterCondition {
  const op = OPERATORS_FOR_TYPE[type][0].value;
  return {
    id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fieldKey,
    operator: op,
    value: type === 'multiselect' ? [] : '',
  };
}

function activeCount(filters: AdvancedFilters): number {
  return filters.conditions.filter(c => {
    if (Array.isArray(c.value)) return c.value.length > 0;
    return c.value !== '' && c.value !== null;
  }).length;
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function AdvancedFilterPanel({ fields, value, onChange }: AdvancedFilterPanelProps) {
  const [open, setOpen] = useState(false);
  // Local draft — applied only when "Apply" is clicked
  const [draft, setDraft] = useState<AdvancedFilters>(value);

  const openPanel = () => {
    setDraft({ ...value, conditions: value.conditions.map(c => ({ ...c })) });
    setOpen(true);
  };

  const addCondition = () => {
    const firstField = fields[0];
    if (!firstField) return;
    setDraft(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition(firstField.key, firstField.type)],
    }));
  };

  const removeCondition = (id: string) => {
    setDraft(prev => ({ ...prev, conditions: prev.conditions.filter(c => c.id !== id) }));
  };

  const updateCondition = useCallback((id: string, patch: Partial<FilterCondition>) => {
    setDraft(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => {
        if (c.id !== id) return c;
        // If field changed, reset operator and value
        if (patch.fieldKey && patch.fieldKey !== c.fieldKey) {
          const newField = fields.find(f => f.key === patch.fieldKey);
          const newType = newField?.type ?? 'text';
          return newCondition(patch.fieldKey, newType);
        }
        return { ...c, ...patch };
      }),
    }));
  }, [fields]);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const reset = () => {
    const cleared: AdvancedFilters = { logic: 'AND', conditions: [] };
    setDraft(cleared);
    onChange(cleared);
    setOpen(false);
  };

  const count = activeCount(value);

  return (
    <Popover
      opened={open}
      onClose={() => setOpen(false)}
      position="bottom-start"
      withArrow
      shadow="lg"
      width={520}
      trapFocus
    >
      <Popover.Target>
        <Tooltip label="Advanced filters">
          <Button
            variant={count > 0 ? 'light' : 'subtle'}
            color={count > 0 ? 'violet' : 'gray'}
            size="sm"
            leftSection={<IconFilter size={14} />}
            rightSection={count > 0 ? <Badge size="xs" color="violet" circle>{count}</Badge> : undefined}
            onClick={openPanel}
          >
            Filters
          </Button>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap={10}>
          {/* Header */}
          <Group justify="space-between">
            <Text size="sm" fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              Advanced Filters
            </Text>
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setOpen(false)}>
              <IconX size={14} />
            </ActionIcon>
          </Group>

          {/* AND / OR logic toggle */}
          {draft.conditions.length > 1 && (
            <Group gap={8} align="center">
              <Text size="xs" c="dimmed">Match</Text>
              <SegmentedControl
                size="xs"
                value={draft.logic}
                onChange={v => setDraft(prev => ({ ...prev, logic: v as FilterLogic }))}
                data={[
                  { label: 'ALL conditions (AND)', value: 'AND' },
                  { label: 'ANY condition (OR)', value: 'OR' },
                ]}
                styles={{ label: { fontSize: 11 } }}
              />
            </Group>
          )}

          {/* Conditions list */}
          {draft.conditions.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="xs">
              No filters yet. Click "Add condition" to start.
            </Text>
          )}

          {draft.conditions.map((cond, idx) => {
            const field = fields.find(f => f.key === cond.fieldKey) ?? fields[0];
            const opOptions = field ? OPERATORS_FOR_TYPE[field.type] : OPERATORS_FOR_TYPE.text;
            return (
              <Group key={cond.id} gap={6} align="flex-end" wrap="nowrap">
                {/* Logic label (AND/OR) for rows after the first */}
                {idx > 0 && (
                  <Text
                    size="xs"
                    fw={600}
                    c="violet"
                    style={{ width: 28, textAlign: 'center', flexShrink: 0, paddingBottom: 6 }}
                  >
                    {draft.logic}
                  </Text>
                )}
                {idx === 0 && <div style={{ width: 28, flexShrink: 0 }} />}

                {/* Field selector */}
                <Select
                  size="xs"
                  style={{ flex: '0 0 140px' }}
                  data={fields.map(f => ({ value: f.key, label: f.label }))}
                  value={cond.fieldKey}
                  onChange={v => v && updateCondition(cond.id, { fieldKey: v })}
                />

                {/* Operator selector */}
                <Select
                  size="xs"
                  style={{ flex: '0 0 140px' }}
                  data={opOptions}
                  value={cond.operator}
                  onChange={v => v && updateCondition(cond.id, { operator: v as FilterOperator })}
                />

                {/* Value input — varies by field type */}
                {field?.type === 'multiselect' ? (
                  <MultiSelect
                    size="xs"
                    style={{ flex: 1, minWidth: 100 }}
                    data={field.options ?? []}
                    value={Array.isArray(cond.value) ? cond.value : []}
                    onChange={v => updateCondition(cond.id, { value: v })}
                    placeholder="Pick values…"
                    searchable
                    clearable
                  />
                ) : field?.type === 'boolean' ? (
                  <Select
                    size="xs"
                    style={{ flex: 1 }}
                    data={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                    value={String(cond.value)}
                    onChange={v => v && updateCondition(cond.id, { value: v })}
                  />
                ) : field?.type === 'select' ? (
                  <Select
                    size="xs"
                    style={{ flex: 1 }}
                    data={field.options ?? []}
                    value={Array.isArray(cond.value) ? cond.value[0] ?? null : cond.value || null}
                    onChange={v => updateCondition(cond.id, { value: v ?? '' })}
                    placeholder="Pick a value…"
                    searchable
                    clearable
                  />
                ) : (
                  <TextInput
                    size="xs"
                    style={{ flex: 1 }}
                    value={Array.isArray(cond.value) ? '' : cond.value}
                    onChange={e => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="Value…"
                  />
                )}

                {/* Remove condition */}
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  onClick={() => removeCondition(cond.id)}
                  style={{ flexShrink: 0, marginBottom: 2 }}
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </Group>
            );
          })}

          {/* Add condition */}
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<IconPlus size={13} />}
            onClick={addCondition}
            justify="flex-start"
            disabled={fields.length === 0}
          >
            Add condition
          </Button>

          <Divider />

          {/* Footer actions */}
          <Group justify="flex-end" gap={8}>
            <Button variant="subtle" color="gray" size="xs" onClick={reset}>
              Reset
            </Button>
            <Button
              size="xs"
              color="violet"
              style={{ background: AQUA }}
              onClick={apply}
            >
              Apply filters
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/* ── Utility: apply AdvancedFilters to any array of objects ──────────── */
export function applyAdvancedFilters<T extends Record<string, unknown>>(
  items: T[],
  filters: AdvancedFilters,
): T[] {
  const { logic, conditions } = filters;
  const active = conditions.filter(c => {
    if (Array.isArray(c.value)) return c.value.length > 0;
    return c.value !== '' && c.value !== null && c.value !== undefined;
  });
  if (active.length === 0) return items;

  return items.filter(item => {
    const results = active.map(cond => {
      const raw = item[cond.fieldKey];
      const itemVal = raw == null ? '' : String(raw).toLowerCase();
      const condVal = Array.isArray(cond.value) ? cond.value : [String(cond.value).toLowerCase()];

      switch (cond.operator) {
        case 'contains':
          return itemVal.includes(condVal[0]);
        case 'not_contains':
          return !itemVal.includes(condVal[0]);
        case 'is':
          return itemVal === condVal[0];
        case 'is_not':
          return itemVal !== condVal[0];
        case 'in':
          return condVal.map(v => v.toLowerCase()).some(v => itemVal === v);
        case 'not_in':
          return !condVal.map(v => v.toLowerCase()).some(v => itemVal === v);
        default:
          return true;
      }
    });
    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  });
}
