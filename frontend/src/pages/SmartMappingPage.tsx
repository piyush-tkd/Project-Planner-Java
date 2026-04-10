import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Title, Text, Stack, Group, Button, Card, Badge, Table,
  Progress, Tooltip, Alert, ActionIcon, Select, Loader, Center,
  Divider, Skeleton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTicket, IconLink, IconX, IconRefresh, IconAlertCircle,
  IconCheck, IconExternalLink, IconChartBar,
} from '@tabler/icons-react';
import apiClient from '../api/client';
import { AQUA, BORDER_STRONG, DEEP_BLUE, FONT_FAMILY, SURFACE_FAINT } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { PPPageLayout } from '../components/pp';

interface SuggestionDto {
  id: number;
  ppProject: {
    id: number;
    name: string;
    owner: string | null;
    status: string;
    jiraEpicKey: string | null;
  };
  jiraEpicKey: string;
  score: number;
  nameScore: number;
  ownerScore: number;
  dateScore: number;
  statusScore: number;
  epicKeyBonus: number;
  resolution: 'PENDING' | 'LINKED' | 'IGNORED';
  resolvedAt: string | null;
  createdAt: string;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Group justify="space-between" mb={2}>
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
        <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>{value.toFixed(0)}</Text>
      </Group>
      <Progress value={value} color={color} size="xs" radius="xl" />
    </div>
  );
}

function resolutionBadge(resolution: string) {
  if (resolution === 'LINKED')  return <Badge size="xs" color="teal"  variant="light">Linked</Badge>;
  if (resolution === 'IGNORED') return <Badge size="xs" color="gray"  variant="light">Ignored</Badge>;
  return                               <Badge size="xs" color="orange" variant="light">Pending</Badge>;
}

function compositeColor(score: number) {
  if (score >= 85) return 'red';
  if (score >= 70) return 'orange';
  if (score >= 55) return 'yellow';
  return 'gray';
}

function compositeLabel(score: number) {
  if (score >= 85) return 'Duplicate Risk';
  if (score >= 70) return 'Likely Match';
  if (score >= 55) return 'Possible Match';
  return 'Low';
}

