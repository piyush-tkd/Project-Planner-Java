import { useState, useEffect, useCallback } from 'react';
import {
 Title, Text, Stack, Group, Card, ActionIcon, Button, Badge,
 Tooltip, Divider, Alert, Paper,
} from '@mantine/core';
import {
 IconGripVertical, IconArrowUp, IconArrowDown, IconRefresh,
 IconDeviceFloppy, IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA, DEEP_BLUE } from '../../brandTokens';

/* ── Types ────────────────────────────────────────────────────────────── */

interface SidebarPrefs {
 groupOrder: string[];
 itemOrder: Record<string, string[]>;
}

const EMPTY_PREFS: SidebarPrefs = { groupOrder: [], itemOrder: {} };

/* ── Default nav structure — must stay in sync with AppShell.tsx navGroups ── */

const DEFAULT_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'Workspace',
    items: ['Dashboard', 'Inbox', 'Ask AI', 'AI Content Studio', 'Smart Insights'],
  },
  {
    label: 'Portfolio',
    items: [
      'Projects', 'Portfolio Health', 'Executive Summary', 'Timeline',
      'Risk & Issues', 'Risk Heatmap', 'Dependencies', 'Objectives',
    ],
  },
  {
    label: 'People',
    items: [
      'People', 'Capacity', 'Performance',
      'Skills Matrix', 'Team Pulse', 'Workforce Planning', 'Leave Hub',
    ],
  },
  {
    label: 'Delivery',
    items: [
      'PODs', 'Sprint Planner', 'Sprint Quality', 'Engineering Hub', 'Engineering Analytics', 'Power Dashboard', 'Calendar', 'Ideas Board',
      // Jira subsection
      'Jira → Sprint Backlog', 'Jira → Sprint Retro', 'Jira → POD Dashboard',
      'Jira → Dashboard Builder', 'Jira → Releases', 'Jira → Resource Mapping',
      'Jira → Release Mapping', 'Jira → Support Boards',
    ],
  },
  {
    label: 'Finance',
    items: ['Budget & CapEx', 'Engineering Economics', 'ROI Calculator', 'Scenario Planning'],
  },
  {
    label: 'Admin',
    items: [
      'Users', 'Quality Config', 'Automation Engine', 'Jira Credentials',
      'Organisation', 'AI & Intelligence', 'Developer Tools',
    ],
  },
];

/* ── API hooks ────────────────────────────────────────────────────────── */

