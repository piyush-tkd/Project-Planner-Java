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
} from '@mantine/core';
import { useProjectPodMatrix } from '../../api/projects';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const DEEP_BLUE = '#0C2340';
const AGUA = '#1F9196';

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
  tshirtSize: string;
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

      for (let month = startMonth; month < endMonth && month < 12; month++) {
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

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading project data</Text>;

  const tableRows = filteredOwners.map((owner) => (
    <Table.Tr key={owner}>
      <Table.Td style={{ fontWeight: 600, minWidth: '150px', backgroundColor: '#f8f9fa' }}>
        {owner}
      </Table.Td>
      {Array.from({ length: 12 }).map((_, monthIndex) => {
        const isCurrentMonth = monthIndex === currentMonthIndex;
        const projects = ownerDemandMatrix[owner]?.[monthIndex] ?? [];
        const count = projects.length;

        return (
          <Table.Td
            key={monthIndex}
            style={{
              backgroundColor: isCurrentMonth ? AGUA : getColorForCount(count),
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
          <Title order={1} style={{ fontFamily: 'Barlow, system-ui', color: DEEP_BLUE }}>
            Owner Demand
          </Title>
          <Text c="dimmed" size="sm">
            Active projects per owner per month
          </Text>
        </div>

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
                {Array.from({ length: 12 }).map((_, i) => {
                  const isCurrentMonth = i === currentMonthIndex;
                  return (
                    <Table.Th
                      key={i}
                      style={{
                        backgroundColor: isCurrentMonth ? AGUA : DEEP_BLUE,
                        color: 'white',
                        textAlign: 'center',
                        minWidth: '70px',
                      }}
                    >
                      {monthLabels[i]}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{tableRows}</Table.Tbody>
          </Table>
        </div>
      </Stack>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${selectedCell?.owner} - ${monthLabels[selectedCell?.monthIndex ?? 0]}`}
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
    </Container>
  );
}
