import { useState, useMemo } from 'react';
import {
 Title,
 Text,
 Stack,
 SimpleGrid,
 Card,
 Group,
 Badge,
 Button,
 Table,
 Skeleton,
 Center,
 ThemeIcon,
 ActionIcon,
 Modal,
 Select,
 Autocomplete,
 NumberInput,
 TextInput,
 Tooltip,
 Progress,
 ScrollArea,
 Avatar
} from '@mantine/core';
import {
 IconBrain,
 IconStars,
 IconTrash,
 IconPlus,
 IconSearch,
 IconDownload
} from '@tabler/icons-react';
import { downloadCsv } from '../../utils/csv';
import { exportToPdf } from '../../utils/pdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { useResources } from '../../api/resources';
import { DEEP_BLUE } from '../../brandTokens';

interface SkillEntry {
 id: number;
 resourceId: number;
 skillName: string;
 proficiency: number;
 proficiencyLabel: string;
 yearsExperience: number | null;
}

interface MatrixRow {
 resourceId: number;
 resourceName: string;
 role: string | null;
 podName: string | null;
 skills: SkillEntry[];
}

interface SkillSummary {
 skillName: string;
 resourceCount: number;
 avgProficiency: number;
}

const PROFICIENCY_COLORS: Record<number, string> = {
 1: 'gray',
 2: 'blue',
 3: 'teal',
 4: 'violet'
};

const PROF_OPTIONS = [
 { value: '1', label: '1 — Beginner' },
 { value: '2', label: '2 — Intermediate' },
 { value: '3', label: '3 — Advanced' },
 { value: '4', label: '4 — Expert' },
];

function ProficiencyDots({ level }: { level: number }) {
 return (
 <Group gap={3}>
 {[1, 2, 3, 4].map(i => (
 <div key={i} style={{
 width: 8, height: 8, borderRadius: '50%',
 background: i <= level
 ? `var(--mantine-color-${PROFICIENCY_COLORS[level]}-6)`
 : 'var(--mantine-color-gray-3)'}} />
 ))}
 </Group>
 );
}

