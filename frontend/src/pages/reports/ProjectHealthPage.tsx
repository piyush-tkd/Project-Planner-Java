import React, { useMemo, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Table,
  Badge,
  Group,
  Stack,
  SegmentedControl,
  MultiSelect,
  Box,
  Tooltip,
  ThemeIcon,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../api/projects';
import { useProjectPodMatrix } from '../../api/projects';
import { useUtilizationHeatmap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';

interface ProjectResponse {
  id: number;
  name: string;
  priority: string;
  owner: string;
  startMonth: number;
  targetEndMonth: number;
  durationMonths: number;
  defaultPattern: string;
  status: string;
  notes: string | null;
  blockedById: number | null;
  targetDate: string | null;
  startDate: string | null;
}

interface PodMonthUtilization {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  utilizationPct: number;
  level: string;
}

interface ProjectHealthScore {
  projectId: number;
  projectName: string;
  priority: string;
  status: string;
  owner: string;
  startMonth: number;
  durationMonths: number;
  blockedById: number | null;
  pods: string[];
  score: number;
  level: 'Healthy' | 'At Risk' | 'Critical';
  riskFactors: string[];
}

type SortBy = 'score' | 'name' | 'priority';

const getPriorityColor = (priority: string) => {
  const lower = priority.toLowerCase();
  if (lower === 'critical') return 'red';
  if (lower === 'high') return 'orange';
  if (lower === 'medium') return 'yellow';
  return 'blue';
};

const getHealthColor = (level: 'Healthy' | 'At Risk' | 'Critical') => {
  if (level === 'Healthy') return '#51CF66';
  if (level === 'At Risk') return '#FFD43B';
  return '#FF6B6B';
};

export default function ProjectHealthPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: projectPodMatrix, isLoading: podsLoading } = useProjectPodMatrix();
  const { data: heatmapData, isLoading: heatmapLoading } = useUtilizationHeatmap();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const isLoading = projectsLoading || podsLoading || heatmapLoading;

  const { healthScores, statusOptions } = useMemo(() => {
    if (!projects || !projectPodMatrix || !heatmapData) {
      return { healthScores: [], statusOptions: [] };
    }

    const statusSet = new Set<string>();
    const scoreMap: Record<number, ProjectHealthScore> = {};

    // Initialize scores for each project
    projects.forEach((project) => {
      statusSet.add(project.status);

      const isInCurrentMonth =
        currentMonthIndex >= project.startMonth &&
        currentMonthIndex < project.startMonth + project.durationMonths;

      let score = 0;
      const riskFactors: string[] = [];

      // +40 if status=ACTIVE
      if (project.status.toUpperCase() === 'ACTIVE') {
        score += 40;
      } else {
        riskFactors.push('Inactive');
      }

      // +20 if not blocked
      if (!project.blockedById) {
        score += 20;
      } else {
        riskFactors.push('Blocked');
      }

      // +20 if in current month
      if (isInCurrentMonth) {
        score += 20;
      } else {
        riskFactors.push('Not in current period');
      }

      // Find assigned PODs
      const assignedPods = projectPodMatrix
        .filter((p) => p.projectId === project.id)
        .map((p) => p.podName);

      // +20 if all PODs have <95% utilization in current month
      const overloadedPods = heatmapData.filter(
        (h) =>
          h.monthIndex === currentMonthIndex &&
          assignedPods.includes(h.podName) &&
          h.utilizationPct >= 95
      );

      if (overloadedPods.length === 0) {
        score += 20;
      } else {
        riskFactors.push(`${overloadedPods.length} POD(s) overloaded`);
      }

      let level: 'Healthy' | 'At Risk' | 'Critical';
      if (score >= 80) {
        level = 'Healthy';
      } else if (score >= 60) {
        level = 'At Risk';
      } else {
        level = 'Critical';
      }

      scoreMap[project.id] = {
        projectId: project.id,
        projectName: project.name,
        priority: project.priority,
        status: project.status,
        owner: project.owner,
        startMonth: project.startMonth,
        durationMonths: project.durationMonths,
        blockedById: project.blockedById,
        pods: assignedPods,
        score,
        level,
        riskFactors,
      };
    });

    const scores = Object.values(scoreMap).sort((a, b) => {
      if (sortBy === 'score') {
        return a.score - b.score; // worst first
      }
      if (sortBy === 'name') {
        return a.projectName.localeCompare(b.projectName);
      }
      // priority
      const priorityOrder: Record<string, number> = {
        CRITICAL: 1,
        HIGH: 2,
        MEDIUM: 3,
        LOW: 4,
      };
      const aPriority = priorityOrder[a.priority.toUpperCase()] ?? 5;
      const bPriority = priorityOrder[b.priority.toUpperCase()] ?? 5;
      return aPriority - bPriority;
    });

    return {
      healthScores: scores,
      statusOptions: Array.from(statusSet).sort(),
    };
  }, [projects, projectPodMatrix, heatmapData, sortBy, currentMonthIndex]);

  const filteredScores = useMemo(() => {
    if (selectedStatuses.length === 0) return healthScores;
    return healthScores.filter((h) => selectedStatuses.includes(h.status));
  }, [healthScores, selectedStatuses]);

  if (isLoading) return <LoadingSpinner variant="cards" message="Loading project health..." />;

  const tableRows = filteredScores.map((health) => {
    const timelineStart = health.startMonth;
    const timelineEnd = Math.min(health.startMonth + health.durationMonths, 12);

    return (
      <Table.Tr
        key={health.projectId}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/projects/${health.projectId}`)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f8f9fa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Table.Td fw={600}>{health.projectName}</Table.Td>
        <Table.Td>
          <Badge size="sm" color={getPriorityColor(health.priority)}>
            {health.priority}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Badge size="sm" variant="light">
            {health.status}
          </Badge>
        </Table.Td>
        <Table.Td>{health.owner}</Table.Td>
        <Table.Td>
          <Tooltip label={`M${timelineStart + 1} - M${timelineEnd}`}>
            <Box
              style={{
                position: 'relative',
                height: '24px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <Box
                style={{
                  position: 'absolute',
                  left: `${(timelineStart / 12) * 100}%`,
                  width: `${((timelineEnd - timelineStart) / 12) * 100}%`,
                  height: '100%',
                  backgroundColor: AQUA,
                }}
              />
              <Box
                style={{
                  position: 'absolute',
                  left: `${(currentMonthIndex / 12) * 100}%`,
                  width: '2px',
                  height: '100%',
                  backgroundColor: DEEP_BLUE,
                }}
              />
            </Box>
          </Tooltip>
        </Table.Td>
        <Table.Td>
          <Group gap="4px">
            {health.pods.slice(0, 3).map((pod) => (
              <Badge key={pod} size="xs" variant="light">
                {pod}
              </Badge>
            ))}
            {health.pods.length > 3 && (
              <Badge size="xs" variant="light">
                +{health.pods.length - 3}
              </Badge>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <Tooltip label={health.level}>
            <Badge
              size="sm"
              color={getHealthColor(health.level)}
              leftSection={
                health.level === 'Healthy' ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />
              }
            >
              {health.score}
            </Badge>
          </Tooltip>
        </Table.Td>
        <Table.Td>
          <Text size="xs">
            {health.riskFactors.length > 0 ? (
              <Tooltip
                label={health.riskFactors.join(', ')}
                multiline
                w={200}
                position="top-end"
              >
                <Text c="orange" fw={500}>
                  {health.riskFactors.length} risk factor{health.riskFactors.length > 1 ? 's' : ''}
                </Text>
              </Tooltip>
            ) : (
              <Text c="green">—</Text>
            )}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Project Health Scorecard
          </Title>
          <Text c="dimmed" size="sm">
            Health assessment based on status, blocking, activity, and resource utilization
          </Text>
        </div>

        <Group justify="space-between" wrap="wrap">
          <SegmentedControl
            label="Sort by"
            value={sortBy}
            onChange={(value) => setSortBy(value as SortBy)}
            data={[
              { label: 'Health Score', value: 'score' },
              { label: 'Name', value: 'name' },
              { label: 'Priority', value: 'priority' },
            ]}
          />
          <MultiSelect
            label="Filter by status"
            placeholder="Select statuses..."
            data={statusOptions}
            value={selectedStatuses}
            onChange={setSelectedStatuses}
            searchable
            clearable
            style={{ flex: 1, maxWidth: '300px' }}
          />
        </Group>

        <div style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Project
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Priority
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Status
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Owner
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Timeline
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  PODs
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Health Score
                </Table.Th>
                <Table.Th style={{ backgroundColor: DEEP_BLUE, color: 'white' }}>
                  Risk Factors
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{tableRows}</Table.Tbody>
          </Table>
        </div>

        <Group justify="center" gap="xl" mt="lg">
          <Group gap="xs">
            <Box
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#51CF66',
                borderRadius: '4px',
              }}
            />
            <Text size="sm">Healthy (80+)</Text>
          </Group>
          <Group gap="xs">
            <Box
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#FFD43B',
                borderRadius: '4px',
              }}
            />
            <Text size="sm">At Risk (60-79)</Text>
          </Group>
          <Group gap="xs">
            <Box
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#FF6B6B',
                borderRadius: '4px',
              }}
            />
            <Text size="sm">Critical (&lt;60)</Text>
          </Group>
        </Group>
      </Stack>
    </Container>
  );
}
