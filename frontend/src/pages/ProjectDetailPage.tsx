import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 Title, Text, Stack, Group, Button, Card, Table, Modal, Select, NumberInput, TextInput, Textarea, ActionIcon, Badge, Tooltip, Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconEdit, IconCopy, IconCalendarEvent } from '@tabler/icons-react';
import NlpBreadcrumb from '../components/common/NlpBreadcrumb';
import { useProject, useProjects, useUpdateProject, useDeleteProject, useProjectPodPlannings, useUpdatePodPlannings, useCopyProject } from '../api/projects';
import { usePhaseSchedules, useUpdatePhaseSchedules, useSchedulingRules, useUpdateSchedulingRules } from '../api/scheduling';
import { usePods } from '../api/pods';
import { useEffortPatterns } from '../api/refData';
import { useReleases } from '../api/releases';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest, ProjectPodPlanningRequest, PhaseScheduleRequest, SchedulingRulesResponse } from '../types';
import { deriveTshirtSize } from '../types/project';
import { TimelineSlider, phasesFromSchedules, phasesToRequests, SchedulingRulesPanel, CapacityPanel } from '../components/scheduling';
import type { PhaseBar } from '../components/scheduling';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatProjectDate } from '../utils/formatting';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

const priorityOptions = Object.values(Priority).map(p => ({ value: p, label: p }));
const statusOptions = Object.values(ProjectStatus).map(s => ({ value: s, label: s.replace(/_/g, ' ') }));

