/**
 * GlobalSearch — Cmd+K / Ctrl+K command palette.
 *
 * Searches across: pages (nav), projects, resources, PODs.
 * Results are purely client-side (uses already-cached TanStack Query data).
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal, TextInput, Stack, Text, Group, Badge, Kbd, ScrollArea,
  UnstyledButton, Divider,
} from '@mantine/core';
import {
  IconSearch, IconBriefcase, IconUsers, IconHexagons,
  IconChartBar, IconDashboard, IconSettings, IconArrowRight,
  IconBrain,
} from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: string;
  icon: React.ReactNode;
  path: string;
  badges?: string[];
}

// Static nav pages searchable
const PAGE_RESULTS: SearchResult[] = [
  { id: 'p-dash',    label: 'Dashboard',           category: 'Pages', icon: <IconDashboard size={15} />,  path: '/' },
  { id: 'p-nlp',     label: 'Ask AI',              category: 'Pages', icon: <IconBrain size={15} />,      path: '/nlp' },
  { id: 'p-res',     label: 'Resources',            category: 'Pages', icon: <IconUsers size={15} />,      path: '/resources' },
  { id: 'p-proj',    label: 'Projects',             category: 'Pages', icon: <IconBriefcase size={15} />,  path: '/projects' },
  { id: 'p-pods',    label: 'PODs',                 category: 'Pages', icon: <IconHexagons size={15} />,   path: '/pods' },
  { id: 'p-avail',   label: 'Availability',         category: 'Pages', icon: <IconUsers size={15} />,      path: '/availability' },
  { id: 'p-cap',     label: 'Capacity Gap',         category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/capacity-gap' },
  { id: 'p-util',    label: 'Utilization',  category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/utilization' },
  { id: 'p-hire',    label: 'Hiring Forecast',      category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/hiring-forecast' },
  { id: 'p-concur',  label: 'Concurrency Risk',     category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/concurrency' },
  { id: 'p-alloc',   label: 'Resource Allocation',  category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/resource-allocation' },
  { id: 'p-budget',  label: 'Budget & Cost',        category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/budget' },
  { id: 'p-gantt',   label: 'Project Gantt',        category: 'Reports', icon: <IconChartBar size={15} />, path: '/reports/gantt' },
  { id: 'p-sim',     label: 'Scenario Simulator',   category: 'Simulators', icon: <IconSettings size={15} />, path: '/simulator/scenario' },
  { id: 'p-timsim',  label: 'Timeline Simulator',   category: 'Simulators', icon: <IconSettings size={15} />, path: '/simulator/timeline' },
  { id: 'p-support', label: 'Support Queue',        category: 'Integrations', icon: <IconSettings size={15} />, path: '/jira-support' },
  { id: 'p-capex',   label: 'CapEx / OpEx',         category: 'Integrations', icon: <IconSettings size={15} />, path: '/jira-capex' },
  { id: 'p-tl',      label: 'Timeline Settings',    category: 'Settings', icon: <IconSettings size={15} />, path: '/settings/timeline' },
  { id: 'p-ref',     label: 'Reference Data',       category: 'Settings', icon: <IconSettings size={15} />, path: '/settings/ref-data' },
  { id: 'p-jira',    label: 'Jira Settings',        category: 'Settings', icon: <IconSettings size={15} />, path: '/settings/jira' },
];

const CATEGORY_ORDER = ['Pages', 'Reports', 'Simulators', 'Integrations', 'Settings', 'Projects', 'Resources', 'PODs'];

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--mantine-color-yellow-3)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function useGlobalSearch() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpened(o => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { opened, setOpened };
}

export default function GlobalSearch({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useProjects();
  const { data: resources = [] } = useResources();
  const { data: pods = [] } = usePods();

  // Reset query when modal opens
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [opened]);

  const results = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGE_RESULTS.slice(0, 12);

    const matched: SearchResult[] = [];

    // Pages
    for (const p of PAGE_RESULTS) {
      if (p.label.toLowerCase().includes(q)) matched.push(p);
    }

    // Projects
    for (const p of projects) {
      if (p.name.toLowerCase().includes(q) || String(p.id) === q) {
        matched.push({
          id: `proj-${p.id}`,
          label: p.name,
          sublabel: `Project · M${p.startMonth}–M${(p.startMonth ?? 1) + (p.durationMonths ?? 1) - 1}`,
          category: 'Projects',
          icon: <IconBriefcase size={15} />,
          path: `/projects/${p.id}`,
          badges: p.status ? [p.status] : [],
        });
      }
    }

    // Resources
    for (const r of resources) {
      if (r.name.toLowerCase().includes(q)) {
        matched.push({
          id: `res-${r.id}`,
          label: r.name,
          sublabel: `${r.role?.replace(/_/g, ' ')} · ${r.location ?? ''}`,
          category: 'Resources',
          icon: <IconUsers size={15} />,
          path: `/resources`,
          badges: r.active ? [] : ['Inactive'],
        });
      }
    }

    // PODs
    for (const pod of pods) {
      if (pod.name.toLowerCase().includes(q)) {
        matched.push({
          id: `pod-${pod.id}`,
          label: pod.name,
          sublabel: 'POD',
          category: 'PODs',
          icon: <IconHexagons size={15} />,
          path: `/pods/${pod.id}`,
        });
      }
    }

    return matched.slice(0, 50);
  }, [query, projects, resources, pods]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    // Sort by CATEGORY_ORDER
    return CATEGORY_ORDER
      .filter(c => map.has(c))
      .map(c => ({ category: c, items: map.get(c)! }));
  }, [results]);

  // Flat index for keyboard nav
  const flatResults = useMemo(() => results, [results]);

  function handleSelect(path: string) {
    onClose();
    navigate(path);
  }

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flatResults[selectedIdx];
      if (item) handleSelect(item.path);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
      size="lg"
      radius="md"
      styles={{
        content: { overflow: 'hidden' },
        body: { padding: 0 },
      }}
    >
      <TextInput
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search pages, projects, resources, PODs…"
        leftSection={<IconSearch size={16} />}
        rightSection={<Kbd size="xs">Esc</Kbd>}
        size="lg"
        variant="unstyled"
        styles={{
          input: {
            borderBottom: '1px solid var(--mantine-color-default-border)',
            borderRadius: '8px 8px 0 0',
            paddingLeft: 48,
            paddingRight: 60,
            fontSize: 15,
          },
          section: { paddingLeft: 16 },
        }}
      />

      {results.length === 0 ? (
        <Stack align="center" py="xl" gap="xs">
          <Text c="dimmed" size="sm">No results for "{query}"</Text>
        </Stack>
      ) : (
        <ScrollArea h={440} p="xs">
          {grouped.map((group, gi) => {
            const prevCount = grouped.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
            return (
              <div key={group.category}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" px="sm" pt={gi === 0 ? 8 : 4} pb={4}
                  style={{ letterSpacing: '0.06em', fontSize: 10 }}>
                  {group.category}
                </Text>
                {group.items.map((item, ii) => {
                  const flatIdx = prevCount + ii;
                  const isSelected = flatIdx === selectedIdx;
                  return (
                    <UnstyledButton
                      key={item.id}
                      onClick={() => handleSelect(item.path)}
                      onMouseEnter={() => setSelectedIdx(flatIdx)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>
                            {item.icon}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>
                              {highlight(item.label, query)}
                            </Text>
                            {item.sublabel && (
                              <Text size="xs" c="dimmed" truncate>{item.sublabel}</Text>
                            )}
                          </div>
                          {(item.badges ?? []).map(b => (
                            <Badge key={b} size="xs" variant="light" color="gray">{b}</Badge>
                          ))}
                        </Group>
                        {isSelected && <IconArrowRight size={14} color="var(--mantine-color-blue-6)" />}
                      </Group>
                    </UnstyledButton>
                  );
                })}
                {gi < grouped.length - 1 && <Divider my={4} />}
              </div>
            );
          })}
        </ScrollArea>
      )}

      <Divider />
      <Group px="md" py="xs" gap="lg" justify="flex-end">
        <Group gap={4}>
          <Kbd size="xs">↑↓</Kbd>
          <Text size="xs" c="dimmed">navigate</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">↵</Kbd>
          <Text size="xs" c="dimmed">open</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">Esc</Kbd>
          <Text size="xs" c="dimmed">close</Text>
        </Group>
      </Group>
    </Modal>
  );
}
