import { ScrollArea, Table, Checkbox } from '@mantine/core';
import KanbanBoardView from '../../../components/projects/KanbanBoardView';
import GanttView from '../../../components/projects/GanttView';
import TablePagination from '../../../components/common/TablePagination';
import TableRow from './TableRow';
import AddProjectRow from './AddProjectRow';
import ProjectTableEmpty from './ProjectTableEmpty';
import type { ViewMode, EditableField, Density, AddRowForm } from '../types';
import type { ProjectResponse } from '../../../types';

interface ViewModeContainerProps {
  viewMode: ViewMode;
  pagedProjects: ProjectResponse[];
  projects: ProjectResponse[] | undefined;
  onRowClick: (projectId: number) => void;
  // Table-specific props
  selectedRows: Set<number>;
  setSelectedRows: (rows: Set<number>) => void;
  toggleRowSelect: (id: number, e: React.MouseEvent) => void;
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
  copyMutation: any;
  confirmDelete: (ids: number[]) => void;
  updateMutation: any;
  toast: any;
  // Add row props
  addRowActive: boolean;
  setAddRowActive: (value: boolean) => void;
  addRowForm: AddRowForm;
  setAddRowForm: (form: AddRowForm) => void;
  effortPatterns: any[] | undefined;
  submitAddRow: () => void;
  createMutation: any;
  // Board/Gantt props
  boardProjects: ProjectResponse[];
  filteredProjects: ProjectResponse[];
  density: Density;
}

export default function ViewModeContainer(props: ViewModeContainerProps) {
  const {
    viewMode,
    pagedProjects,
    projects,
    onRowClick,
    selectedRows,
    setSelectedRows,
    toggleRowSelect,
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
    boardProjects,
    filteredProjects,
    density,
  } = props;

  if (viewMode === 'table') {
    return (
      <>
        <ScrollArea>
          <Table fz={density === 'comfortable' ? 'sm' : 'xs'} verticalSpacing={{ compact: 4, normal: 8, comfortable: 12 }[density]} highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 36 }}>
                  <Checkbox
                    size="xs"
                    checked={pagedProjects.length > 0 && selectedRows.size === pagedProjects.length}
                    indeterminate={selectedRows.size > 0 && selectedRows.size < pagedProjects.length}
                    onChange={() => {
                      if (selectedRows.size === pagedProjects.length) {
                        setSelectedRows(new Set());
                      } else {
                        setSelectedRows(new Set(pagedProjects.map(p => p.id)));
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                </Table.Th>
                <Table.Th style={{ width: 32 }} />
                {visibleCols.has('#') && <Table.Th style={{ width: 40 }}>#</Table.Th>}
                <Table.Th>Name</Table.Th>
                {visibleCols.has('Priority') && <Table.Th>Priority</Table.Th>}
                {visibleCols.has('Owner') && <Table.Th>Owner</Table.Th>}
                {visibleCols.has('Start') && <Table.Th>Start</Table.Th>}
                {visibleCols.has('End') && <Table.Th>End</Table.Th>}
                {visibleCols.has('Duration') && <Table.Th>Duration</Table.Th>}
                {visibleCols.has('Pattern') && <Table.Th>Pattern</Table.Th>}
                {visibleCols.has('Status') && <Table.Th>Status</Table.Th>}
                {visibleCols.has('Budget') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Est. Budget</Table.Th>}
                {visibleCols.has('Health') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Health</Table.Th>}
                {visibleCols.has('Created') && <Table.Th>Created</Table.Th>}
                <Table.Th style={{ width: 110 }}>Source</Table.Th>
                <Table.Th style={{ width: 50 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pagedProjects.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={13} style={{ padding: '0' }}>
                    <ProjectTableEmpty
                      hasAnyProjects={(projects ?? []).length > 0}
                      onCreateProject={() => {}}
                      onImportJira={() => {}}
                      onClearFilters={() => {}}
                    />
                  </Table.Td>
                </Table.Tr>
              ) : (
                <>
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
                        navigate={(path: string) => onRowClick(Number(path.split('/').pop()))}
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
                    <Table.Tr style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setAddRowActive(true)}>
                      <Table.Td colSpan={12} style={{ textAlign: 'center', padding: '8px', color: 'var(--pp-text-subtle)', fontSize: 12 }}>
                        + Add project
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <TablePagination {...pagination} />
      </>
    );
  }

  if (viewMode === 'board') {
    return (
      <KanbanBoardView
        projects={boardProjects.map(p => ({ ...p, targetDate: p.targetDate ?? undefined }))}
        onProjectClick={onRowClick}
        onStatusChange={() => {}}
        onDeleteProject={(id) => confirmDelete([id])}
        onAddProject={() => {}}
      />
    );
  }

  return (
    <GanttView
      projects={filteredProjects}
      monthLabels={monthLabels}
      onEdit={(p) => onRowClick(p.id)}
    />
  );
}
