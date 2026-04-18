import { useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import {
 Text, Group, Modal, ThemeIcon,
} from '@mantine/core';
import {
 IconPlus, IconDownload,
} from '@tabler/icons-react';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PageError from '../../../components/common/PageError';
import { EmptyState } from '../../../components/ui';
import { AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY } from '../../../brandTokens';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { generateCsvFromData, downloadCsv } from './state/utils';
import { sizeToSpan } from './state/utils';
import { useJiraDashboardBuilder } from './state/hooks';
import { AddWidgetPanel } from './components/AddWidgetPanel';
import { EditWidgetModal } from './components/EditWidgetModal';
import { RenameDashboardModal } from './components/RenameDashboardModal';
import { TemplatesModal } from './components/TemplatesModal';
import { SaveDashboardModal } from './components/SaveDashboardModal';
import { LoadDashboardModal } from './components/LoadDashboardModal';
import { DrillDownModal } from './components/DrillDownModal';
import { DashboardHeader } from './components/DashboardHeader';
import { DashboardTabs } from './components/DashboardTabs';
import { FilterBar } from './components/FilterBar';
import { WidgetGrid } from './components/WidgetGrid';
import type { DashboardWidget } from '../../../api/jira';

export default function JiraDashboardBuilderPage() {
 const dark = useDarkMode();
 const hook = useJiraDashboardBuilder();

 const handleExportDashboard = useMemo(() => () => {
   if (!hook.data) return;
   const exportData: Record<string, unknown>[] = [];
   const k = hook.data.kpis ?? {} as typeof hook.data.kpis;
   exportData.push({
     metric: 'KPI - Total Open',
     value: k.totalOpen,
   });
   exportData.push({
     metric: 'KPI - Total Created',
     value: k.totalCreated,
   });
   exportData.push({
     metric: 'KPI - Total Resolved',
     value: k.totalResolved,
   });
   exportData.push({
     metric: 'KPI - Bug Ratio (%)',
     value: k.bugRatio,
   });
   exportData.push({
     metric: 'KPI - Avg Cycle Time (days)',
     value: k.avgCycleTimeDays,
   });
   const csv = generateCsvFromData(`${hook.dashName || 'Dashboard'} - ${new Date().toLocaleString()}`, exportData);
   downloadCsv(csv, `${hook.dashName || 'Dashboard'}-${new Date().toISOString().split('T')[0]}.csv`);
 }, [hook.data, hook.dashName]);

 if (hook.isLoading) return <LoadingSpinner variant="chart" message="Fetching Jira data for dashboard..." />;
 if (hook.error) return <PageError context="loading dashboard data" error={hook.error} onRetry={() => hook.refetch()} />;
 if (!hook.data || hook.data.error) {
   if (hook.data?.needsSync) {
     return (
       <EmptyState
         icon={<IconDownload size={40} stroke={1.5} />}
         title="No synced data yet"
         description="Please sync Jira issues to the local database before building dashboards."
         actionLabel={hook.syncStatus?.syncing ? 'Syncing...' : 'Start Full Sync'}
         onAction={() => hook.triggerSync.mutate(true, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Full Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
       />
     );
   }
   return <PageError context="loading dashboard data" error={new Error(hook.data?.error ?? 'No data')} onRetry={() => hook.refetch()} />;
 }

 const rows: DashboardWidget[][] = [];
 let currentRow: DashboardWidget[] = [];
 let currentSpan = 0;
 for (const w of hook.widgets) {
   if (!w.enabled && !hook.editMode) continue;
   const span = sizeToSpan(w.size);
   if (currentSpan + span > 12 && currentRow.length > 0) {
     rows.push(currentRow);
     currentRow = [];
     currentSpan = 0;
   }
   currentRow.push(w);
   currentSpan += span;
   if (currentSpan >= 12) {
     rows.push(currentRow);
     currentRow = [];
     currentSpan = 0;
   }
 }
 if (currentRow.length > 0) rows.push(currentRow);

 return (
   <>
     <DashboardHeader
       dark={dark}
       dashName={hook.dashName}
       dirty={hook.dirty}
       onRename={() => { hook.setRenameValue(hook.dashName); hook.setRenameDashOpen(true); }}
     />

     <FilterBar
       dark={dark}
       months={hook.months}
       datePreset={hook.datePreset}
       onDatePreset={hook.handleDatePreset}
       podOptions={hook.podOptions}
       combinedPodSelection={hook.combinedPodSelection}
       onPodsChange={hook.splitPodSelection}
       versionOptions={hook.versionOptions}
       selectedVersions={hook.selectedVersions}
       onVersionsChange={hook.setSelectedVersions}
       typeOptions={hook.typeOptions}
       selectedTypes={hook.selectedTypes}
       onTypesChange={hook.setSelectedTypes}
       onClearFilters={() => { hook.splitPodSelection([]); hook.setSelectedVersions([]); hook.setSelectedTypes([]); }}
       isFetching={hook.isFetching}
       editMode={hook.editMode}
       onEditMode={() => hook.setEditMode(!hook.editMode)}
       dirty={hook.dirty}
       onSave={() => hook.setSaveDashOpen(true)}
       onAddWidget={() => hook.setAddWidgetOpen(true)}
       onTemplates={() => hook.setTemplatesOpen(true)}
       onMenuNewDashboard={hook.handleNewDashboard}
       onMenuLoadDashboard={() => hook.setLoadDashOpen(true)}
       onMenuClone={hook.dashId ? () => hook.cloneDashboard.mutate(hook.dashId!, { onSuccess: () => notifications.show({ title: 'Dashboard cloned', message: 'A copy of this dashboard was created.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Clone failed', message: (e as Error).message || 'Could not clone dashboard.', color: 'red' }) }) : undefined}
       onMenuExport={handleExportDashboard}
       onMenuRefresh={() => hook.refetch()}
       onMenuSync={() => hook.triggerSync.mutate(false, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
       syncRunning={hook.syncStatus?.syncing}
     />

     <DashboardTabs
       dark={dark}
       dashboards={hook.dashboards}
       activeDashId={hook.dashId}
       dirty={hook.dirty}
       onLoadDashboard={hook.loadDashConfig}
       onNewDashboard={hook.handleNewDashboard}
     />

     <WidgetGrid
       widgets={hook.widgets}
       data={hook.filteredData!}
       editMode={hook.editMode}
       rows={rows}
       onRemoveWidget={hook.removeWidget}
       onEditWidget={hook.setEditingWidget}
       onMoveWidget={hook.moveWidget}
       onUpdateWidget={hook.updateWidget}
       onDrillDown={(title, items) => { hook.setDrillDown({ title, items }); hook.setDrillDownLimit(20); }}
       podsParam={hook.podsParam}
       months={hook.months}
     />

     <Modal opened={hook.addWidgetOpen} onClose={() => hook.setAddWidgetOpen(false)}
       title={
         <Group gap="sm">
           <ThemeIcon size={28} radius="md" style={{ background: AQUA_HEX }}>
             <IconPlus size={16} color={DEEP_BLUE_HEX} />
           </ThemeIcon>
           <Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Add Widget</Text>
         </Group>
       }
       size="xl">
       <AddWidgetPanel onAdd={hook.addWidget} onDone={() => hook.setAddWidgetOpen(false)} />
     </Modal>

     <EditWidgetModal
       opened={hook.editingWidget !== null}
       widget={hook.editingWidget}
       analyticsFields={hook.analyticsFields}
       podsParam={hook.podsParam}
       onClose={() => hook.setEditingWidget(null)}
       onApply={hook.updateWidget}
     />

     <RenameDashboardModal
       opened={hook.renameDashOpen}
       renameValue={hook.renameValue}
       onClose={() => hook.setRenameDashOpen(false)}
       onRename={(newName) => {
         hook.setDashName(newName);
         hook.setRenameDashOpen(false);
         hook.setDirty(true);
       }}
       onValueChange={hook.setRenameValue}
     />

     <TemplatesModal
       opened={hook.templatesOpen}
       onClose={() => hook.setTemplatesOpen(false)}
       onLoadTemplate={hook.loadTemplate}
     />

     <SaveDashboardModal
       opened={hook.saveDashOpen}
       dashName={hook.dashName}
       dashDesc={hook.dashDesc}
       dashId={hook.dashId}
       isLoading={hook.saveDashboard.isPending}
       onClose={() => hook.setSaveDashOpen(false)}
       onSave={hook.handleSave}
       onNameChange={hook.setDashName}
       onDescChange={hook.setDashDesc}
     />

     <LoadDashboardModal
       opened={hook.loadDashOpen}
       dashboards={hook.dashboards}
       activeDashId={hook.dashId}
       onClose={() => hook.setLoadDashOpen(false)}
       onNewDashboard={hook.handleNewDashboard}
       onLoadDashboard={hook.loadDashConfig}
     />

     <DrillDownModal
       opened={!!hook.drillDown}
       title={hook.drillDown?.title ?? 'Details'}
       items={hook.drillDown?.items ?? []}
       limit={hook.drillDownLimit}
       onClose={() => hook.setDrillDown(null)}
       onShowMore={() => hook.setDrillDownLimit(prev => prev + 20)}
     />
   </>
 );
}
