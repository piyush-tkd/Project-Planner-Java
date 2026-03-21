import React, { useMemo, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Table,
  MultiSelect,
  Stack,
  Group,
  Modal,
  Badge,
  List,
  Box,
  SimpleGrid,
  Paper,
  ThemeIcon,
  RingProgress,
} from '@mantine/core';
import { IconBriefcase, IconUsers, IconFlame, IconChartBar } from '@tabler/icons-react';
import { useProjectPodMatrix } from '../../api/projects';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';

interface ProjectPodMatrixResponse {
  planningId: number;
  projectId: number;
  projectName: string;
  priority: string;
  owner: string;
  status: string;
  projectStartMonth: number;
  projectDurationMonths: number;
  defaultPattern: string;
  podId: number;
  podName: string;
  tshirtSize: string | null;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}

const getColorForCount = (count: number) => {
  if (count === 0) return '#f1f3f5';
  if (count <= 2) return '#d3f9d8';
  if (count <= 4) return '#fff3bf';
  if (count <= 6) return '#ffe066';
  return '#ffa94d';
};

const getPriorityColor = (priority: string) => {
  const lower = priority.toLowerCase();
  if (lower === 'critical') return 'red';
  if (lower === 'high') return 'orange';
  if (lower === 'medium') return 'yellow';
  return 'blue';
};

