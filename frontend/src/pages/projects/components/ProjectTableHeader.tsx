import { Table, Checkbox } from '@mantine/core';
import SortableHeader from '../../../components/common/SortableHeader';
import type { Density } from '../types';

interface ProjectTableHeaderProps {
  visibleCols: Set<string>;
  density: Density;
  selectedRowsCount: number;
  totalRowsCount: number;
  onSelectAll: () => void;
  sortKey: string;
  sortDir: 'asc' | 'desc' | null;
  onSort: (key: string) => void;
}

export default function ProjectTableHeader(props: ProjectTableHeaderProps) {
  const {
    visibleCols,
    selectedRowsCount,
    totalRowsCount,
    onSelectAll,
    sortKey,
    sortDir,
    onSort,
  } = props;


  return (
    <Table.Thead>
      <Table.Tr>
        <Table.Th style={{ width: 36 }}>
          <Checkbox
            size="xs"
            checked={totalRowsCount > 0 && selectedRowsCount === totalRowsCount}
            indeterminate={selectedRowsCount > 0 && selectedRowsCount < totalRowsCount}
            onChange={onSelectAll}
            onClick={e => e.stopPropagation()}
          />
        </Table.Th>
        <Table.Th style={{ width: 32 }} />
        {visibleCols.has('#') && <Table.Th style={{ width: 40 }}>#</Table.Th>}
        <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
        {visibleCols.has('Priority') && <SortableHeader sortKey="priority" currentKey={sortKey} dir={sortDir} onSort={onSort}>Priority</SortableHeader>}
        {visibleCols.has('Owner') && <SortableHeader sortKey="owner" currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>}
        {visibleCols.has('Start') && <SortableHeader sortKey="startMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>Start</SortableHeader>}
        {visibleCols.has('End') && <SortableHeader sortKey="targetEndMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>End</SortableHeader>}
        {visibleCols.has('Duration') && <SortableHeader sortKey="durationMonths" currentKey={sortKey} dir={sortDir} onSort={onSort}>Duration</SortableHeader>}
        {visibleCols.has('Pattern') && <Table.Th>Pattern</Table.Th>}
        {visibleCols.has('Status') && <SortableHeader sortKey="status" currentKey={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>}
        {visibleCols.has('Budget') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Est. Budget</Table.Th>}
        {visibleCols.has('Health') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Health</Table.Th>}
        {visibleCols.has('Created') && <SortableHeader sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={onSort}>Created</SortableHeader>}
        <Table.Th style={{ width: 110 }}>Source</Table.Th>
        <Table.Th style={{ width: 50 }}>Actions</Table.Th>
      </Table.Tr>
    </Table.Thead>
  );
}
