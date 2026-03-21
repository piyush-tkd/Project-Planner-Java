import React, { useMemo, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Table,
  MultiSelect,
  SegmentedControl,
  Stack,
  Group,
  Tooltip,
  Modal,
  Badge,
  Box,
  ThemeIcon,
  Accordion,
  Paper,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useResourceAllocation } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';

interface ResourceAllocationData {
  resourceId: number;
  resourceName: string;
  role: string;
  podName: string;
  monthIndex: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPct: number;
}

type SortBy = 'name' | 'peakUtil';

const getUtilizationColor = (pct: number) => {
  if (pct <= 50) return '#51CF66'; // green
  if (pct <= 80) return '#FFD43B'; // yellow
  if (pct <= 95) return '#FFA94D'; // orange
  return '#FF6B6B'; // red
};

const getUtilizationLevel = (pct: number) => {
  if (pct <= 50) return 'Healthy';
  if (pct <= 80) return 'Moderate';
  if (pct <= 95) return 'High';
  return 'Overloaded';
};

export default function ResourcePodMatrixPage() {
  const { data: allocations, isLoading, error } = useResourceAllocation();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    resourceName: string;
    resourceId: number;
    podName: string;
    monthIndex: number;
    allocatedHours: number;
    availableHours: number;
    utilizationPct: number;
  } | null>(null);

  const { groupedData, pods } = useMemo(() => {
    if (!allocations) return { groupedData: {}, pods: [] };

    const grouped: Record<string, ResourceAllocationData[]> = {};
    const podSet = new Set<string>();

    allocations.forEach((alloc) => {
      podSet.add(alloc.podName);
      if (!grouped[alloc.podName]) {
        grouped[alloc.podName] = [];
      }
      grouped[alloc.podName].push(alloc);
    });

    return {
      groupedData: grouped,
      pods: Array.from(podSet).sort(),
    };
  }, [allocations]);

  const filteredAndSorted = useMemo(() => {
    const result: Record<string, ResourceAllocationData[]> = {};

    const filter = selectedPods.length === 0 ? pods : selectedPods;

    filter.forEach((podName) => {
      if (groupedData[podName]) {
        let resources = [...groupedData[podName]];

        // Group by resource
        const byResource: Record<number, ResourceAllocationData[]> = {};
        resources.forEach((r) => {
          if (!byResource[r.resourceId]) {
            byResource[r.resourceId] = [];
          }
          byResource[r.resourceId].push(r);
        });

        const sorted = Object.values(byResource).map((group) => {
          const resource = group[0];
          if (sortBy === 'peakUtil') {
            const maxUtil = Math.max(...group.map((g) => g.utilizationPct));
            return { resource, maxUtil };
          }
          return { resource, maxUtil: 0 };
        });

        sorted.sort((a, b) => {
          if (sortBy === 'peakUtil') {
            return b.maxUtil - a.maxUtil;
          }
          return a.resource.resourceName.localeCompare(b.resource.resourceName);
        });

        result[podName] = sorted.map((s) => s.resource);
      }
    });

    return result;
  }, [groupedData, selectedPods, pods, sortBy]);

  if (isLoading) return <LoadingSpinner variant="table" message="Loading resource-POD matrix..." />;
  if (error) return <Text c="red">Error loading resource allocations</Text>;

  const tableRows = Object.entries(filteredAndSorted).flatMap(([podName, resources]) => {
    const getMonthData = (resourceId: number, monthIndex: number) => {
      const data = allocations?.find(
        (a) => a.resourceId === resourceId && a.monthIndex === monthIndex && a.podName === podName
      );
      return data;
    };

    return resources.map((resource) => (
      <Table.Tr key={`${resource.resourceId}-${podName}`}>
        <Table.Td
          style={{
            position: 'sticky',
            left: 0,
            backgroundColor: DEEP_BLUE,
            color: 'white',
            fontWeight: 600,
            zIndex: 1,
            minWidth: '140px',
          }}
        >
          {resource.resourceName}
        </Table.Td>
        <Table.Td
          style={{
            position: 'sticky',
            left: '140px',
            backgroundColor: DEEP_BLUE,
            color: 'white',
            fontWeight: 600,
            zIndex: 1,
            minWidth: '100px',
          }}
        >
          {podName}
        </Table.Td>
        {Array.from({ length: 12 }).map((_, i) => {
          const data = getMonthData(resource.resourceId, i);
          const isCurrentMonth = i === currentMonthIndex;
          const bgColor = isCurrentMonth ? AQUA : 'white';

          if (!data || data.utilizationPct === 0) {
            return (
              <Table.Td
                key={i}
                style={{
                  backgroundColor: bgColor,
                  textAlign: 'center',
                  color: '#999',
                  minWidth: '80px',
                }}
              >
                —
              </Table.Td>
            );
          }

          const cellColor = getUtilizationColor(data.utilizationPct);

          return (
            <Table.Td
              key={i}
              style={{
                backgroundColor: bgColor,
                textAlign: 'center',
                minWidth: '80px',
              }}
            >
              <Tooltip
                label={`${data.allocatedHours}h / ${data.availableHours}h`}
                position="top"
              >
                <Box
                  component="button"
                  onClick={() => {
                    setSelectedCell({
                      resourceName: resource.resourceName,
                      resourceId: resource.resourceId,
                      podName,
                      monthIndex: i,
                      allocatedHours: data.allocatedHours,
                      availableHours: data.availableHours,
                      utilizationPct: data.utilizationPct,
                    });
                    setModalOpen(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    backgroundColor: cellColor,
                    border: 'none',
                    cursor: 'pointer',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '12px',
                    width: '100%',
                  }}
                >
                  {data.utilizationPct}%
                </Box>
              </Tooltip>
            </Table.Td>
          );
        })}
      </Table.Tr>
    ));
  });

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Resource · POD Matrix
          </Title>
          <Text c="dimmed" size="sm">
            Resource allocation and utilization by POD across planning periods
          </Text>
        </div>

        <Group justify="space-between">
          <MultiSelect
            label="Filter by POD"
            placeholder="Select PODs..."
            data={pods}
            value={selectedPods}
            onChange={setSelectedPods}
            searchable
            clearable
            style={{ flex: 1, maxWidth: '300px' }}
          />
          <SegmentedControl
            label="Sort by"
            value={sortBy}
            onChange={(value) => setSortBy(value as SortBy)}
            data={[
              { label: 'Name', value: 'name' },
              { label: 'Peak Utilization', value: 'peakUtil' },
            ]}
          />
        </Group>

        <div style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    position: 'sticky',
                    left: 0,
                    backgroundColor: DEEP_BLUE,
                    color: 'white',
                    zIndex: 2,
                    minWidth: '140px',
                  }}
                >
                  Resource
                </Table.Th>
                <Table.Th
                  style={{
                    position: 'sticky',
                    left: '140px',
                    backgroundColor: DEEP_BLUE,
                    color: 'white',
                    zIndex: 2,
                    minWidth: '100px',
                  }}
                >
                  POD
                </Table.Th>
                {Array.from({ length: 12 }).map((_, i) => {
                  const isCurrentMonth = i === currentMonthIndex;
                  return (
                    <Table.Th
                      key={i}
                      style={{
                        backgroundColor: isCurrentMonth ? AQUA : DEEP_BLUE,
                        color: 'white',
                        textAlign: 'center',
                        minWidth: '80px',
                        fontWeight: 600,
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
        title={`${selectedCell?.resourceName} - ${selectedCell?.podName}`}
        size="sm"
      >
        {selectedCell && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed">
                Month
              </Text>
              <Text fw={600}>{monthLabels[selectedCell.monthIndex]}</Text>
            </div>

            <div>
              <Text size="sm" c="dimmed">
                Allocation
              </Text>
              <Text fw={600}>
                {selectedCell.allocatedHours}h / {selectedCell.availableHours}h
              </Text>
            </div>

            <div>
              <Text size="sm" c="dimmed">
                Utilization
              </Text>
              <Text fw={600}>{selectedCell.utilizationPct}%</Text>
              <Text size="sm" c={getUtilizationColor(selectedCell.utilizationPct)}>
                {getUtilizationLevel(selectedCell.utilizationPct)}
              </Text>
            </div>

            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Utilization Breakdown
              </Text>
              <Box
                style={{
                  display: 'flex',
                  height: '20px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <Box
                  style={{
                    width: `${selectedCell.utilizationPct}%`,
                    backgroundColor: getUtilizationColor(selectedCell.utilizationPct),
                  }}
                />
              </Box>
            </div>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
