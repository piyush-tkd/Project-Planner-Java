import React, { useMemo, useState } from 'react';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Stack,
  SegmentedControl,
  MultiSelect,
  Box,
  ThemeIcon,
  Tooltip,
  Center,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
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
  tshirtSize: string;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}

interface ProjectWithPods {
  projectId: number;
  projectName: string;
  priority: string;
  status: string;
  owner: string;
  projectStartMonth: number;
  projectDurationMonths: number;
  pods: Array<{
    podId: number;
    podName: string;
    tshirtSize: string;
    startMonth: number;
    endMonth: number;
  }>;
}

type SortBy = 'podCount' | 'startMonth' | 'name';

const POD_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
];

const getPriorityColor = (priority: string) => {
  const lower = priority.toLowerCase();
  if (lower === 'critical') return 'red';
  if (lower === 'high') return 'orange';
  if (lower === 'medium') return 'yellow';
  return 'blue';
};

export default function CrossPodDependencyPage() {
  const { data: projectPodMatrix, isLoading, error } = useProjectPodMatrix();
  const { monthLabels } = useMonthLabels();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortBy>('podCount');
  const [selectedPods, setSelectedPods] = useState<string[]>([]);

  const { multiPodProjects, allPods } = useMemo(() => {
    if (!projectPodMatrix) return { multiPodProjects: [], allPods: [] };

    const projectMap: Record<number, ProjectWithPods> = {};
    const podSet = new Set<string>();

    projectPodMatrix.forEach((podAssignment) => {
      podSet.add(podAssignment.podName);

      if (!projectMap[podAssignment.projectId]) {
        projectMap[podAssignment.projectId] = {
          projectId: podAssignment.projectId,
          projectName: podAssignment.projectName,
          priority: podAssignment.priority,
          status: podAssignment.status,
          owner: podAssignment.owner,
          projectStartMonth: podAssignment.projectStartMonth,
          projectDurationMonths: podAssignment.projectDurationMonths,
          pods: [],
        };
      }

      const startMonth = podAssignment.podStartMonth ?? podAssignment.projectStartMonth;
      const duration =
        podAssignment.durationOverride ?? podAssignment.projectDurationMonths;

      projectMap[podAssignment.projectId].pods.push({
        podId: podAssignment.podId,
        podName: podAssignment.podName,
        tshirtSize: podAssignment.tshirtSize,
        startMonth,
        endMonth: startMonth + duration,
      });
    });

    const multiPod = Object.values(projectMap)
      .filter((p) => p.pods.length > 1)
      .sort((a, b) => {
        if (sortBy === 'podCount') {
          return b.pods.length - a.pods.length;
        }
        if (sortBy === 'startMonth') {
          return a.projectStartMonth - b.projectStartMonth;
        }
        return a.projectName.localeCompare(b.projectName);
      });

    return {
      multiPodProjects: multiPod,
      allPods: Array.from(podSet).sort(),
    };
  }, [projectPodMatrix, sortBy]);

  const filteredProjects = useMemo(() => {
    if (selectedPods.length === 0) return multiPodProjects;
    return multiPodProjects.filter((proj) =>
      proj.pods.some((pod) => selectedPods.includes(pod.podName))
    );
  }, [multiPodProjects, selectedPods]);

  if (isLoading) return <LoadingSpinner variant="table" message="Loading cross-POD dependencies..." />;
  if (error) return <Text c="red">Error loading dependency data</Text>;

  if (filteredProjects.length === 0) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <div>
            <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
              Cross-POD Dependencies
            </Title>
            <Text c="dimmed" size="sm">
              Projects that span multiple PODs — coordination risk
            </Text>
          </div>
          <Center py="xl">
            <Text c="dimmed">No multi-POD projects found</Text>
          </Center>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Cross-POD Dependencies
          </Title>
          <Text c="dimmed" size="sm">
            Projects that span multiple PODs — coordination risk
          </Text>
        </div>

        <Group justify="space-between" wrap="wrap">
          <SegmentedControl
            label="Sort by"
            value={sortBy}
            onChange={(value) => setSortBy(value as SortBy)}
            data={[
              { label: 'POD Count', value: 'podCount' },
              { label: 'Start Month', value: 'startMonth' },
              { label: 'Name', value: 'name' },
            ]}
          />
          <MultiSelect
            label="Filter by POD"
            placeholder="Select PODs..."
            data={allPods}
            value={selectedPods}
            onChange={setSelectedPods}
            searchable
            clearable
            style={{ flex: 1, maxWidth: '300px' }}
          />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {filteredProjects.map((project) => {
            const concurrentMonths = (() => {
              const monthCounts: Record<number, number> = {};
              project.pods.forEach((pod) => {
                for (let m = pod.startMonth; m < pod.endMonth && m < 12; m++) {
                  monthCounts[m] = (monthCounts[m] ?? 0) + 1;
                }
              });
              return Object.values(monthCounts).filter((count) => count > 1).length;
            })();

            return (
              <Card
                key={project.projectId}
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => navigate(`/projects/${project.projectId}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                }}
              >
                <Card.Section
                  withBorder
                  inheritPadding
                  py="md"
                  style={{ backgroundColor: '#f8f9fa' }}
                >
                  <Group justify="space-between" mb="sm">
                    <Text fw={700} size="lg" lineClamp={2}>
                      {project.projectName}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Badge size="sm" color={getPriorityColor(project.priority)}>
                      {project.priority}
                    </Badge>
                    <Badge size="sm" variant="light">
                      {project.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Owner: {project.owner}
                  </Text>
                </Card.Section>

                <Card.Section withBorder inheritPadding py="md">
                  <Stack gap="md">
                    {project.pods.map((pod, idx) => {
                      const color = POD_COLORS[idx % POD_COLORS.length];
                      const startPos = (pod.startMonth / 12) * 100;
                      const width = ((pod.endMonth - pod.startMonth) / 12) * 100;

                      return (
                        <div key={pod.podId}>
                          <Group justify="space-between" mb="4px">
                            <Text size="sm" fw={600}>
                              {pod.podName}
                            </Text>
                            <Badge size="xs" variant="light">
                              {pod.tshirtSize}
                            </Badge>
                          </Group>
                          <Box
                            style={{
                              position: 'relative',
                              height: '24px',
                              backgroundColor: '#e9ecef',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}
                          >
                            <Tooltip
                              label={`M${pod.startMonth + 1} - M${Math.min(
                                pod.endMonth,
                                12
                              )}`}
                              position="top"
                            >
                              <Box
                                style={{
                                  position: 'absolute',
                                  left: `${startPos}%`,
                                  width: `${Math.min(width, 100 - startPos)}%`,
                                  height: '100%',
                                  backgroundColor: color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: 'white',
                                }}
                              />
                            </Tooltip>
                          </Box>
                        </div>
                      );
                    })}
                  </Stack>
                </Card.Section>

                <Card.Section inheritPadding py="md" style={{ backgroundColor: '#f8f9fa' }}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {project.pods.length}
                      </Text>
                      <Text size="sm" c="dimmed">
                        PODs
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {concurrentMonths}
                      </Text>
                      <Text size="sm" c="dimmed">
                        concurrent
                      </Text>
                    </Group>
                  </Group>
                </Card.Section>
              </Card>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