function useSidebarPrefs() {
 const qc = useQueryClient();

 const { data = EMPTY_PREFS, isLoading } = useQuery<SidebarPrefs>({
 queryKey: ['widget-prefs', 'sidebar_order'],
 queryFn: () =>
 apiClient.get('/widget-preferences/sidebar_order').then(r => ({
 groupOrder: Array.isArray(r.data?.groupOrder) ? r.data.groupOrder : [],
 itemOrder: r.data?.itemOrder && typeof r.data.itemOrder === 'object' ? r.data.itemOrder : {},
 })),
 staleTime: Infinity,
 refetchOnWindowFocus: false,
 });

 const mutation = useMutation({
 mutationFn: (prefs: SidebarPrefs) =>
 apiClient.put('/widget-preferences/sidebar_order', prefs),
 onMutate: async (prefs) => {
 await qc.cancelQueries({ queryKey: ['widget-prefs', 'sidebar_order'] });
 qc.setQueryData(['widget-prefs', 'sidebar_order'], prefs);
 },
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['widget-prefs', 'sidebar_order'] });
 },
 });

 return { prefs: data, isLoading, save: mutation.mutate, saving: mutation.isPending };
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function moveItem<T>(arr: T[], from: number, to: number): T[] {
 const result = [...arr];
 const [item] = result.splice(from, 1);
 result.splice(to, 0, item);
 return result;
}

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function SidebarOrderPage() {
 const { prefs, isLoading, save, saving } = useSidebarPrefs();
 const dark = useDarkMode();
 const headingColor = dark ? AQUA : DEEP_BLUE;

 // Local state for editing
 const [groups, setGroups] = useState<{ label: string; items: string[] }[]>([]);
 const [dirty, setDirty] = useState(false);
 const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

 // Initialize from saved prefs or defaults
 useEffect(() => {
 if (isLoading) return;

 // Start with defaults
 let orderedGroups = [...DEFAULT_GROUPS.map(g => ({ ...g, items: [...g.items] }))];

 // Apply saved group order
 if (prefs.groupOrder.length > 0) {
 const groupMap = new Map(orderedGroups.map(g => [g.label, g]));
 const ordered: typeof orderedGroups = [];
 for (const label of prefs.groupOrder) {
 const g = groupMap.get(label);
 if (g) {
 ordered.push(g);
 groupMap.delete(label);
 }
 }
 // Append any new groups not in saved order
 for (const g of groupMap.values()) ordered.push(g);
 orderedGroups = ordered;
 }

 // Apply saved item order within groups
 for (const group of orderedGroups) {
 const savedItems = prefs.itemOrder[group.label];
 if (savedItems && savedItems.length > 0) {
 const itemSet = new Set(group.items);
 const ordered: string[] = [];
 for (const item of savedItems) {
 if (itemSet.has(item)) {
 ordered.push(item);
 itemSet.delete(item);
 }
 }
 // Append any new items not in saved order
 for (const item of itemSet) ordered.push(item);
 group.items = ordered;
 }
 }

 setGroups(orderedGroups);
 }, [prefs, isLoading]);

 const handleMoveGroup = useCallback((index: number, direction: -1 | 1) => {
 const to = index + direction;
 if (to < 0 || to >= groups.length) return;
 setGroups(moveItem(groups, index, to));
 setDirty(true);
 }, [groups]);

 const handleMoveItem = useCallback((groupLabel: string, itemIndex: number, direction: -1 | 1) => {
 setGroups(prev => prev.map(g => {
 if (g.label !== groupLabel) return g;
 const to = itemIndex + direction;
 if (to < 0 || to >= g.items.length) return g;
 return { ...g, items: moveItem(g.items, itemIndex, to) };
 }));
 setDirty(true);
 }, []);

 const handleSave = useCallback(() => {
 const groupOrder = groups.map(g => g.label);
 const itemOrder: Record<string, string[]> = {};
 for (const g of groups) {
 itemOrder[g.label] = g.items;
 }
 save({ groupOrder, itemOrder });
 setDirty(false);
 notifications.show({
 title: 'Sidebar order saved',
 message: 'Refresh the page or navigate to see your new sidebar order.',
 color: 'green',
 });
 }, [groups, save]);

 const handleReset = useCallback(() => {
 setGroups(DEFAULT_GROUPS.map(g => ({ ...g, items: [...g.items] })));
 setDirty(true);
 }, []);

 if (isLoading) return <Text>Loading preferences…</Text>;

 return (
 <Stack className="page-enter stagger-children">
 <Group justify="space-between" align="flex-end">
 <div>
 <Title order={2} c={headingColor}>Sidebar Order</Title>
 <Text size="sm" c="dimmed">
 Reorder sidebar groups and pages within each group — your preferences only.
 </Text>
 </div>
 <Group gap="sm">
 <Button
 variant="subtle"
 leftSection={<IconRefresh size={16} />}
 onClick={handleReset}
 size="sm"
 >
 Reset to Default
 </Button>
 <Button
 leftSection={<IconDeviceFloppy size={16} />}
 onClick={handleSave}
 loading={saving}
 disabled={!dirty}
 size="sm"
 >
 Save Order
 </Button>
 </Group>
 </Group>

 <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
 Use the arrow buttons to reorder groups and the pages within each group.
 Click a group header to collapse/expand it. Changes are saved per user.
 </Alert>

 <Stack gap="sm">
 {groups.map((group, gi) => (
 <Card
 key={group.label}
 withBorder
 p="sm"
 >
 {/* Group header */}
 <Group
 justify="space-between"
 style={{ cursor: 'pointer' }}
 onClick={() => setCollapsedGroups(prev => {
 const next = new Set(prev);
 if (next.has(group.label)) next.delete(group.label);
 else next.add(group.label);
 return next;
 })}
 >
 <Group gap="sm">
 <IconGripVertical size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
 <Text fw={700} size="sm" c={dark ? AQUA : DEEP_BLUE}>{group.label}</Text>
 <Badge size="xs" variant="light" color="gray">{group.items.length} pages</Badge>
 </Group>
 <Group gap={4}>
 <Tooltip label="Move group up">
 <ActionIcon
 variant="subtle"
 size="sm"
 disabled={gi === 0}
 onClick={(e) => { e.stopPropagation(); handleMoveGroup(gi, -1); }}
 aria-label="Move up"
>
 <IconArrowUp size={14} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Move group down">
 <ActionIcon
 variant="subtle"
 size="sm"
 disabled={gi === groups.length - 1}
 onClick={(e) => { e.stopPropagation(); handleMoveGroup(gi, 1); }}
 aria-label="Move down"
>
 <IconArrowDown size={14} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Group>

 {/* Items — expanded by default */}
 {!collapsedGroups.has(group.label) && (
 <Stack gap={4} mt="sm" pl="lg">
 <Divider mb={4} />
 {group.items.map((item, ii) => (
 <Paper
 key={item}
 p="xs"
 withBorder
 style={{
 backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
 }}
 >
 <Group justify="space-between">
 <Group gap="sm">
 <Text size="xs" c="dimmed" fw={600} style={{ width: 20, textAlign: 'right' }}>{ii + 1}.</Text>
 <Text size="sm">{item}</Text>
 </Group>
 <Group gap={4}>
 <Tooltip label="Move page up">
 <ActionIcon
 variant="subtle"
 size="xs"
 disabled={ii === 0}
 onClick={() => handleMoveItem(group.label, ii, -1)}
 aria-label="Move up"
>
 <IconArrowUp size={12} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Move page down">
 <ActionIcon
 variant="subtle"
 size="xs"
 disabled={ii === group.items.length - 1}
 onClick={() => handleMoveItem(group.label, ii, 1)}
 aria-label="Move down"
>
 <IconArrowDown size={12} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Group>
 </Paper>
 ))}
 </Stack>
 )}
 </Card>
 ))}
 </Stack>
 </Stack>
 );
}
