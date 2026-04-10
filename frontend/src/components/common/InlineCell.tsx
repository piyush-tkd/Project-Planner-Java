/**
 * InlineCell — Suite of click-to-edit table cell components
 *
 * Provides specialized components for different data types:
 * - InlineTextCell: Text input editing
 * - InlineNumberCell: Number input with min/max/prefix/suffix
 * - InlineSelectCell: Dropdown selection
 * - InlineDateCell: Date picker
 * - InlineSwitchCell: Toggle switch (no click-to-edit, immediate save)
 * - InlineBadgeSelectCell: Colored badge that opens select dropdown
 *
 * All cells support:
 * - Normal state: clickable display value with hover indicator
 * - Editing state: focused input with auto-select
 * - Saving state: spinner overlay
 * - Error state: red border + tooltip
 * - Empty state: "—" placeholder with dashed underline
 *
 * Usage:
 *   <InlineTextCell
 *     value={item.name}
 *     onSave={async (v) => { await updateAPI(v); }}
 *     placeholder="Enter name…"
 *   />
 *
 *   <InlineNumberCell
 *     value={item.capacity}
 *     onSave={async (v) => { await updateAPI(v); }}
 *     min={0}
 *     max={100}
 *     suffix="%"
 *   />
 */
import { useState, useRef, useEffect } from 'react';
import {
  Box, Text, TextInput, Select, NumberInput, Switch, Badge, Tooltip, Group,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';

// Inject spinner keyframes once
function ensureSpinnerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('inline-spinner-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'inline-spinner-keyframes';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
ensureSpinnerKeyframes();

// Simple spinner component
function MiniSpinner() {
  return (
    <div style={{
      width: 14,
      height: 14,
      border: '2px solid rgba(99,102,241,0.2)',
      borderTop: '2px solid rgba(99,102,241,1)',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE TEXT CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineTextCellProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
  maxWidth?: number;
}

export function InlineTextCell({
  value,
  onSave,
  placeholder = '—',
  disabled = false,
  isEditing: externalEditing,
  onStartEdit,
  onCancel,
  maxWidth = 240,
}: InlineTextCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = externalEditing ?? internalEditing;

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isEditing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value);
    setError(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const commit = async () => {
    if (draft === value) {
      setInternalEditing(false);
      if (onCancel) onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setInternalEditing(false);
      if (onCancel) onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setInternalEditing(false);
    if (onCancel) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (isEditing) {
    return (
      <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
        <Box style={{ position: 'relative', minWidth: 80, maxWidth }} onClick={e => e.stopPropagation()}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={saving}
            size="xs"
            style={{ minHeight: 28 }}
            styles={{
              input: {
                padding: '4px 8px',
                height: 28,
                fontSize: 12,
                minHeight: 'unset',
                borderColor: error ? '#fa5252' : undefined,
              },
            }}
          />
          {saving && (
            <Box style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
              <MiniSpinner />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={disabled ? value : 'Click to edit'}
      withArrow
      position="top"
      openDelay={600}
    >
      <Box
        onClick={startEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: disabled ? 'default' : 'pointer',
          borderRadius: 4,
          padding: '2px 4px',
          margin: '-2px -4px',
          transition: 'background 0.12s',
          background: !disabled && hovered ? 'rgba(99,102,241,0.08)' : 'transparent',
          maxWidth: maxWidth,
        }}
      >
        <Text size="sm" style={{ lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || <Text span c="dimmed">{placeholder}</Text>}
        </Text>
      </Box>
    </Tooltip>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE NUMBER CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineNumberCellProps {
  value: number | null;
  onSave: (value: number) => Promise<void>;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
}

export function InlineNumberCell({
  value,
  onSave,
  min,
  max,
  step = 0.1,
  prefix,
  suffix,
  disabled = false,
  isEditing: externalEditing,
  onStartEdit,
  onCancel,
}: InlineNumberCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState<number | string>(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = externalEditing ?? internalEditing;

  useEffect(() => {
    if (!isEditing) setDraft(value ?? '');
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isEditing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value ?? '');
    setError(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const commit = async () => {
    const numVal = draft === '' ? null : Number(draft);
    if (numVal === value) {
      setInternalEditing(false);
      if (onCancel) onCancel();
      return;
    }

    if (numVal === null) {
      setError('Value required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(numVal);
      setInternalEditing(false);
      if (onCancel) onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value ?? '');
    setError(null);
    setInternalEditing(false);
    if (onCancel) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (isEditing) {
    return (
      <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
        <Box style={{ position: 'relative', minWidth: 80 }} onClick={e => e.stopPropagation()}>
          <NumberInput
            ref={inputRef}
            value={draft}
            onChange={v => { setDraft(v ?? ''); setError(null); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            size="xs"
            min={min}
            max={max}
            step={step}
            decimalScale={2}
            styles={{
              input: {
                padding: '4px 8px',
                height: 28,
                fontSize: 12,
                minHeight: 'unset',
                borderColor: error ? '#fa5252' : undefined,
              },
            }}
          />
          {saving && (
            <Box style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
              <MiniSpinner />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  const displayValue = value === null ? '—' : `${prefix ?? ''}${value}${suffix ?? ''}`;

  return (
    <Tooltip
      label={disabled ? displayValue : 'Click to edit'}
      withArrow
      position="top"
      openDelay={600}
    >
      <Box
        onClick={startEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: disabled ? 'default' : 'pointer',
          borderRadius: 4,
          padding: '2px 4px',
          margin: '-2px -4px',
          transition: 'background 0.12s',
          background: !disabled && hovered ? 'rgba(99,102,241,0.08)' : 'transparent',
        }}
      >
        <Text size="sm" style={{ lineHeight: 1.4 }}>
          {value !== null ? displayValue : <Text span c="dimmed">—</Text>}
        </Text>
      </Box>
    </Tooltip>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE SELECT CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineSelectOption {
  value: string;
  label: string;
}

export interface InlineSelectCellProps {
  value: string | null;
  options: InlineSelectOption[];
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
}

export function InlineSelectCell({
  value,
  options,
  onSave,
  placeholder = 'Select…',
  disabled = false,
  isEditing: externalEditing,
  onStartEdit,
  onCancel,
}: InlineSelectCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const isEditing = externalEditing ?? internalEditing;

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value);
    setError(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const commit = async (newValue: string | null) => {
    if (newValue === value || !newValue) {
      setInternalEditing(false);
      if (onCancel) onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(newValue);
      setInternalEditing(false);
      if (onCancel) onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setInternalEditing(false);
    if (onCancel) onCancel();
  };

  if (isEditing) {
    return (
      <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
        <Box style={{ position: 'relative', minWidth: 120 }} onClick={e => e.stopPropagation()}>
          <Select
            data={options}
            value={draft}
            onChange={v => { commit(v); }}
            onBlur={cancel}
            placeholder={placeholder}
            disabled={saving}
            size="xs"
            searchable
            styles={{
              input: {
                padding: '4px 8px',
                height: 28,
                fontSize: 12,
                minHeight: 'unset',
                borderColor: error ? '#fa5252' : undefined,
              },
              dropdown: { zIndex: 9999 },
            }}
            comboboxProps={{ withinPortal: true }}
          />
          {saving && (
            <Box style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
              <MiniSpinner />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  const displayValue = options.find(o => o.value === value)?.label ?? (value || placeholder);

  return (
    <Tooltip
      label={disabled ? displayValue : 'Click to edit'}
      withArrow
      position="top"
      openDelay={600}
    >
      <Box
        onClick={startEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: disabled ? 'default' : 'pointer',
          borderRadius: 4,
          padding: '2px 4px',
          margin: '-2px -4px',
          transition: 'background 0.12s',
          background: !disabled && hovered ? 'rgba(99,102,241,0.08)' : 'transparent',
        }}
      >
        <Text size="sm" style={{ lineHeight: 1.4 }}>
          {value
            ? options.find(o => o.value === value)?.label ?? value
            : <Text span c="dimmed">{placeholder}</Text>
          }
        </Text>
      </Box>
    </Tooltip>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE DATE CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineDateCellProps {
  value: string | null; // ISO date format (YYYY-MM-DD)
  onSave: (value: string | null) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
}

export function InlineDateCell({
  value,
  onSave,
  placeholder = 'Select date…',
  disabled = false,
  isEditing: externalEditing,
  onStartEdit,
  onCancel,
}: InlineDateCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value ? new Date(value) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const isEditing = externalEditing ?? internalEditing;

  useEffect(() => {
    if (!isEditing) setDraft(value ? new Date(value) : null);
  }, [value, isEditing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value ? new Date(value) : null);
    setError(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const commit = async (newDate: Date | null) => {
    const newValue = newDate ? newDate.toISOString().split('T')[0] : null;
    if (newValue === value) {
      setInternalEditing(false);
      if (onCancel) onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(newValue);
      setInternalEditing(false);
      if (onCancel) onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value ? new Date(value) : null);
    setError(null);
    setInternalEditing(false);
    if (onCancel) onCancel();
  };

  if (isEditing) {
    return (
      <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
        <Box style={{ position: 'relative', minWidth: 120 }} onClick={e => e.stopPropagation()}>
          <DatePickerInput
            value={draft}
            onChange={v => { commit(v); }}
            onBlur={cancel}
            placeholder={placeholder}
            disabled={saving}
            size="xs"
            clearable
            styles={{
              input: {
                padding: '4px 8px',
                height: 28,
                fontSize: 12,
                minHeight: 'unset',
                borderColor: error ? '#fa5252' : undefined,
              },
            }}
          />
          {saving && (
            <Box style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
              <MiniSpinner />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  const displayValue = value ? new Date(value).toLocaleDateString() : placeholder;

  return (
    <Tooltip
      label={disabled ? displayValue : 'Click to edit'}
      withArrow
      position="top"
      openDelay={600}
    >
      <Box
        onClick={startEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: disabled ? 'default' : 'pointer',
          borderRadius: 4,
          padding: '2px 4px',
          margin: '-2px -4px',
          transition: 'background 0.12s',
          background: !disabled && hovered ? 'rgba(99,102,241,0.08)' : 'transparent',
        }}
      >
        <Text size="sm" style={{ lineHeight: 1.4 }}>
          {value
            ? displayValue
            : <Text span c="dimmed">{placeholder}</Text>
          }
        </Text>
      </Box>
    </Tooltip>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE SWITCH CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineSwitchCellProps {
  value: boolean;
  onSave: (value: boolean) => Promise<void>;
  label?: string;
  disabled?: boolean;
}

export function InlineSwitchCell({
  value,
  onSave,
  label,
  disabled = false,
}: InlineSwitchCellProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (checked: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(checked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
      <Box style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <Switch
          checked={value}
          onChange={e => handleChange(e.currentTarget.checked)}
          disabled={disabled || saving}
          label={label}
          size="xs"
        />
        {saving && (
          <Box style={{ position: 'absolute', right: -2, top: '50%', transform: 'translateY(-50%)' }}>
            <MiniSpinner />
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// INLINE BADGE SELECT CELL
// ──────────────────────────────────────────────────────────────────────────

export interface InlineBadgeSelectOption {
  value: string;
  label: string;
  color: string;
}

export interface InlineBadgeSelectCellProps {
  value: string;
  options: InlineBadgeSelectOption[];
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
}

export function InlineBadgeSelectCell({
  value,
  options,
  onSave,
  disabled = false,
  isEditing: externalEditing,
  onStartEdit,
  onCancel,
}: InlineBadgeSelectCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = externalEditing ?? internalEditing;

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value);
    setError(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const commit = async (newValue: string | null) => {
    if (newValue === value || !newValue) {
      setInternalEditing(false);
      if (onCancel) onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(newValue);
      setInternalEditing(false);
      if (onCancel) onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setInternalEditing(false);
    if (onCancel) onCancel();
  };

  const currentOption = options.find(o => o.value === value);

  if (isEditing) {
    return (
      <Tooltip label={error} color="red" disabled={!error} withArrow position="top">
        <Box style={{ position: 'relative', minWidth: 120 }} onClick={e => e.stopPropagation()}>
          <Select
            data={options.map(o => ({ value: o.value, label: o.label }))}
            value={draft}
            onChange={v => { commit(v); }}
            onBlur={cancel}
            disabled={saving}
            size="xs"
            searchable
            styles={{
              input: {
                padding: '4px 8px',
                height: 28,
                fontSize: 12,
                minHeight: 'unset',
                borderColor: error ? '#fa5252' : undefined,
              },
              dropdown: { zIndex: 9999 },
            }}
            comboboxProps={{ withinPortal: true }}
          />
          {saving && (
            <Box style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
              <MiniSpinner />
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={disabled ? currentOption?.label : 'Click to edit'}
      withArrow
      position="top"
      openDelay={600}
    >
      <Badge
        onClick={startEdit}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
        }}
        color={currentOption?.color ?? 'gray'}
        variant="light"
        size="sm"
      >
        {currentOption?.label ?? value}
      </Badge>
    </Tooltip>
  );
}

export default {
  InlineTextCell,
  InlineNumberCell,
  InlineSelectCell,
  InlineDateCell,
  InlineSwitchCell,
  InlineBadgeSelectCell,
};
