import { ScrollArea, Table, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DENSITY_SPACING } from '../constants';
import ProjectTableHeader from './ProjectTableHeader';
import ProjectTableEmpty from './ProjectTableEmpty';
import TableRow from './TableRow';
import AddProjectRow from './AddProjectRow';
import TablePagination from '../../../components/common/TablePagination';
import type { ProjectResponse } from '../../../types';
import type { Density, EditableField, AddRowForm } from '../types';

interface TableContentProps {
  density: Density;
  pagedProjects: ProjectResponse[];
  projects: ProjectResponse[] | undefined;
  selectedRows: Set<number>;
  toggleRowSelect: (id: number, e: React.MouseEvent) => void;
  toggleSelectAll: () => void;
  expandedRows: Set<number>;
  toggleExpand: (id: number, e: React.MouseEvent) => void;
  highlightId: number | null;
  flashId: number | null;
  highlightRowRef: React.RefObject<HTMLTableRowElement>;
  isDark: boolean;
  visibleCols: Set<string>;
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
  podsByProject: Map<number, any[]>;
  navigate: (path: string) => void;
  copyMutation: any;
  confirmDelete: (ids: number[]) => void;
  updateMutation: any;
  toast: any;
  addRowActive: boolean;
  setAddRowActive: (value: boolean) => void;
  addRowForm: AddRowForm;
  setAddRowForm: (form: AddRowForm) => void;
  effortPatterns: any[] | undefined;
  submitAddRow: () => void;
  createMutation: any;
  sortKey: string;
  sortDir: 'asc' | 'desc' | null;
  onSort: (key: string) => void;
  onCreateProject: () => void;
  onImportJira: () => void;
  onClearFilters: () => void;
}

export default function TableContent(props: TableContentProps) {
  const {
    density,
    pagedProjects,
    projects,
    selectedRows,
    toggleRowSelect,
    toggleSelectAll,
    expandedRows,
    toggleExpand,
    highlightId,
    flashId,
    highlightRowRef,
    isDark,
    visibleCols,
    pagination,
    editingCell,
    startEdit,
    commitEdit,
    cancelEdit,
    setEditingCell,
    editDraft,
    setEditDraft,
    editDateDraft,
    setEditDateDraft,
    editNumberDraft,
    setEditNumberDraft,
    pendingProjectIds,
    priorityOptions,
    statusOptions,
    monthLabels,
    healthByProjectId,
    podsByProject,
    navigate,
    copyMutation,
    confirmDelete,
    updateMutation,
    toast,
    addRowActive,
    setAddRowActive,
    addRowForm,
    setAddRowForm,
    effortPatterns,
    submitAddRow,
    createMutation,
    sortKey,
    sortDir,
    onSort,
    onCreateProject,
    onImportJira,
    onClearFilters,
  } = props;

  return (
    <>
      <ScrollArea>
        <Table fz={density === 'comfortable' ? 'sm' : 'xs'} verticalSpacing={DENSITY_SPACING[density]} highlightOnHover withTableBorder withColumnBorders>
          <ProjectTableHeader
            visibleCols={visibleCols}
            density={density}
            selectedRowsCount={selectedRows.size}
            totalRowsCount={pagedProjects.length}
            onSelectAll={toggleSelectAll}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <Table.Tbody>
            {pagedProjects.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={13} style={{ padding: '0' }}>
                  <ProjectTableEmpty
                    hasAnyProjects={(projects ?? []).length > 0}
                    onCreateProject={onCreateProject}
                    onImportJira={onImportJira}
                    onClearFilters={onClearFilters}
                  />
                </Table.Td>
              </Table.Tr>
            )}
            {pagedProjects.map((p, idx) => {
              const isExpanded = expandedRows.has(p.id);
              const pods = podsByProject.get(p.id) ?? [];
              const hasPods = pods.length > 0;
              return (
                <TableRow
                  key={p.id}
                  project={p}
                  idx={idx}
                  highlightId={highlightId}
                  flashId={flashId}
                  highlightRowRef={highlightRowRef}
                  isDark={isDark}
                  isExpanded={isExpanded}
                  hasPods={hasPods}
                  pods={pods}
                  visibleCols={visibleCols}
                  selectedRows={selectedRows}
                  toggleRowSelect={toggleRowSelect}
                  toggleExpand={toggleExpand}
                  pagination={pagination}
                  editingCell={editingCell}
                  startEdit={startEdit}
                  commitEdit={commitEdit}
                  cancelEdit={cancelEdit}
                  setEditingCell={setEditingCell}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  editDateDraft={editDateDraft}
                  setEditDateDraft={setEditDateDraft}
                  editNumberDraft={editNumberDraft}
                  setEditNumberDraft={setEditNumberDraft}
                  pendingProjectIds={pendingProjectIds}
                  priorityOptions={priorityOptions}
                  statusOptions={statusOptions}
                  monthLabels={monthLabels}
                  healthByProjectId={healthByProjectId}
                  navigate={navigate}
                  copyMutation={copyMutation}
                  confirmDelete={confirmDelete}
                  updateMutation={updateMutation}
                  toast={toast}
                />
              );
            })}
            {addRowActive ? (
              <AddProjectRow
                addRowForm={addRowForm}
                setAddRowForm={setAddRowForm}
                visibleCols={visibleCols}
                priorityOptions={priorityOptions}
                effortPatterns={effortPatterns}
                statusOptions={statusOptions}
                submitAddRow={submitAddRow}
                setAddRowActive={setAddRowActive}
                isDark={isDark}
                createMutation={createMutation}
              />
            ) : (
              <Table.Tr
                style={{ cursor: 'pointer', opacity: 0.6 }}
                onClick={() => setAddRowActive(true)}
              >
                <Table.Td colSpan={12} style={{ textAlign: 'center', padding: '8px', color: 'var(--pp-text-subtle)', fontSize: 12 }}>
                  <Group gap={4} justify="center">
                    <IconPlus size={13} />
                    <span>Add project</span>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <TablePagination {...pagination} />
    </>
  );
}