export default function ResourceSkillsMatrixPage() {
 const qc = useQueryClient();
 const [search, setSearch] = useState('');
 const [addModal, setAddModal] = useState<{ resourceId: number; name: string } | null>(null);
 const [newSkill, setNewSkill] = useState('');
 const [newProf, setNewProf] = useState<string>('2');
 const [newYears, setNewYears] = useState<number | ''>('');

 const { data: matrix = [], isLoading: loadingMatrix } = useQuery<MatrixRow[]>({
 queryKey: ['skills-matrix'],
 queryFn: () => apiClient.get('/resources/skills/matrix').then(r => r.data)
 });

 // Build a map of resourceId → avatarUrl for Jira avatar display
 const { data: allResources = [] } = useResources();
 const avatarMap = useMemo(() => {
 const m = new Map<number, { avatarUrl?: string | null; jiraAccountId?: string | null }>();
 for (const r of allResources) {
 m.set(r.id, { avatarUrl: r.avatarUrl, jiraAccountId: r.jiraAccountId });
 }
 return m;
 }, [allResources]);

 const { data: summary = [] } = useQuery<SkillSummary[]>({
 queryKey: ['skills-summary'],
 queryFn: () => apiClient.get('/resources/skills/summary').then(r => r.data)
 });

 const addMutation = useMutation({
 mutationFn: ({ resourceId, skillName, proficiency, yearsExperience }: {
 resourceId: number; skillName: string; proficiency: number; yearsExperience?: number;
 }) => apiClient.post(`/resources/${resourceId}/skills`, { skillName, proficiency, yearsExperience }),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['skills-matrix'] });
 qc.invalidateQueries({ queryKey: ['skills-summary'] });
 notifications.show({ color: 'green', message: 'Skill added' });
 setAddModal(null);
 setNewSkill(''); setNewProf('2'); setNewYears('');
 },
 onError: () => notifications.show({ color: 'red', message: 'Failed to add skill' })
 });

 const removeMutation = useMutation({
 mutationFn: ({ resourceId, skillName }: { resourceId: number; skillName: string }) =>
 apiClient.delete(`/resources/${resourceId}/skills/${encodeURIComponent(skillName)}`),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['skills-matrix'] });
 qc.invalidateQueries({ queryKey: ['skills-summary'] });
 },
 onError: () => notifications.show({ color: 'red', message: 'Failed to remove skill' })
 });

 const allSkillNames = useMemo(() =>
 [...new Set(matrix.flatMap(r => r.skills.map(s => s.skillName)))].sort(),
 [matrix]
 );

 const filtered = useMemo(() =>
 matrix.filter(r =>
 !search || r.resourceName.toLowerCase().includes(search.toLowerCase()) ||
 r.skills.some(s => s.skillName.toLowerCase().includes(search.toLowerCase()))
 ), [matrix, search]
 );

 if (loadingMatrix) return <Stack gap="xs" p="md">{[...Array(8)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>;

 return (
 <Stack gap="lg" p="md">
 {/* Header */}
 <Group justify="space-between" align="flex-start">
 <div>
 <Title order={2} style={{ color: DEEP_BLUE, fontWeight: 600 }}>
 Resource Skills Matrix
 </Title>
 <Text c="dimmed" mt={4} style={{ }}>
 Skill tags and proficiency levels across the team. Click + to add skills to a resource.
 </Text>
 </div>
 <Group gap="sm">
 <Button
 variant="light"
 color="red"
 leftSection={<IconDownload size={14} />}
 size="sm"
 onClick={() => exportToPdf('Resource Skills Matrix')}
 >
 Export PDF
 </Button>
 <Button
 variant="default"
 leftSection={<IconDownload size={14} />}
 size="sm"
 onClick={() => {
 // Flatten matrix: one row per resource × skill
 const rows = matrix.flatMap(r =>
 r.skills.length > 0
 ? r.skills.map(s => ({
 resource: r.resourceName,
 role: r.role ?? '',
 pod: r.podName ?? '',
 skill: s.skillName,
 proficiency: s.proficiency,
 profLabel: s.proficiencyLabel,
 years: s.yearsExperience ?? ''
 }))
 : [{ resource: r.resourceName, role: r.role ?? '', pod: r.podName ?? '', skill: '', proficiency: 0, profLabel: '', years: '' }]
 );
 downloadCsv('skills-matrix', rows, [
 { key: 'resource', header: 'Resource' },
 { key: 'role', header: 'Role' },
 { key: 'pod', header: 'POD' },
 { key: 'skill', header: 'Skill' },
 { key: 'proficiency', header: 'Proficiency (1-4)' },
 { key: 'profLabel', header: 'Level' },
 { key: 'years', header: 'Years Experience' },
 ]);
 }}
 >
 Export CSV
 </Button>
 <TextInput
 placeholder="Search people or skills…"
 leftSection={<IconSearch size={14} />}
 value={search}
 onChange={e => setSearch(e.currentTarget.value)}
 w={220}
 size="sm"
 />
 </Group>
 </Group>

 {/* Skill coverage summary */}
 {summary.length > 0 && (
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
 {summary.slice(0, 8).map(s => (
 <Card key={s.skillName} withBorder radius="md" p="sm">
 <Group justify="space-between" mb={4}>
 <Text size="xs" fw={600} truncate style={{ maxWidth: 120 }}>{s.skillName}</Text>
 <Badge size="xs" color="blue" variant="light">{s.resourceCount} people</Badge>
 </Group>
 <Progress
 value={(s.avgProficiency / 4) * 100}
 color={PROFICIENCY_COLORS[Math.round(s.avgProficiency)] ?? 'blue'}
 size={4}
 radius="xl"
 />
 <Text size="9px" c="dimmed" mt={2}>Avg proficiency: {s.avgProficiency.toFixed(1)}/4</Text>
 </Card>
 ))}
 </SimpleGrid>
 )}

 {/* Matrix table */}
 {filtered.length === 0 ? (
 <Center py={80}>
 <Stack align="center" gap="sm">
 <ThemeIcon size={64} radius="md" variant="light" color="blue">
 <IconBrain size={32} stroke={1.5} />
 </ThemeIcon>
 <Text fw={600} c="dimmed">No skills tagged yet</Text>
 <Text size="sm" c="dimmed">Click the + button on any resource row to start adding skills.</Text>
 </Stack>
 </Center>
 ) : (
 <ScrollArea>
 <Table highlightOnHover withTableBorder withColumnBorders fz="sm" style={{ minWidth: 700 }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 200 }}>Resource</Table.Th>
 <Table.Th style={{ minWidth: 110 }}>Role</Table.Th>
 <Table.Th>Skills</Table.Th>
 <Table.Th style={{ width: 44 }} />
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.map(r => {
 const resInfo = avatarMap.get(r.resourceId);
 const hasJira = !!resInfo?.jiraAccountId;
 return (
 <Table.Tr key={r.resourceId}>
 <Table.Td>
 <Group gap="xs" wrap="nowrap">
 <Tooltip
 label={hasJira ? 'Jira connected' : 'No Jira link'}
 withArrow
 position="top"
 disabled={!hasJira && !resInfo?.avatarUrl}
 >
 <Avatar
 src={resInfo?.avatarUrl ?? null}
 size={28}
 radius="xl"
 color={hasJira ? 'teal' : 'gray'}
 >
 {r.resourceName.charAt(0).toUpperCase()}
 </Avatar>
 </Tooltip>
 <Text size="sm" fw={600}>{r.resourceName}</Text>
 </Group>
 </Table.Td>
 <Table.Td>
 {r.role && (
 <Badge size="xs" variant="outline" color="gray">
 {r.role.replace('_', ' ')}
 </Badge>
 )}
 </Table.Td>
 <Table.Td>
 <Group gap={4} wrap="wrap">
 {r.skills.length === 0 && (
 <Text size="xs" c="dimmed" fs="italic">No skills tagged</Text>
 )}
 {r.skills.map(s => (
 <Tooltip
 key={s.skillName}
 label={`${s.proficiencyLabel}${s.yearsExperience != null ? ` · ${s.yearsExperience}y experience` : ''}`}
 >
 <Badge
 color={PROFICIENCY_COLORS[s.proficiency] ?? 'gray'}
 variant="light"
 size="sm"
 rightSection={
 <ActionIcon
 size={10}
 variant="transparent"
 color="gray"
 onClick={() => removeMutation.mutate({
 resourceId: r.resourceId, skillName: s.skillName
 })}
 aria-label="Delete"
>
 <IconTrash size={9} />
 </ActionIcon>
 }
 >
 <Group gap={4}>
 {s.skillName}
 <ProficiencyDots level={s.proficiency} />
 </Group>
 </Badge>
 </Tooltip>
 ))}
 </Group>
 </Table.Td>
 <Table.Td>
 <Tooltip label="Add skill">
 <ActionIcon
 size="sm"
 variant="light"
 color="blue"
 onClick={() => setAddModal({ resourceId: r.resourceId, name: r.resourceName })}
 aria-label="Add"
>
 <IconPlus size={12} />
 </ActionIcon>
 </Tooltip>
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 )}

 {/* Add skill modal */}
 <Modal
 opened={!!addModal}
 onClose={() => { setAddModal(null); setNewSkill(''); setNewProf('2'); setNewYears(''); }}
 title={
 <Group gap="sm">
 <ThemeIcon color="blue" variant="light" size={28} radius="sm">
 <IconStars size={14} />
 </ThemeIcon>
 <Text fw={600}>Add Skill — {addModal?.name}</Text>
 </Group>
 }
 size="sm"
 >
 <Stack gap="sm">
 <Autocomplete
 label="Skill"
 placeholder="Select existing or type new…"
 data={allSkillNames}
 value={newSkill}
 onChange={v => setNewSkill(v)}
 />
 <Select
 label="Proficiency"
 data={PROF_OPTIONS}
 value={newProf}
 onChange={v => setNewProf(v ?? '2')}
 />
 <NumberInput
 label="Years of experience (optional)"
 min={0}
 max={40}
 step={0.5}
 value={newYears}
 onChange={v => setNewYears(v as number)}
 decimalScale={1}
 />
 <Group justify="flex-end" mt="sm">
 <Button variant="light" onClick={() => setAddModal(null)}>Cancel</Button>
 <Button
 disabled={!newSkill}
 loading={addMutation.isPending}
 onClick={() => addModal && addMutation.mutate({
 resourceId: addModal.resourceId,
 skillName: newSkill,
 proficiency: Number(newProf),
 yearsExperience: newYears !== '' ? Number(newYears) : undefined
 })}
 >
 Add Skill
 </Button>
 </Group>
 </Stack>
 </Modal>
 </Stack>
 );
}