// ── Extracted outside parent to prevent remount on every state change ────
function PodPlanForm({ plan, setPlan, releaseOptions, patternOptions }: {
 plan: ProjectPodPlanningRequest;
 setPlan: (p: ProjectPodPlanningRequest) => void;
 releaseOptions: { value: string; label: string }[];
 patternOptions: { value: string; label: string }[];
}) {
 const totalHours = (plan.devHours || 0) + (plan.qaHours || 0) + (plan.bsaHours || 0) + (plan.techLeadHours || 0);
 const withContingency = totalHours * (1 + (plan.contingencyPct || 0) / 100);
 const toNum = (v: number | string): number => {
 if (typeof v === 'number') return v;
 const parsed = parseFloat(v);
 return isNaN(parsed) ? 0 : parsed;
 };
 return (
 <Stack gap="sm">
 <Group grow>
 <NumberInput label="Dev Hours" value={plan.devHours} onChange={v => setPlan({ ...plan, devHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
 <NumberInput label="QA Hours" value={plan.qaHours} onChange={v => setPlan({ ...plan, qaHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
 </Group>
 <Group grow>
 <NumberInput label="BSA Hours" value={plan.bsaHours} onChange={v => setPlan({ ...plan, bsaHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
 <NumberInput label="Tech Lead Hours" value={plan.techLeadHours} onChange={v => setPlan({ ...plan, techLeadHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
 </Group>
 <NumberInput
 label="Contingency %"
 description="Buffer added on top of total hours"
 value={plan.contingencyPct}
 onChange={v => setPlan({ ...plan, contingencyPct: toNum(v) })}
 min={0} max={100} suffix="%" decimalScale={1} allowDecimal
 />
 {totalHours > 0 && (
 <Text size="sm" c="dimmed">
 Total: <b>{totalHours.toFixed(0)}h</b>
 {plan.contingencyPct > 0 && <> → with contingency: <b>{withContingency.toFixed(0)}h</b></>}
 {' '}· Size: <Badge variant="light" size="sm">{deriveTshirtSize(withContingency)}</Badge>
 </Text>
 )}
 <Group grow>
 <NumberInput label="Dev Resources" description="Number of developers" value={plan.devCount ?? 1} onChange={v => setPlan({ ...plan, devCount: toNum(v) || 1 })} min={1} max={20} />
 <NumberInput label="QA Resources" description="Number of QA engineers" value={plan.qaCount ?? 1} onChange={v => setPlan({ ...plan, qaCount: toNum(v) || 1 })} min={1} max={20} />
 </Group>
 <Select
 label="Target Release"
 data={releaseOptions}
 value={plan.targetReleaseId ? String(plan.targetReleaseId) : ''}
 onChange={v => setPlan({ ...plan, targetReleaseId: v ? Number(v) : null })}
 clearable
 />
 <Select
 label="Effort Pattern"
 description="Override the project default for this POD"
 data={patternOptions}
 value={plan.effortPattern ?? ''}
 onChange={v => setPlan({ ...plan, effortPattern: v || null })}
 clearable
 />
 </Stack>
 );
}

const emptyPlan = (): ProjectPodPlanningRequest => ({
 podId: 0,
 devHours: 0,
 qaHours: 0,
 bsaHours: 0,
 techLeadHours: 0,
 contingencyPct: 0,
 targetReleaseId: null,
 effortPattern: null,
 podStartMonth: null,
 durationOverride: null,
 devCount: 1,
 qaCount: 1,
});

export default function ProjectDetailPage() {
 const isDark = useDarkMode();
 const { id } = useParams<{ id: string }>();
 const projectId = Number(id);
 const navigate = useNavigate();
 const { data: project, isLoading } = useProject(projectId);
 const { data: allProjects } = useProjects();
 const { data: plannings, isLoading: planningsLoading } = useProjectPodPlannings(projectId);
 const { data: pods } = usePods();
 const { data: releases } = useReleases();
 const updateProject = useUpdateProject();
 const updatePlannings = useUpdatePodPlannings();
 const deleteProject = useDeleteProject();
 const copyProject = useCopyProject();

 // ── Phase Scheduling ──────────────────────────────────────────────────
 const { data: phaseSchedules } = usePhaseSchedules(projectId);
 const { data: schedulingRules } = useSchedulingRules(projectId);
 const updatePhaseSchedules = useUpdatePhaseSchedules();
 const updateSchedulingRules = useUpdateSchedulingRules();

 const [timelinePhases, setTimelinePhases] = useState<PhaseBar[]>([]);
 const [showTimeline, setShowTimeline] = useState(false);
 const [localRules, setLocalRules] = useState<SchedulingRulesResponse | null>(null);

 // Sync phase data from server
 useMemo(() => {
   if (phaseSchedules && phaseSchedules.length > 0) {
     const bars = phasesFromSchedules(phaseSchedules);
     if (bars.length > 0) {
       setTimelinePhases(bars);
       setShowTimeline(true);
     }
   }
 }, [phaseSchedules]);

 // Sync rules from server
 useMemo(() => {
   if (schedulingRules) {
     setLocalRules(schedulingRules);
   }
 }, [schedulingRules]);

 const handleSaveTimeline = () => {
   const phaseMap = phasesToRequests(timelinePhases);
   const requests: PhaseScheduleRequest[] = Object.entries(phaseMap).map(([id, dates]) => ({
     podPlanningId: Number(id),
     ...dates,
   }));
   updatePhaseSchedules.mutate({ projectId, data: requests }, {
     onSuccess: () => notifications.show({ title: 'Saved', message: 'Phase schedule updated', color: 'green' }),
   });
 };

 const handleSaveRules = () => {
   if (!localRules) return;
   updateSchedulingRules.mutate({ projectId, data: {
     qaLagDays: localRules.qaLagDays,
     uatGapDays: localRules.uatGapDays,
     uatDurationDays: localRules.uatDurationDays,
     e2eGapDays: localRules.e2eGapDays,
     e2eDurationDays: localRules.e2eDurationDays,
     devParallelPct: localRules.devParallelPct,
     qaParallelPct: localRules.qaParallelPct,
     uatParallelPct: localRules.uatParallelPct,
   }}, {
     onSuccess: () => notifications.show({ title: 'Saved', message: 'Scheduling rules updated', color: 'green' }),
   });
 };

 const handleApplyRules = () => {
   if (!localRules || timelinePhases.length === 0) return;
   // Auto-recalculate QA + UAT from DEV + rules
   const grouped: Record<number, PhaseBar[]> = {};
   for (const p of timelinePhases) {
     if (!grouped[p.podPlanningId]) grouped[p.podPlanningId] = [];
     grouped[p.podPlanningId].push(p);
   }

   const updated: PhaseBar[] = [];
   for (const [, bars] of Object.entries(grouped)) {
     const dev = bars.find(b => b.type === 'DEV');
     if (!dev) { updated.push(...bars); continue; }

     updated.push(dev);

     const qaStart = new Date(dev.start);
     qaStart.setDate(qaStart.getDate() + localRules.qaLagDays);
     const devDays = Math.round((dev.end.getTime() - dev.start.getTime()) / 86400000);
     const qaEnd = new Date(qaStart);
     qaEnd.setDate(qaEnd.getDate() + Math.ceil(devDays * 0.6));

     const qa = bars.find(b => b.type === 'QA');
     if (qa) {
       updated.push({ ...qa, start: qaStart, end: qaEnd });
     }

     const latestEnd = new Date(Math.max(dev.end.getTime(), qaEnd.getTime()));
     const uatStart = new Date(latestEnd);
     uatStart.setDate(uatStart.getDate() + localRules.uatGapDays);
     const uatEnd = new Date(uatStart);
     uatEnd.setDate(uatEnd.getDate() + localRules.uatDurationDays);

     const uat = bars.find(b => b.type === 'UAT');
     if (uat) {
       updated.push({ ...uat, start: uatStart, end: uatEnd });
     }
   }

   setTimelinePhases(updated);
   notifications.show({ title: 'Applied', message: 'Rules applied to timeline', color: 'cyan' });
 };

 // Auto-apply rules when sliders change (skip initial sync from server)
 const rulesInitialized = useRef(false);
 useEffect(() => {
   if (!localRules) return;
   // Skip first render (initial sync from server)
   if (!rulesInitialized.current) {
     rulesInitialized.current = true;
     return;
   }
   // Only apply if timeline is visible and has phases
   if (showTimeline && timelinePhases.length > 0) {
     // Inline the apply logic to avoid stale closure on handleApplyRules
     const grouped: Record<number, PhaseBar[]> = {};
     for (const p of timelinePhases) {
       if (!grouped[p.podPlanningId]) grouped[p.podPlanningId] = [];
       grouped[p.podPlanningId].push(p);
     }
     const updated: PhaseBar[] = [];
     for (const [, bars] of Object.entries(grouped)) {
       const dev = bars.find(b => b.type === 'DEV');
       if (!dev) { updated.push(...bars); continue; }
       updated.push(dev);
       const qaStart = new Date(dev.start);
       qaStart.setDate(qaStart.getDate() + localRules.qaLagDays);
       const devDays = Math.round((dev.end.getTime() - dev.start.getTime()) / 86400000);
       const qaEnd = new Date(qaStart);
       qaEnd.setDate(qaEnd.getDate() + Math.ceil(devDays * 0.6));
       const qa = bars.find(b => b.type === 'QA');
       if (qa) updated.push({ ...qa, start: qaStart, end: qaEnd });
       const latestEnd = new Date(Math.max(dev.end.getTime(), qaEnd.getTime()));
       const uatStart = new Date(latestEnd);
       uatStart.setDate(uatStart.getDate() + localRules.uatGapDays);
       const uatEnd = new Date(uatStart);
       uatEnd.setDate(uatEnd.getDate() + localRules.uatDurationDays);
       const uat = bars.find(b => b.type === 'UAT');
       if (uat) updated.push({ ...uat, start: uatStart, end: uatEnd });
     }
     setTimelinePhases(updated);
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [localRules?.qaLagDays, localRules?.uatGapDays, localRules?.uatDurationDays, localRules?.e2eGapDays, localRules?.e2eDurationDays]);

 const { data: effortPatterns } = useEffortPatterns();
 const patternOptions = [
 { value: '', label: '— use project default —' },
 ...(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name })),
 ];
 const releaseOptions = [
 { value: '', label: '— no target release —' },
 ...(releases ?? []).map(r => ({
 value: String(r.id),
 label: `${r.name}${r.type === 'SPECIAL' ? ' ⭐' : ''}`,
 })),
 ];
 const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));
 const { monthLabels } = useMonthLabels();

 // Real-time duplicate name check (excluding current project)
 const existingNames = useMemo(() => {
   return new Set((allProjects ?? []).filter(p => p.id !== projectId).map(p => p.name.toLowerCase()));
 }, [allProjects, projectId]);

 const checkDuplicateName = useCallback((name: string) => {
   if (!name.trim()) return '';
   if (existingNames.has(name.trim().toLowerCase())) {
     return 'A project with this name already exists';
   }
   return '';
 }, [existingNames]);

 const [editModal, setEditModal] = useState(false);
 const [editForm, setEditForm] = useState<ProjectRequest>({
 name: '', priority: Priority.P2, owner: '', startMonth: 1, durationMonths: 3,
 defaultPattern: 'Flat', status: ProjectStatus.ACTIVE, notes: null,
 startDate: null, targetDate: null, client: null,
 });
 const [nameError, setNameError] = useState<string>('');

 const [addModal, setAddModal] = useState(false);
 const [editPlanModal, setEditPlanModal] = useState(false);
 const [newPlan, setNewPlan] = useState<ProjectPodPlanningRequest>(emptyPlan());
 const [editingPodId, setEditingPodId] = useState<number | null>(null);

 const planningToRequest = (p: { podId: number; devHours: number; qaHours: number; bsaHours: number; techLeadHours: number; contingencyPct: number; targetReleaseId: number | null; effortPattern: string | null; podStartMonth: number | null; durationOverride: number | null; devCount?: number; qaCount?: number; }): ProjectPodPlanningRequest => ({
 podId: p.podId,
 devHours: p.devHours,
 qaHours: p.qaHours,
 bsaHours: p.bsaHours,
 techLeadHours: p.techLeadHours,
 contingencyPct: p.contingencyPct,
 targetReleaseId: p.targetReleaseId,
 effortPattern: p.effortPattern,
 podStartMonth: p.podStartMonth,
 durationOverride: p.durationOverride,
 devCount: p.devCount ?? 1,
 qaCount: p.qaCount ?? 1,
 });

 const handleAddPod = () => {
 if (!newPlan.podId) return;
 const existing = (plannings ?? []).map(planningToRequest);
 updatePlannings.mutate({ projectId, data: [...existing, newPlan] }, {
 onSuccess: () => {
 setAddModal(false);
 setNewPlan(emptyPlan());
 notifications.show({ title: 'Added', message: 'POD assignment added', color: 'green' });
 },
 });
 };

 const openEditPlan = (podId: number) => {
 const p = (plannings ?? []).find(x => x.podId === podId);
 if (!p) return;
 setNewPlan(planningToRequest(p));
 setEditingPodId(podId);
 setEditPlanModal(true);
 };

 const handleEditPlan = () => {
 const others = (plannings ?? []).filter(p => p.podId !== editingPodId).map(planningToRequest);
 updatePlannings.mutate({ projectId, data: [...others, newPlan] }, {
 onSuccess: () => {
 setEditPlanModal(false);
 setNewPlan(emptyPlan());
 notifications.show({ title: 'Updated', message: 'POD assignment updated', color: 'green' });
 },
 });
 };

 const handleRemovePod = (podId: number) => {
 const remaining = (plannings ?? []).filter(p => p.podId !== podId).map(planningToRequest);
 updatePlannings.mutate({ projectId, data: remaining }, {
 onSuccess: () => notifications.show({ title: 'Removed', message: 'POD removed', color: 'orange' }),
 });
 };

 const openEditProject = () => {
 if (!project) return;
 setEditForm({
 name: project.name,
 priority: project.priority,
 owner: project.owner,
 startMonth: project.startMonth ?? 1,
 durationMonths: project.durationMonths,
 defaultPattern: project.defaultPattern,
 status: project.status,
 notes: project.notes,
 startDate: project.startDate ?? null,
 targetDate: project.targetDate ?? null,
 client: project.client ?? null,
 });
 setEditModal(true);
 };

 const handleEditProject = () => {
 const dupError = checkDuplicateName(editForm.name);
 if (dupError) { setNameError(dupError); return; }
 setNameError('');
 updateProject.mutate({ id: projectId, data: editForm }, {
 onSuccess: () => {
 setEditModal(false);
 setNameError('');
 notifications.show({ title: 'Updated', message: 'Project updated', color: 'green' });
 },
 onError: (error: any) => {
 if (error.response?.status === 409) {
 setNameError('A project with this name already exists');
 } else {
 notifications.show({ title: 'Error', message: error.message || 'Failed to update project', color: 'red' });
 }
 },
 });
 };

 const handleDeleteProject = () => {
 deleteProject.mutate(projectId, { onSuccess: () => navigate('/projects') });
 };

 const handleCopyProject = () => {
 copyProject.mutate(projectId, {
 onSuccess: (newProject) => {
 notifications.show({ title: 'Duplicated', message: 'Project duplicated successfully', color: 'green' });
 navigate(`/projects/${newProject.id}`);
 },
 });
 };

 // Total hours across all pods → derived T-shirt size
 const totalAllPodHours = (plannings ?? []).reduce((sum, p) => sum + p.totalHoursWithContingency, 0);

 if (isLoading || planningsLoading) return <LoadingSpinner variant="cards" message="Loading project details..." />;
 if (!project) return <Text c="red">Project not found</Text>;

 // PodPlanForm is now defined outside the component to prevent focus loss

 return (
 <Stack className="page-enter stagger-children">
 <NlpBreadcrumb />
 <Group className="detail-header">
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>{project.name}</Title>
 <PriorityBadge priority={project.priority} />
 <StatusBadge status={project.status} />
 {totalAllPodHours > 0 && (
 <Tooltip label={`${totalAllPodHours.toFixed(0)}h total across all pods (incl. contingency)`}>
 <Badge variant="outline" color="gray">{deriveTshirtSize(totalAllPodHours)}</Badge>
 </Tooltip>
 )}
 <Button variant="light" size="xs" leftSection={<IconEdit size={14} />} onClick={openEditProject}>Edit</Button>
 <Button variant="light" size="xs" leftSection={<IconCopy size={14} />} onClick={handleCopyProject} loading={copyProject.isPending}>Duplicate</Button>
 </Group>

 <Card withBorder padding="md">
 <Group grow>
 <div>
 <Text size="sm" c="dimmed">Owner</Text>
 <Text fw={500}>{project.owner}</Text>
 </div>
 <div>
 <Text size="sm" c="dimmed">Duration</Text>
 <Text fw={500}>
 {project.durationMonths} months ({formatProjectDate(project.startDate, project.startMonth, monthLabels)} — {formatProjectDate(project.targetDate, project.targetEndMonth, monthLabels)})
 </Text>
 </div>
 <div>
 <Text size="sm" c="dimmed">Pattern</Text>
 <Text fw={500}>{project.defaultPattern}</Text>
 </div>
 </Group>
 {project.client && (
 <Text mt="xs" size="sm"><Text span c="dimmed">Client: </Text>{project.client}</Text>
 )}
 {project.notes && (
 <Text mt="sm" size="sm" c="dimmed">{project.notes}</Text>
 )}
 </Card>

 <Group justify="space-between">
 <Title order={3}>POD Assignments</Title>
 <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => { setNewPlan(emptyPlan()); setAddModal(true); }}>
 Add POD
 </Button>
 </Group>

 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>POD</Table.Th>
 <Table.Th>Dev h</Table.Th>
 <Table.Th>QA h</Table.Th>
 <Table.Th>BSA h</Table.Th>
 <Table.Th>TL h</Table.Th>
 <Table.Th>Contingency %</Table.Th>
 <Table.Th>Total (w/ contingency)</Table.Th>
 <Table.Th>Size</Table.Th>
 <Table.Th>Devs</Table.Th>
 <Table.Th>QAs</Table.Th>
 <Table.Th>Target Release</Table.Th>
 <Table.Th>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(plannings ?? []).map(p => (
 <Table.Tr key={p.id}>
 <Table.Td fw={500}>{p.podName}</Table.Td>
 <Table.Td>{p.devHours}</Table.Td>
 <Table.Td>{p.qaHours}</Table.Td>
 <Table.Td>{p.bsaHours}</Table.Td>
 <Table.Td>{p.techLeadHours}</Table.Td>
 <Table.Td>{p.contingencyPct > 0 ? `${p.contingencyPct}%` : '-'}</Table.Td>
 <Table.Td fw={500}>{p.totalHoursWithContingency}h</Table.Td>
 <Table.Td><Badge variant="light">{deriveTshirtSize(p.totalHoursWithContingency)}</Badge></Table.Td>
 <Table.Td>{p.devCount || 1}</Table.Td>
 <Table.Td>{p.qaCount || 1}</Table.Td>
 <Table.Td>{p.targetReleaseName ?? '-'}</Table.Td>
 <Table.Td>
 <Group gap="xs">
 <ActionIcon variant="subtle" onClick={() => openEditPlan(p.podId)}>
 <IconEdit size={14} />
 </ActionIcon>
 <ActionIcon color="red" variant="subtle" onClick={() => handleRemovePod(p.podId)}>
 <IconTrash size={16} />
 </ActionIcon>
 </Group>
 </Table.Td>
 </Table.Tr>
 ))}
 {(plannings ?? []).length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={12}>
 <Text ta="center" c="dimmed" py="md">No PODs assigned yet</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>

 {/* ── Phase Timeline ──────────────────────────────────────────────── */}
 <Divider my="sm" />
 <Group justify="space-between">
   <Group gap="xs">
     <IconCalendarEvent size={20} style={{ color: AQUA }} />
     <Title order={3}>Phase Timeline</Title>
   </Group>
   <Group gap="xs">
     {!showTimeline && (plannings ?? []).length > 0 && (
       <Button
         variant="light"
         size="xs"
         leftSection={<IconCalendarEvent size={14} />}
         onClick={() => {
           // Initialize timeline from plannings with capacity-aware durations
           const today = new Date();
           const HPD = 6; // hours per day
           const bars: PhaseBar[] = [];
           const devPPct = (localRules?.devParallelPct ?? 70) / 100;
           const qaPPct = (localRules?.qaParallelPct ?? 50) / 100;
           for (const p of (plannings ?? [])) {
             const devN = p.devCount || 1;
             const devStart = p.devStartDate ? new Date(p.devStartDate + 'T00:00:00') : new Date(today);
             // Capacity-aware: seqDays + parallelDays
             const devSeqDays = (p.devHours * (1 - devPPct)) / HPD;
             const devParDays = (p.devHours * devPPct) / (devN * HPD);
             const devDays = Math.max(3, Math.ceil(devSeqDays + devParDays));
             const devEnd = p.devEndDate ? new Date(p.devEndDate + 'T00:00:00') : new Date(devStart.getTime() + devDays * 86400000);
             bars.push({ podPlanningId: p.id, podId: p.podId, podName: p.podName, type: 'DEV', start: devStart, end: devEnd, locked: false });

             if (p.qaHours > 0) {
               const qaN = p.qaCount || 1;
               const qaLag = localRules?.qaLagDays ?? 7;
               const qaStart = p.qaStartDate ? new Date(p.qaStartDate + 'T00:00:00') : new Date(devStart.getTime() + qaLag * 86400000);
               const qaSeqDays = (p.qaHours * (1 - qaPPct)) / HPD;
               const qaParDays = (p.qaHours * qaPPct) / (qaN * HPD);
               const qaDays = Math.max(2, Math.ceil(qaSeqDays + qaParDays));
               const qaEnd = p.qaEndDate ? new Date(p.qaEndDate + 'T00:00:00') : new Date(qaStart.getTime() + qaDays * 86400000);
               bars.push({ podPlanningId: p.id, podId: p.podId, podName: p.podName, type: 'QA', start: qaStart, end: qaEnd, locked: false });
             }

             const uatGap = localRules?.uatGapDays ?? 1;
             const uatDur = localRules?.uatDurationDays ?? 5;
             const latestEnd = bars.filter(b => b.podPlanningId === p.id && (b.type === 'DEV' || b.type === 'QA')).reduce((max, b) => Math.max(max, b.end.getTime()), 0);
             const uatStart = p.uatStartDate ? new Date(p.uatStartDate + 'T00:00:00') : new Date(latestEnd + uatGap * 86400000);
             const uatEnd = p.uatEndDate ? new Date(p.uatEndDate + 'T00:00:00') : new Date(uatStart.getTime() + uatDur * 86400000);
             bars.push({ podPlanningId: p.id, podId: p.podId, podName: p.podName, type: 'UAT', start: uatStart, end: uatEnd, locked: false });
           }
           setTimelinePhases(bars);
           setShowTimeline(true);
         }}
       >
         Initialize Timeline
       </Button>
     )}
     {showTimeline && (
       <Button size="xs" onClick={handleSaveTimeline} loading={updatePhaseSchedules.isPending}>
         Save Timeline
       </Button>
     )}
   </Group>
 </Group>

 {showTimeline && timelinePhases.length > 0 && (
   <Stack gap="md">
     <TimelineSlider
       phases={timelinePhases}
       onPhasesChange={setTimelinePhases}
       rules={localRules}
       projectStartDate={project.startDate ? new Date(project.startDate + 'T00:00:00') : undefined}
       projectEndDate={project.targetDate ? new Date(project.targetDate + 'T00:00:00') : undefined}
     />

     {localRules && (
       <SchedulingRulesPanel
         rules={localRules}
         onChange={(partial) => setLocalRules(prev => prev ? { ...prev, ...partial } : prev)}
         onApply={handleApplyRules}
         saving={updateSchedulingRules.isPending}
       />
     )}

     {localRules && (plannings ?? []).length > 0 && (
       <CapacityPanel
         plannings={plannings ?? []}
         rules={localRules}
         projectStartDate={project.startDate}
         projectTargetDate={project.targetDate}
       />
     )}

     <Group gap="sm" mt={4}>
       <Button size="xs" variant="light" onClick={handleSaveRules} loading={updateSchedulingRules.isPending} disabled={!localRules}>
         Save Rules
       </Button>
       <Button size="xs" variant="subtle" color="gray" onClick={() => setShowTimeline(false)}>
         Hide Timeline
       </Button>
     </Group>
   </Stack>
 )}

 {!showTimeline && (plannings ?? []).length === 0 && (
   <Text size="sm" c="dimmed" ta="center" py="md">Add PODs to enable phase scheduling timeline</Text>
 )}

 <Divider my="sm" />
 <Group>
 <Button color="red" variant="outline" onClick={handleDeleteProject}>Delete Project</Button>
 </Group>

 {/* Edit Project Modal */}
 <Modal opened={editModal} onClose={() => { setEditModal(false); setNameError(''); }} title="Edit Project" size="xl">
 <Stack>
 <TextInput
 label="Name"
 value={editForm.name}
 onChange={e => {
 const val = e.target.value;
 setEditForm({ ...editForm, name: val });
 setNameError(checkDuplicateName(val));
 }}
 error={nameError}
 required
 />
 <Group grow>
 <Select label="Priority" data={priorityOptions} value={editForm.priority} onChange={v => setEditForm({ ...editForm, priority: v as Priority })} required />
 <Select label="Status" data={statusOptions} value={editForm.status} onChange={v => setEditForm({ ...editForm, status: v as ProjectStatus })} required />
 </Group>
 <TextInput label="Owner" value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} />
 <TextInput label="Client" placeholder="Optional — external client name" value={editForm.client ?? ''} onChange={e => setEditForm({ ...editForm, client: e.target.value || null })} />
 <Group grow>
 <DateInput label="Start Date" value={editForm.startDate ? new Date(editForm.startDate + 'T00:00:00') : null} onChange={d => setEditForm({ ...editForm, startDate: d ? d.toISOString().slice(0, 10) : null })} clearable valueFormat="MMM DD, YYYY" />
 <DateInput label="Launch Date" value={editForm.targetDate ? new Date(editForm.targetDate + 'T00:00:00') : null} onChange={d => setEditForm({ ...editForm, targetDate: d ? d.toISOString().slice(0, 10) : null })} clearable valueFormat="MMM DD, YYYY" />
 </Group>
 <Select label="Default Pattern" data={(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name }))} value={editForm.defaultPattern} onChange={v => setEditForm({ ...editForm, defaultPattern: v ?? 'Flat' })} />
 <Textarea label="Notes" value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value || null })} />
 <Button onClick={handleEditProject} loading={updateProject.isPending}>Save Changes</Button>
 </Stack>
 </Modal>

 {/* Add POD Modal */}
 <Modal opened={addModal} onClose={() => setAddModal(false)} title="Add POD Assignment" size="md">
 <Stack>
 <Select label="POD" data={podOptions} value={newPlan.podId ? String(newPlan.podId) : null} onChange={v => setNewPlan({ ...newPlan, podId: Number(v) })} required />
 <PodPlanForm plan={newPlan} setPlan={setNewPlan} releaseOptions={releaseOptions} patternOptions={patternOptions} />
 <Button onClick={handleAddPod} loading={updatePlannings.isPending} disabled={!newPlan.podId}>Add</Button>
 </Stack>
 </Modal>

 {/* Edit POD Modal */}
 <Modal opened={editPlanModal} onClose={() => setEditPlanModal(false)} title="Edit POD Assignment" size="md">
 <Stack>
 <Select
 label="POD"
 data={podOptions}
 value={newPlan.podId ? String(newPlan.podId) : null}
 onChange={v => setNewPlan({ ...newPlan, podId: Number(v) })}
 required
 />
 <PodPlanForm plan={newPlan} setPlan={setNewPlan} releaseOptions={releaseOptions} patternOptions={patternOptions} />
 <Button onClick={handleEditPlan} loading={updatePlannings.isPending}>Save</Button>
 </Stack>
 </Modal>
 </Stack>
 );
}
