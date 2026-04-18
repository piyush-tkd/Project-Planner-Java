import { Table, Group, Text, Badge, ActionIcon, Menu } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconDots, IconCopy, IconTrash, IconPencil } from '@tabler/icons-react';
import type { ProjectResponse } from '../../../types';
import type { EditableField } from '../types';

interface TableRowProps {
  project: ProjectResponse;
  idx: number;
  highlightId: number | null;
  flashId: number | null;
  highlightRowRef: React.RefObject<HTMLTableRowElement>;
  isDark: boolean;
  isExpanded: boolean;
  hasPods: boolean;
  pods: any[];
  visibleCols: Set<string>;
  selectedRows: Set<number>;
  toggleRowSelect: (id: number, e: React.MouseEvent) => void;
  toggleExpand: (id: number, e: React.MouseEvent) => void;
  pagination: any;
  editingCell: { id: number; field: EditableField } | null;
  startEdit: (id: number, field: EditableField, currentValue: string | number | null) => void;
  commitEdit: (project: ProjectResponse) => void;
  cancelEdit: () => void;
  setEditingCell: (value: { id: number; field: EditableField } | null) => void;
  editDraft: string;
  setEditDraft: (value: string) => void;
  editDateDraft: Date | null;
  setEditDateDraft: (value: Date | null) => void;
  editNumberDraft: number | null;
  setEditNumberDraft: (value: number | null) => void;
  pendingProjectIds: Set<number>;
  priorityOptions: any[];
  statusOptions: any[];
  monthLabels: Record<number, string> | string[];
  healthByProjectId: Map<number, any>;
  navigate: (path: string) => void;
  copyMutation: any;
  confirmDelete: (ids: number[]) => void;
  updateMutation: any;
  toast: any;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGHEST: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'blue',
  LOWEST: 'gray',
  BLOCKER: 'red',
  MINOR: 'gray',
};

export default function TableRow({
  project,
    highlightId,
  flashId,
  highlightRowRef,
    isExpanded,
  hasPods,
    visibleCols,
  selectedRows,
  toggleRowSelect,
  toggleExpand,
  pendingProjectIds,
  navigate,
  copyMutation,
  confirmDelete,
}: TableRowProps) {
  const isHighlighted = highlightId === project.id;
  const isFlashing = flashId === project.id;
  const isSelected = selectedRows.has(project.id);
  const isPending = pendingProjectIds.has(project.id);

  return (
    <Table.Tr
      ref={isHighlighted ? highlightRowRef : undefined}
      style={{
        background: isSelected
          ? 'var(--mantine-color-blue-light)'
          : isFlashing
          ? 'var(--mantine-color-yellow-light)'
          : undefined,
        cursor: 'pointer',
        opacity: isPending ? 0.6 : 1,
      }}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <Table.Td onClick={e => toggleRowSelect(project.id, e)} style={{ width: 32 }}>
        <input type="checkbox" checked={isSelected} onChange={() => {}} />
      </Table.Td>

      <Table.Td style={{ width: 32 }}>
        {hasPods && (
          <ActionIcon size="xs" variant="subtle" onClick={e => toggleExpand(project.id, e)} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        )}
      </Table.Td>

      <Table.Td>
        <Group gap="xs">
          <Text size="sm" fw={500} lineClamp={1}>{project.name}</Text>
          {project.jiraEpicKey && (
            <Badge size="xs" variant="outline" color="indigo">{project.jiraEpicKey}</Badge>
          )}
        </Group>
      </Table.Td>

      {visibleCols.has('Priority') && (
        <Table.Td>
          <Badge size="xs" color={PRIORITY_COLORS[project.priority] ?? 'gray'}>{project.priority}</Badge>
        </Table.Td>
      )}

      {visibleCols.has('Owner') && (
        <Table.Td><Text size="sm">{project.owner || '—'}</Text></Table.Td>
      )}

      {visibleCols.has('Start') && (
        <Table.Td><Text size="sm">{project.startDate ?? '—'}</Text></Table.Td>
      )}

      {visibleCols.has('End') && (
        <Table.Td><Text size="sm">{project.targetDate ?? '—'}</Text></Table.Td>
      )}

      {visibleCols.has('Status') && (
        <Table.Td>
          <Badge size="sm" variant="light">{project.status}</Badge>
        </Table.Td>
      )}

      {visibleCols.has('Budget') && (
        <Table.Td>
          <Text size="sm">{project.estimatedBudget != null ? `$${project.estimatedBudget.toLocaleString()}` : '—'}</Text>
        </Table.Td>
      )}

      <Table.Td onClick={e => e.stopPropagation()}>
        <Menu shadow="md" width={160}>
          <Menu.Target>
            <ActionIcon size="sm" variant="subtle" aria-label="Row actions">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => navigate(`/projects/${project.id}`)}>
              Open
            </Menu.Item>
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => copyMutation.mutate(project.id)}>
              Duplicate
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => confirmDelete([project.id])}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}