export default function SmartMappingPage() {
  const isDark = useDarkMode();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('PENDING');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: suggestions = [], isLoading } = useQuery<SuggestionDto[]>({
    queryKey: ['smart-mapping-suggestions'],
    queryFn: async () => {
      const r = await apiClient.get('/smart-mapping/suggestions');
      return r.data;
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await apiClient.post('/smart-mapping/run');
      return r.data as { newSuggestions: number };
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Analysis complete',
        message: `${data.newSuggestions} new suggestion${data.newSuggestions !== 1 ? 's' : ''} found`,
        color: data.newSuggestions > 0 ? 'teal' : 'gray',
      });
      qc.invalidateQueries({ queryKey: ['smart-mapping-suggestions'] });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Analysis failed', color: 'red' }),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) => {
      await apiClient.post(`/smart-mapping/${id}/resolve`, { resolution });
    },
    onSuccess: (_, vars) => {
      const label = vars.resolution === 'LINKED' ? 'Linked' : 'Ignored';
      notifications.show({ title: label, message: `Suggestion ${label.toLowerCase()} successfully`, color: 'teal' });
      qc.invalidateQueries({ queryKey: ['smart-mapping-suggestions'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to resolve suggestion', color: 'red' }),
  });

  const filtered = suggestions.filter(s =>
    filter === 'ALL' ? true : s.resolution === filter,
  );

  const pendingCount = suggestions.filter(s => s.resolution === 'PENDING').length;
  const linkedCount  = suggestions.filter(s => s.resolution === 'LINKED').length;
  const ignoredCount = suggestions.filter(s => s.resolution === 'IGNORED').length;

  return (
    <PPPageLayout title="Smart Mapping" subtitle="AI-assisted Jira project to portfolio mapping suggestions" animate>
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div></div>
        <Button
          leftSection={<IconRefresh size={14} />}
          variant="light"
          color="teal"
          onClick={() => runMutation.mutate()}
          loading={runMutation.isPending}
        >
          Run Analysis
        </Button>
      </Group>

      {/* Summary cards */}
      <Group grow>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Pending Review</Text>
          <Text size="xl" fw={700} c="orange" style={{ fontFamily: FONT_FAMILY }}>{pendingCount}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Linked</Text>
          <Text size="xl" fw={700} c="teal" style={{ fontFamily: FONT_FAMILY }}>{linkedCount}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Ignored</Text>
          <Text size="xl" fw={700} c="gray" style={{ fontFamily: FONT_FAMILY }}>{ignoredCount}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Total</Text>
          <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY }}>{suggestions.length}</Text>
        </Card>
      </Group>

      {pendingCount > 0 && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
            {pendingCount} suggestion{pendingCount !== 1 ? 's' : ''} awaiting review.
            High-score pairs may represent duplicate projects — link or ignore them.
          </Text>
        </Alert>
      )}

      {/* Filter */}
      <Group>
        <Select
          size="sm"
          value={filter}
          onChange={v => setFilter(v ?? 'PENDING')}
          data={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'LINKED',  label: 'Linked' },
            { value: 'IGNORED', label: 'Ignored' },
            { value: 'ALL',     label: 'All' },
          ]}
          style={{ width: 140 }}
        />
        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          {filtered.length} suggestion{filtered.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      {/* Table */}
      {isLoading ? (
        <Stack gap="xs">{[1,2,3,4,5].map(i => <Skeleton key={i} height={48} radius="sm" />)}</Stack>
      ) : filtered.length === 0 ? (
        <Card withBorder padding="xl">
          <Center>
            <Stack align="center" gap="xs">
              <IconChartBar size={40} color="gray" />
              <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
                {filter === 'PENDING'
                  ? 'No pending suggestions — run the analysis to detect possible matches'
                  : 'No suggestions in this category'}
              </Text>
              {filter === 'PENDING' && (
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconRefresh size={12} />}
                  onClick={() => runMutation.mutate()}
                  loading={runMutation.isPending}
                >
                  Run Analysis
                </Button>
              )}
            </Stack>
          </Center>
        </Card>
      ) : (
        <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 220 }}>PP Project</Table.Th>
              <Table.Th style={{ width: 120 }}>Jira Epic</Table.Th>
              <Table.Th style={{ width: 110 }}>Score</Table.Th>
              <Table.Th>Signal Breakdown</Table.Th>
              <Table.Th style={{ width: 90 }}>Status</Table.Th>
              <Table.Th style={{ width: 130 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map(s => (
              <>
                <Table.Tr
                  key={s.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  {/* PP Project */}
                  <Table.Td fw={600} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
                    <Stack gap={2}>
                      <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>{s.ppProject.name}</Text>
                      {s.ppProject.owner && (
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{s.ppProject.owner}</Text>
                      )}
                    </Stack>
                  </Table.Td>

                  {/* Jira Epic */}
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <IconTicket size={14} color="#0052CC" />
                      <Text size="xs" fw={500} style={{ fontFamily: FONT_FAMILY }}>{s.jiraEpicKey}</Text>
                      <Tooltip label={`Open ${s.jiraEpicKey} in Jira`} withArrow>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          component="a"
                          href={`https://baylorgenetics.atlassian.net/browse/${s.jiraEpicKey}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                        >
                          <IconExternalLink size={10} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>

                  {/* Score */}
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge
                        size="sm"
                        color={compositeColor(Number(s.score))}
                        variant="light"
                        style={{ fontFamily: FONT_FAMILY }}
                      >
                        {compositeLabel(Number(s.score))}
                      </Badge>
                      <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY }}>
                        {Number(s.score).toFixed(1)}
                      </Text>
                    </Stack>
                  </Table.Td>

                  {/* Signal bars (compact preview) */}
                  <Table.Td>
                    <Group gap={8} wrap="nowrap">
                      <Tooltip label={`Name similarity: ${Number(s.nameScore).toFixed(0)}`} withArrow>
                        <Progress
                          value={Number(s.nameScore)}
                          color="blue"
                          size="sm"
                          style={{ width: 60 }}
                          radius="xl"
                        />
                      </Tooltip>
                      <Tooltip label={`Owner match: ${Number(s.ownerScore).toFixed(0)}`} withArrow>
                        <Progress
                          value={Number(s.ownerScore)}
                          color="violet"
                          size="sm"
                          style={{ width: 40 }}
                          radius="xl"
                        />
                      </Tooltip>
                    </Group>
                  </Table.Td>

                  {/* Resolution */}
                  <Table.Td>{resolutionBadge(s.resolution)}</Table.Td>

                  {/* Actions */}
                  <Table.Td onClick={e => e.stopPropagation()}>
                    {s.resolution === 'PENDING' && (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Link — same project" withArrow>
                          <ActionIcon
                            size="sm"
                            color="teal"
                            variant="light"
                            loading={resolveMutation.isPending}
                            onClick={() => resolveMutation.mutate({ id: s.id, resolution: 'LINKED' })}
                          >
                            <IconLink size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Ignore — not the same" withArrow>
                          <ActionIcon
                            size="sm"
                            color="gray"
                            variant="light"
                            loading={resolveMutation.isPending}
                            onClick={() => resolveMutation.mutate({ id: s.id, resolution: 'IGNORED' })}
                          >
                            <IconX size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                    {s.resolution === 'LINKED' && (
                      <Group gap={4} wrap="nowrap">
                        <IconCheck size={14} color="teal" />
                        <Text size="xs" c="teal" style={{ fontFamily: FONT_FAMILY }}>Linked</Text>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>

                {/* Expanded score breakdown */}
                {expandedId === s.id && (
                  <Table.Tr key={`${s.id}-expanded`}>
                    <Table.Td colSpan={6} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : SURFACE_FAINT }}>
                      <Stack gap="xs" p="sm">
                        <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                          Score Breakdown
                        </Text>
                        <Divider />
                        <Group grow>
                          <div>
                            <ScoreBar label="Name similarity (40%)"  value={Number(s.nameScore)}    color="blue" />
                            <ScoreBar label="Owner match (25%)"       value={Number(s.ownerScore)}   color="violet" />
                            <ScoreBar label="Date proximity (20%)"    value={Number(s.dateScore)}    color="cyan" />
                            <ScoreBar label="Status match (10%)"      value={Number(s.statusScore)}  color="green" />
                            <ScoreBar label="Epic key mention (5%)"   value={Number(s.epicKeyBonus)} color="orange" />
                          </div>
                          <div>
                            <Text size="xs" c="dimmed" mb={4} style={{ fontFamily: FONT_FAMILY }}>Composite</Text>
                            <Progress
                              value={Number(s.score)}
                              color={compositeColor(Number(s.score))}
                              size="xl"
                              radius="sm"
                            />
                            <Text size="sm" fw={700} mt={4} style={{ fontFamily: FONT_FAMILY }}>
                              {Number(s.score).toFixed(1)} / 100 — {compositeLabel(Number(s.score))}
                            </Text>
                          </div>
                        </Group>
                        {s.resolvedAt && (
                          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                            Resolved at {new Date(s.resolvedAt).toLocaleString()}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                )}
              </>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </PPPageLayout>
  );
}
