/**
 * InlineEditCell — Click-to-edit table cell component.
 *
 * Renders the current value as display text.
 * On click → switches to an inline input (text, select, or date).
 * On Enter/blur → commits the change (calls onSave).
 * On Escape → cancels without saving.
 *
 * Usage:
 *   <InlineEditCell
 *     value={project.name}
 *     onSave={(v) => updateProject({ name: v })}
 *   />
 *
 *   <InlineEditCell
 *     value={project.status}
 *     type="select"
 *     options={statusOptions}
 *     onSave={(v) => updateProject({ status: v })}
 *   />
 */
import { useState, useRef, useEffect } from 'react';
import { Box, Text, TextInput, Select, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';

export interface InlineEditOption {
  value: string;
  label: string;
}

export interface InlineEditCellProps {
  /** Current display value */
  value: string;
  /** Field type — controls the edit widget */
  type?: 'text' | 'select' | 'date';
  /** Options for select fields */
  options?: InlineEditOption[];
  /** Called with the new value when the user commits the edit */
  onSave: (value: string) => void;
  /** Optional placeholder for empty state */
  placeholder?: string;
  /** Render function for the display value (defaults to plain text) */
  renderDisplay?: (value: string) => React.ReactNode;
  /** Whether editing is allowed */
  disabled?: boolean;
  /** Max width of the edit input (px) */
  maxWidth?: number;
}

export function InlineEditCell({
  value,
  type = 'text',
  options = [],
  onSave,
  placeholder = '—',
  renderDisplay,
  disabled = false,
  maxWidth = 240,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLInputElement>(null);

  // Sync draft if external value changes
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        selectRef.current?.focus();
      }, 30);
    }
  }, [editing]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }

  if (editing) {
    if (type === 'select') {
      return (
        <Box style={{ minWidth: 120, maxWidth }} onClick={e => e.stopPropagation()}>
          <Select
            ref={selectRef}
            data={options}
            value={draft}
            onChange={v => { setDraft(v ?? ''); setTimeout(commit, 80); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            size="xs"
            styles={{
              input: { padding: '3px 8px', height: 28, fontSize: 12, minHeight: 'unset' },
              dropdown: { zIndex: 9999 },
            }}
            comboboxProps={{ withinPortal: true }}
          />
        </Box>
      );
    }

    if (type === 'date') {
      return (
        <Box style={{ minWidth: 120, maxWidth }} onClick={e => e.stopPropagation()}>
          <TextInput
            ref={inputRef}
            type="date"
            value={draft}
            onChange={e => setDraft(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            size="xs"
            styles={{ input: { padding: '3px 8px', height: 28, fontSize: 12, minHeight: 'unset' } }}
          />
        </Box>
      );
    }

    // Default: text
    return (
      <Box style={{ minWidth: 80, maxWidth }} onClick={e => e.stopPropagation()}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          size="xs"
          styles={{ input: { padding: '3px 8px', height: 28, fontSize: 12, minHeight: 'unset' } }}
        />
      </Box>
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
        <Box style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {value
            ? (renderDisplay ? renderDisplay(value) : (
                <Text size="sm" style={{ lineHeight: 1.4 }}>{value}</Text>
              ))
            : <Text size="sm" c="dimmed">{placeholder}</Text>
          }
        </Box>
        {!disabled && hovered && (
          <IconPencil size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
        )}
      </Box>
    </Tooltip>
  );
}

export default InlineEditCell;
