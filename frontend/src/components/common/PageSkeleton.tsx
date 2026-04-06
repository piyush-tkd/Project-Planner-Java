/**
 * PageSkeleton — Sprint 7 S7.6
 *
 * Renders appropriate skeleton loading states for different page types.
 * Replaces generic spinners with contextual loading placeholders.
 *
 * Variants:
 *   - dashboard: summary cards + two chart rows
 *   - table:     toolbar + paginated rows
 *   - chart:     single chart area with legend
 *   - detail:    header + tabs + content
 */
import { Skeleton, Stack, Group, SimpleGrid, Box } from '@mantine/core';

export type SkeletonVariant = 'dashboard' | 'table' | 'chart' | 'detail';

interface PageSkeletonProps {
  variant?: SkeletonVariant;
}

function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      {/* Summary cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[1, 2, 3, 4].map(i => (
          <Box key={i} p="md" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}>
            <Skeleton height={12} width="60%" radius="sm" mb={8} />
            <Skeleton height={28} width="40%" radius="sm" mb={6} />
            <Skeleton height={10} width="80%" radius="sm" />
          </Box>
        ))}
      </SimpleGrid>

      {/* Two chart rows */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {[1, 2].map(i => (
          <Box key={i} p="md" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}>
            <Skeleton height={12} width="50%" radius="sm" mb={12} />
            <Skeleton height={180} radius="md" />
          </Box>
        ))}
      </SimpleGrid>

      <Box p="md" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}>
        <Skeleton height={12} width="30%" radius="sm" mb={12} />
        <Skeleton height={120} radius="md" />
      </Box>
    </Stack>
  );
}

function TableSkeleton() {
  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between">
        <Group gap="sm">
          <Skeleton height={36} width={220} radius="md" />
          <Skeleton height={36} width={100} radius="md" />
        </Group>
        <Group gap="sm">
          <Skeleton height={36} width={120} radius="md" />
          <Skeleton height={36} width={120} radius="md" />
        </Group>
      </Group>

      {/* Table header */}
      <Group gap="md" px={4}>
        {[200, 100, 120, 100, 100, 90].map((w, i) => (
          <Skeleton key={i} height={12} width={w} radius="sm" />
        ))}
      </Group>

      {/* Table rows */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <Box key={i} style={{ borderBottom: '1px solid var(--mantine-color-gray-1)', paddingBottom: 10 }}>
          <Group gap="md" px={4}>
            {[200, 100, 120, 100, 100, 90].map((w, j) => (
              <Skeleton key={j} height={10} width={w + (i % 3 === 0 ? -20 : 0)} radius="sm" />
            ))}
          </Group>
        </Box>
      ))}

      {/* Pagination */}
      <Group justify="flex-end" gap="xs">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height={32} width={32} radius="md" />
        ))}
      </Group>
    </Stack>
  );
}

function ChartSkeleton() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={4}>
          <Skeleton height={18} width={200} radius="sm" />
          <Skeleton height={12} width={120} radius="sm" />
        </Stack>
        <Group gap="sm">
          <Skeleton height={32} width={100} radius="md" />
          <Skeleton height={32} width={100} radius="md" />
        </Group>
      </Group>

      {/* Chart area */}
      <Skeleton height={320} radius="md" />

      {/* Legend */}
      <Group gap="lg" justify="center">
        {[1, 2, 3, 4].map(i => (
          <Group key={i} gap="xs">
            <Skeleton height={12} width={12} radius="sm" />
            <Skeleton height={10} width={60} radius="sm" />
          </Group>
        ))}
      </Group>
    </Stack>
  );
}

function DetailSkeleton() {
  return (
    <Stack gap="md">
      {/* Page header */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={6}>
          <Skeleton height={24} width={300} radius="sm" />
          <Skeleton height={12} width={200} radius="sm" />
        </Stack>
        <Group gap="sm">
          <Skeleton height={36} width={120} radius="md" />
          <Skeleton height={36} width={100} radius="md" />
        </Group>
      </Group>

      {/* Tabs */}
      <Group gap={0} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }} pb={0}>
        {[100, 80, 120, 90, 110].map((w, i) => (
          <Box key={i} px="md" pb="sm">
            <Skeleton height={14} width={w} radius="sm" />
          </Box>
        ))}
      </Group>

      {/* Content area */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[1, 2, 3].map(i => (
          <Box key={i} p="md" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}>
            <Skeleton height={12} width="60%" radius="sm" mb={8} />
            <Skeleton height={20} width="40%" radius="sm" />
          </Box>
        ))}
      </SimpleGrid>

      <Box p="md" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 8 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Group key={i} justify="space-between" py={8}
            style={{ borderBottom: i < 5 ? '1px solid var(--mantine-color-gray-1)' : 'none' }}>
            <Skeleton height={10} width={`${30 + i * 8}%`} radius="sm" />
            <Skeleton height={10} width={60} radius="sm" />
          </Group>
        ))}
      </Box>
    </Stack>
  );
}

export default function PageSkeleton({ variant = 'table' }: PageSkeletonProps) {
  switch (variant) {
    case 'dashboard': return <DashboardSkeleton />;
    case 'chart':     return <ChartSkeleton />;
    case 'detail':    return <DetailSkeleton />;
    default:          return <TableSkeleton />;
  }
}