export default function OwnerDemandPage() {
  const { data: projectPodMatrix, isLoading, error } = useProjectPodMatrix();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    owner: string;
    monthIndex: number;
    projects: ProjectPodMatrixResponse[];
  } | null>(null);

  const { ownerDemandMatrix, owners } = useMemo(() => {
    if (!projectPodMatrix) return { ownerDemandMatrix: {}, owners: [] };

    const matrix: Record<string, Record<number, ProjectPodMatrixResponse[]>> = {};
    const ownerSet = new Set<string>();

    projectPodMatrix.forEach((pod) => {
      ownerSet.add(pod.owner);

      const startMonth = pod.podStartMonth ?? pod.projectStartMonth;
      const duration = pod.durationOverride ?? pod.projectDurationMonths;
      const endMonth = startMonth + duration;

      for (let month = startMonth; month < endMonth && month <= 12; month++) {
        if (!matrix[pod.owner]) {
          matrix[pod.owner] = {};
        }
        if (!matrix[pod.owner][month]) {
          matrix[pod.owner][month] = [];
        }
        if (!matrix[pod.owner][month].find((p) => p.projectId === pod.projectId)) {
          matrix[pod.owner][month].push(pod);
        }
      }
    });

    return {
      ownerDemandMatrix: matrix,
      owners: Array.from(ownerSet).sort(),
    };
  }, [projectPodMatrix]);

  const filteredOwners = useMemo(() => {
    return selectedOwners.length === 0 ? owners : selectedOwners;
  }, [owners, selectedOwners]);

  // ── Summary widget: unique projects per owner ──
  const ownerSummary = useMemo(() => {
    if (!projectPodMatrix) return [];
    const map = new Map<string, Set<number>>();
    projectPodMatrix.forEach(p => {
      if (!map.has(p.owner)) map.set(p.owner, new Set());
      map.get(p.owner)!.add(p.projectId);
    });
    return Array.from(map.entries())
      .map(([owner, ids]) => ({ owner, count: ids.size }))
      .sort((a, b) => b.count - a.count);
  }, [projectPodMatrix]);

  const totalUniqueProjects = useMemo(() => {
    if (!projectPodMatrix) return 0;
    return new Set(projectPodMatrix.map(p => p.projectId)).size;
  }, [projectPodMatrix]);

  const busiestOwner = ownerSummary[0];
  const avgProjects = ownerSummary.length > 0
    ? Math.round((ownerSummary.reduce((s, o) => s + o.count, 0) / ownerSummary.length) * 10) / 10
    : 0;

  // ── Owner detail modal state ──
  const [ownerDetailOpen, setOwnerDetailOpen] = useState(false);
  const [selectedOwnerDetail, setSelectedOwnerDetail] = useState<string | null>(null);

  const selectedOwnerProjects = useMemo(() => {
    if (!selectedOwnerDetail || !projectPodMatrix) return [];
    const seen = new Set<number>();
    return projectPodMatrix
      .filter(p => p.owner === selectedOwnerDetail)
      .filter(p => { if (seen.has(p.projectId)) return false; seen.add(p.projectId); return true; })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [selectedOwnerDetail, projectPodMatrix]);

  if (isLoading) return <LoadingSpinner variant="table" message="Loading owner demand..." />;
  if (error) return <Text c="red">Error loading project data</Text>;

  const tableRows = filteredOwners.map((owner) => (
    <Table.Tr key={owner}>
      <Table.Td
        style={{ fontWeight: 600, minWidth: '150px', backgroundColor: '#f8f9fa', cursor: 'pointer' }}
        onClick={() => { setSelectedOwnerDetail(owner); setOwnerDetailOpen(true); }}
      >
        <Text size="sm" fw={600} c="blue" td="underline" style={{ textDecorationStyle: 'dotted' }}>
          {owner}
        </Text>
      </Table.Td>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((monthIndex) => {
        const isCurrentMonth = monthIndex === currentMonthIndex;
        const projects = ownerDemandMatrix[owner]?.[monthIndex] ?? [];
        const count = projects.length;

        return (
          <Table.Td
            key={monthIndex}
            style={{
              backgroundColor: isCurrentMonth ? AQUA : getColorForCount(count),
              textAlign: 'center',
              cursor: count > 0 ? 'pointer' : 'default',
              minWidth: '70px',
            }}
            onClick={() => {
              if (count > 0) {
                setSelectedCell({ owner, monthIndex, projects });
                setModalOpen(true);
              }
            }}
          >
            <Text
              fw={700}
              size="lg"
              style={{
                color: isCurrentMonth ? 'white' : count === 0 ? '#adb5bd' : '#212529',
              }}
            >
              {count}
            </Text>
          </Table.Td>
        );
      })}
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Owner Demand
          </Title>
          <Text c="dimmed" size="sm">
            Active projects per owner per month
          </Text>
        </div>

        {/* ── Summary widgets ── */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Paper p="md" radius="md" withBorder style={{ cursor: 'default' }}>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color="blue">
                <IconUsers size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Owners</Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{owners.length}</Text>
              </div>
            </Group>
          </Paper>

          <Paper p="md" radius="md" withBorder style={{ cursor: 'default' }}>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color="teal">
                <IconBriefcase size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Total Projects</Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{totalUniqueProjects}</Text>
              </div>
            </Group>
          </Paper>

          <Paper
            p="md" radius="md" withBorder
            style={{ cursor: busiestOwner ? 'pointer' : 'default', transition: 'box-shadow 150ms' }}
            className={busiestOwner ? 'owner-widget-hover' : ''}
            onClick={() => {
              if (busiestOwner) {
                setSelectedOwnerDetail(busiestOwner.owner);
                setOwnerDetailOpen(true);
              }
            }}
          >
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color="orange">
                <IconFlame size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Busiest Owner</Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>
                  {busiestOwner ? `${busiestOwner.owner} (${busiestOwner.count})` : '–'}
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper p="md" radius="md" withBorder style={{ cursor: 'default' }}>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color="violet">
                <IconChartBar size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Avg per Owner</Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{avgProjects}</Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* ── Per-owner project counts (clickable badges) ── */}
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: '0.04em' }}>Unique Projects per Owner</Text>
          <Group gap="xs" wrap="wrap">
            {ownerSummary.map(({ owner, count }) => (
              <Box
                key={owner}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedOwnerDetail(owner);
                  setOwnerDetailOpen(true);
                }}
              >
                <Badge
                  size="lg"
                  variant="light"
                  color={count > avgProjects ? 'orange' : 'teal'}
                  style={{ textTransform: 'none', fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                >
                  {owner}: {count}
                </Badge>
              </Box>
            ))}
          </Group>
        </Paper>

        <Group justify="flex-start">
          <MultiSelect
            label="Filter by owner"
            placeholder="Select owners..."
            data={owners}
            value={selectedOwners}
            onChange={setSelectedOwners}
            searchable
            clearable
            style={{ flex: 1, maxWidth: '400px' }}
          />
        </Group>

        <div style={{ overflowX: 'auto' }}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white', minWidth: '150px' }}>
                  Owner
                </Table.Th>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((monthIdx) => {
                  const isCurrentMonth = monthIdx === currentMonthIndex;
                  return (
                    <Table.Th
                      key={monthIdx}
                      style={{
                        backgroundColor: isCurrentMonth ? AQUA : DEEP_BLUE,
                        color: 'white',
                        textAlign: 'center',
                        minWidth: '70px',
                      }}
                    >
                      {monthLabels[monthIdx]}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{tableRows}</Table.Tbody>
          </Table>
        </div>
      </Stack>

      {/* ── Owner detail modal ── */}
      <Modal
        opened={ownerDetailOpen}
        onClose={() => setOwnerDetailOpen(false)}
        title={`${selectedOwnerDetail} — ${selectedOwnerProjects.length} Projects`}
        size="lg"
      >
        {selectedOwnerDetail && (
          <Stack gap="sm">
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>POD</Table.Th>
                  <Table.Th>Duration</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedOwnerProjects.map(p => (
                  <Table.Tr key={p.projectId}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{p.projectName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={getPriorityColor(p.priority)}>{p.priority}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light">{p.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{p.podName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{p.durationOverride ?? p.projectDurationMonths}m</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      {/* ── Month cell detail modal ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${selectedCell?.owner} - ${monthLabels[selectedCell?.monthIndex ?? 1]}`}
        size="sm"
      >
        {selectedCell && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Active Projects ({selectedCell.projects.length})
              </Text>
              <List spacing="sm">
                {selectedCell.projects.map((project) => (
                  <List.Item key={project.projectId}>
                    <Group justify="space-between" grow>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">
                          {project.projectName}
                        </Text>
                        <Group gap="xs" mt="4px">
                          <Badge size="xs" color={getPriorityColor(project.priority)}>
                            {project.priority}
                          </Badge>
                          <Badge size="xs" variant="light">
                            {project.status}
                          </Badge>
                        </Group>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed" mt="4px">
                      POD: {project.podName} ({project.tshirtSize})
                    </Text>
                  </List.Item>
                ))}
              </List>
            </div>
          </Stack>
        )}
      </Modal>

      <style>{`
        .owner-widget-hover:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          border-color: var(--mantine-color-orange-4) !important;
        }
      `}</style>
    </Container>
  );
}
