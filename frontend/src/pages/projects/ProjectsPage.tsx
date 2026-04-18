import { Button, Group, Stack, SegmentedControl, Tabs } from '@mantine/core';
import { PPPageLayout } from '../../components/pp';
import { AQUA_HEX, DEEP_BLUE_HEX } from '../../brandTokens';
import { IconPlus, IconPlugConnected, IconLayoutList, IconLayoutKanban, IconTimeline, IconRefresh } from '@tabler/icons-react';
import KanbanBoardView from '../../components/projects/KanbanBoardView';
import GanttView from '../../components/projects/GanttView';
import SavedViews from '../../components/common/SavedViews';
import FilterPills from '../../components/common/FilterPills';
import { PageInsightCard } from '../../components/common/PageInsightCard';
import { useDarkMode } from '../../hooks/useDarkMode';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { BASE_STATUS_OPTIONS, EMPTY_FILTERS, EMPTY_FORM, priorityOptions, DEFAULT_INITIATIVE_JQL } from './constants';
import type { ViewMode } from './types';
import type { SourceType } from '../../types/project';
import { CreateProjectModal } from './components/CreateProjectModal';
import { JiraImportModal } from './components/JiraImportModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import MetricsCards from './components/MetricsCards';
import FilterBar from './components/FilterBar';
import SourceFilterPills from './components/SourceFilterPills';
import BulkActionBar from './components/BulkActionBar';
import TableContent from './components/TableContent';
import { useProjectsPage } from './state/hooks';

