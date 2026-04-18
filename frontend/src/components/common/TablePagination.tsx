/**
 * TablePagination — Reusable client-side pagination component for data tables.
 *
 * Usage:
 *   const { paginatedData, ...paginationProps } = usePagination(filteredItems);
 *   // render paginatedData in your table
 *   <TablePagination {...paginationProps} />
 */
import { Group, Text, Select, ActionIcon } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { FONT_FAMILY } from '../../brandTokens';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
];

export default function TablePagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  return (
    <Group justify="space-between" mt="sm" px={4}>
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems}
        </Text>
      </Group>

      <Group gap="xs">
        <Select
          size="xs"
          value={String(pageSize)}
          onChange={(v) => v && onPageSizeChange(Number(v))}
          data={PAGE_SIZE_OPTIONS}
          withCheckIcon
          styles={{
            input: { width: 110, fontSize: 12 },
          }}
        />

        <Group gap={4}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <IconChevronsLeft size={14} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <IconChevronLeft size={14} />
          </ActionIcon>

          <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY, minWidth: 60, textAlign: 'center' }}>
            Page {page} of {totalPages}
          </Text>

          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <IconChevronRight size={14} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <IconChevronsRight size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Group>
  );
}