export default function ProjectsPage() {
  const isDark = useDarkMode();
  const hookState = useProjectsPage();
  const {
    isLoading, error, projectsUpdatedAt, projects, toast,
    createMutation, updateMutation, copyMutation, deleteMutation,
    pendingProjectIds, healthByProjectId,
    selectedRows, setSelectedRows, toggleRowSelect, toggleSelectAll, deleteTarget, setDeleteTarget, confirmDelete, handleDelete,
    editingCell, setEditingCell, editDraft, setEditDraft, editDateDraft, setEditDateDraft, editNumberDraft, setEditNumberDraft,
    startEdit, commitEdit, cancelEdit,
    addRowActive, setAddRowActive, addRowForm, setAddRowForm, submitAddRow, effortPatterns,
    viewMode, setViewMode,
    modalOpen, setModalOpen, jiraSyncing, handleJiraSync, jiraImportOpen, setJiraImportOpen,
    form, setForm, nameError, setNameError, handleCreate,
    jiraImportSearch, setJiraImportSearch, jiraJql, setJiraJql, jiraJqlInput, setJiraJqlInput,
    jiraSelectedProjects, setJiraSelectedProjects, jiraIssueType, setJiraIssueType, jiraShowAdvanced, setJiraShowAdvanced,
    setJiraSearchEnabled, setSelectedJiraKeys,
    selectedJiraKeys, toggleJiraKey, toggleAllImportable,
    importingCount, setImportingCount, importedCount, setImportedCount, importErrors, setImportErrors,
    jiraProjects, jiraProjectsLoading, jiraProjectsError, allJiraProjectsList,
    importableJiraProjects, alreadyImportedJiraProjects, filteredImportableProjects,
    buildAndRunJql, handleJiraImport,
    visibleColsArray, visibleCols, toggleCol, density, setDensity,
    advFilters, setAdvFilters, activeViewId, setActiveViewId,
    expandedRows, toggleExpand, podsByProject,
    existingNames,     statusFilter, setStatusFilter, cardFilter, setCardFilter, search, setSearch,
    ownerFilter, setOwnerFilter, priorityFilter, setPriorityFilter, sourceFilter, setSourceFilter,
    applyCardFilter, handleSegmentedChange, ownerOptions,
    filtered, boardProjects, sortKey, sortDir, onSort, pagedProjects, pagination,
    statusOptions, projectFilterFields, stats,
    highlightId, highlightRowRef, flashId,
    handleBoardStatusChange, navigate, monthLabels
  } = hookState;

  if (isLoading) return <LoadingSpinner variant="table" message="Loading projects..." />;
  if (error) return <PageError context="loading projects" error={error} />;

  return (
    <PPPageLayout
      title="Projects"
      animate
      dataUpdatedAt={projectsUpdatedAt}
      actions={
        <Group gap="sm" align="center">
          <Tabs
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            className="view-switcher-tabs"
          >
            <Tabs.List>
              <Tabs.Tab value="table" leftSection={<IconLayoutList size={14} />}>Table</Tabs.Tab>
              <Tabs.Tab value="board" leftSection={<IconLayoutKanban size={14} />}>Board</Tabs.Tab>
              <Tabs.Tab value="gantt" leftSection={<IconTimeline size={14} />}>Timeline</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <Button
            variant="light"
            color="blue"
            leftSection={<IconPlugConnected size={16} />}
            onClick={() => {
              setJiraImportOpen(true);
              setSelectedJiraKeys(new Set());
              setImportingCount(0);
              setImportedCount(0);
              setImportErrors([]);
            }}
          >
            Import from Jira
          </Button>
          <Button
            variant="filled"
            leftSection={<IconRefresh size={16} />}
            loading={jiraSyncing}
            onClick={handleJiraSync}
            style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
          >
            Sync from Jira
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Add Project</Button>
        </Group>
      }
    >
      <PageInsightCard pageKey="projects" data={projects} />
      <Stack gap={16} className="stagger-children">
        <MetricsCards
          stats={stats}
          cardFilter={cardFilter}
          statusFilter={statusFilter}
          onCardFilterChange={applyCardFilter}
        />

        {viewMode === 'table' && (
          <SegmentedControl
            value={statusFilter}
            onChange={handleSegmentedChange}
            data={[
              { value: 'ALL', label: 'All' },
              ...BASE_STATUS_OPTIONS,
            ]}
          />
        )}

        <SourceFilterPills
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          ownerOptions={ownerOptions}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={v => { setPriorityFilter(v); setCardFilter(null); }}
          priorityOptions={priorityOptions}
          advFilters={advFilters}
          onAdvFiltersChange={setAdvFilters}
          projectFilterFields={projectFilterFields}
          onClearAllFilters={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); setAdvFilters(EMPTY_FILTERS); setActiveViewId(null); }}
          filteredCount={filtered.length}
          totalCount={(projects ?? []).length}
          density={density}
          onDensityChange={setDensity}
          visibleColsArray={visibleColsArray}
          onToggleCol={toggleCol}
          visibleCols={visibleCols}
        />

        <SavedViews
          pageKey="projects"
          variant="tabs"
          activeViewId={activeViewId}
          onActiveViewChange={setActiveViewId}
          currentFilters={{
            search: search || null,
            ownerFilter: ownerFilter,
            priorityFilter: priorityFilter,
            statusFilter: statusFilter !== 'ALL' ? statusFilter : null,
            sourceFilter: sourceFilter !== 'ALL' ? sourceFilter : null,
            advFilters: advFilters.conditions.length > 0 ? JSON.stringify(advFilters) : null,
          }}
          onApply={v => {
            setSearch(v.search ?? '');
            setOwnerFilter(v.ownerFilter ?? null);
            setPriorityFilter(v.priorityFilter ?? null);
            setStatusFilter(v.statusFilter ?? 'ALL');
            setSourceFilter((v.sourceFilter ?? 'ALL') as SourceType | 'ALL' | 'ARCHIVED');
            if (v.advFilters) { try { setAdvFilters(JSON.parse(v.advFilters)); } catch { setAdvFilters(EMPTY_FILTERS); } }
            else setAdvFilters(EMPTY_FILTERS);
            setCardFilter(null);
          }}
        />

        <FilterPills
          onClearAll={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); setStatusFilter('ALL'); setSourceFilter('ALL'); setAdvFilters(EMPTY_FILTERS); setActiveViewId(null); setCardFilter(null); }}
          pills={[
            ...(search ? [{ key: 'search', label: `Name: "${search}"`, color: 'blue', onRemove: () => setSearch('') }] : []),
            ...(ownerFilter ? [{ key: 'owner', label: `Owner: ${ownerFilter}`, color: 'teal', onRemove: () => setOwnerFilter(null) }] : []),
            ...(priorityFilter ? [{ key: 'priority', label: `Priority: ${priorityFilter}`, color: 'orange', onRemove: () => setPriorityFilter(null) }] : []),
            ...(statusFilter !== 'ALL' ? [{ key: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, color: 'violet', onRemove: () => setStatusFilter('ALL') }] : []),
            ...(cardFilter === 'CRITICAL' ? [{ key: 'critical', label: 'Priority: Critical (Highest / High / Blocker)', color: 'red', onRemove: () => setCardFilter(null) }] : []),
            ...advFilters.conditions
              .filter(c => Array.isArray(c.value) ? c.value.length > 0 : c.value !== '')
              .map(c => {
                const field = projectFilterFields.find(f => f.key === c.fieldKey);
                const valLabel = Array.isArray(c.value) ? c.value.join(', ') : c.value;
                return {
                  key: c.id,
                  label: `${field?.label ?? c.fieldKey}: ${valLabel}`,
                  color: 'grape',
                  onRemove: () => setAdvFilters(prev => ({ ...prev, conditions: prev.conditions.filter(x => x.id !== c.id) })),
                };
              }),
          ]}
        />

        {selectedRows.size > 0 && viewMode === 'table' && (
          <BulkActionBar
            selectedCount={selectedRows.size}
            isDark={isDark}
            onDelete={() => confirmDelete(Array.from(selectedRows))}
            onClearSelection={() => setSelectedRows(new Set())}
          />
        )}

        {viewMode === 'table' && (
          <TableContent
            density={density}
            pagedProjects={pagedProjects}
            projects={projects}
            selectedRows={selectedRows}
            toggleRowSelect={toggleRowSelect}
            toggleSelectAll={toggleSelectAll}
            expandedRows={expandedRows}
            toggleExpand={toggleExpand}
            highlightId={highlightId}
            flashId={flashId}
            highlightRowRef={highlightRowRef}
            isDark={isDark}
            visibleCols={visibleCols}
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
            podsByProject={podsByProject}
            navigate={navigate}
            copyMutation={copyMutation}
            confirmDelete={confirmDelete}
            updateMutation={updateMutation}
            toast={toast}
            addRowActive={addRowActive}
            setAddRowActive={setAddRowActive}
            addRowForm={addRowForm}
            setAddRowForm={setAddRowForm}
            effortPatterns={effortPatterns}
            submitAddRow={submitAddRow}
            createMutation={createMutation}
            sortKey={sortKey ?? ''}
            sortDir={sortDir}
            onSort={onSort}
            onCreateProject={() => setModalOpen(true)}
            onImportJira={() => setJiraImportOpen(true)}
            onClearFilters={() => {
              setSearch('');
              setStatusFilter('ALL');
              setOwnerFilter(null);
              setPriorityFilter(null);
              setSourceFilter('ALL');
              setAdvFilters(EMPTY_FILTERS);
            }}
          />
        )}

        {viewMode === 'board' && (
          <KanbanBoardView
            projects={boardProjects.map(p => ({ ...p, targetDate: p.targetDate ?? undefined }))}
            onProjectClick={(id) => navigate(`/projects/${id}`)}
            onStatusChange={handleBoardStatusChange}
            onDeleteProject={(id) => confirmDelete([id])}
            onAddProject={(status) => {
              setForm({ ...EMPTY_FORM, status });
              setNameError('');
              setModalOpen(true);
            }}
          />
        )}

        {viewMode === 'gantt' && (
          <GanttView
            projects={filtered}
            monthLabels={monthLabels}
            onEdit={(p) => navigate(`/projects/${p.id}`)}
          />
        )}

        <CreateProjectModal
          opened={modalOpen}
          onClose={() => { setModalOpen(false); setNameError(''); }}
          form={form}
          onFormChange={setForm}
          nameError={nameError}
          onNameErrorChange={setNameError}
          effortPatterns={effortPatterns}
          statusOptions={statusOptions}
          existingNames={existingNames}
          isLoading={createMutation.isPending}
          onCreate={handleCreate}
        />

        <JiraImportModal
          opened={jiraImportOpen}
          onClose={() => {
            setJiraImportOpen(false);
            setJiraImportSearch('');
            setJiraJqlInput('');
            setJiraJql(DEFAULT_INITIATIVE_JQL);
            setJiraSearchEnabled(true);
            setJiraSelectedProjects([]);
            setJiraIssueType('Initiative');
            setJiraShowAdvanced(false);
          }}
          issueType={jiraIssueType}
          onIssueTypeChange={setJiraIssueType}
          selectedProjects={jiraSelectedProjects}
          onSelectedProjectsChange={setJiraSelectedProjects}
          allProjectsList={allJiraProjectsList}
          showAdvanced={jiraShowAdvanced}
          onShowAdvancedChange={setJiraShowAdvanced}
          jqlInput={jiraJqlInput}
          onJqlInputChange={setJiraJqlInput}
          jql={jiraJql}
          importSearch={jiraImportSearch}
          onImportSearchChange={setJiraImportSearch}
          jiraProjects={jiraProjects}
          isLoading={jiraProjectsLoading}
          isError={jiraProjectsError}
          selectedJiraKeys={selectedJiraKeys}
          onJiraKeyToggle={toggleJiraKey}
          onSelectAllImportable={toggleAllImportable}
          importableProjects={importableJiraProjects}
          alreadyImportedProjects={alreadyImportedJiraProjects}
          filteredImportableProjects={filteredImportableProjects}
          importingCount={importingCount}
          importedCount={importedCount}
          importErrors={importErrors}
          onSearch={buildAndRunJql}
          onImport={handleJiraImport}
        />

        <DeleteConfirmModal
          opened={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          deleteTarget={deleteTarget}
          projects={projects}
          isLoading={deleteMutation.isPending}
          onConfirm={handleDelete}
        />
      </Stack>
    </PPPageLayout>
  );
}
