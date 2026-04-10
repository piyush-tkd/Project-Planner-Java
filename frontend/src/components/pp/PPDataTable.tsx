import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Popover,
  Checkbox,
  ActionIcon,
  Text,
} from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import styles from './PPDataTable.module.css';

export interface PPColumn<T = Record<string, unknown>> {
  /** Unique key matching data field */
  key: string;
  /** Column header label */
  label: string;
  /** Column width */
  width?: number | string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Custom render function */
  render?: (row: T, index: number) => React.ReactNode;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether column is visible by default */
  defaultVisible?: boolean;
}

export interface PPDataTableEmptyState {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface PPDataTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: PPColumn<T>[];
  /** Data rows */
  data: T[];
  /** Field in T used as the row key */
  rowKey: keyof T;
  /** Whether to show loading skeleton */
  loading?: boolean;
  /** Number of skeleton rows (default 5) */
  skeletonRows?: number;
  /** Empty state shown when data=[] and not loading */
  emptyState?: PPDataTableEmptyState;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Whether to show column visibility toggle */
  showColumnToggle?: boolean;
  /** Current sort field */
  sortBy?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort change handler */
  onSort?: (key: string) => void;
  /** Optional toolbar content (left side) */
  toolbar?: React.ReactNode;
  /** Show row count in footer */
  showRowCount?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Max height for the table scroll area */
  maxHeight?: string | number;
}

/** Skeleton loading rows */
function SkeletonRows({
  rows,
  cols,
}: {
  rows: number;
  cols: number;
}) {
  const widths = [40, 20, 30, 25, 35, 20];
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className={styles.skeletonRow}>
          {Array.from({ length: cols }).map((_, ci) => (
            <div
              key={ci}
              className={styles.skeletonCell}
              style={{ flex: widths[ci % widths.length], minWidth: 40 }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * PPDataTable — opinionated data table with PP design language (DL-5).
 *
 * Provides: styled headers, hover row tinting, sort indicators,
 * column visibility toggle, skeleton loading, empty state, and row count.
 */
export function PPDataTable<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  showColumnToggle = false,
  sortBy,
  sortDirection = 'asc',
  onSort,
  toolbar,
  showRowCount = false,
  stickyHeader = true,
  maxHeight,
}: PPDataTableProps<T>) {
  // Column visibility state — default to each column's defaultVisible (true if omitted)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    () =>
      new Set(
        columns
          .filter((c) => c.defaultVisible !== false)
          .map((c) => c.key),
      ),
  );

  const visibleCols = useMemo(
    () => columns.filter((c) => visibleKeys.has(c.key)),
    [columns, visibleKeys],
  );

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasToolbar = toolbar || showColumnToggle;

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      {hasToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>{toolbar}</div>
          {showColumnToggle && (
            <Popover position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <ActionIcon variant="subtle" size="sm" aria-label="Toggle columns">
                  <IconSettings size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <div className={styles.columnToggleList}>
                  {columns.map((col) => (
                    <Checkbox
                      key={col.key}
                      label={col.label}
                      checked={visibleKeys.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      size="xs"
                    />
                  ))}
                </div>
              </Popover.Dropdown>
            </Popover>
          )}
        </div>
      )}

      {/* Table scroll area */}
      <div
        className={styles.tableScroll}
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {loading ? (
          <SkeletonRows rows={skeletonRows} cols={visibleCols.length} />
        ) : data.length === 0 && emptyState ? (
          <div className={styles.emptyState}>
            <emptyState.icon size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>{emptyState.title}</p>
            <p className={styles.emptyDesc}>{emptyState.description}</p>
            {emptyState.actionLabel && emptyState.onAction && (
              <Button size="xs" variant="light" onClick={emptyState.onAction}>
                {emptyState.actionLabel}
              </Button>
            )}
          </div>
        ) : (
          <Table highlightOnHover={false}>
            <Table.Thead
              className={styles.thead}
              style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 1 } : undefined}
            >
              <Table.Tr>
                {visibleCols.map((col) => {
                  const isActiveSort = sortBy === col.key;
                  return (
                    <Table.Th
                      key={col.key}
                      className={[
                        styles.th,
                        col.sortable ? styles.thSortable : '',
                        isActiveSort ? styles.thActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        width: col.width,
                        textAlign: col.align ?? 'left',
                      }}
                      onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && isActiveSort && (
                        <span className={styles.sortIcon}>
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((row, ri) => (
                <Table.Tr
                  key={String(row[rowKey])}
                  className={[
                    styles.tr,
                    onRowClick ? styles.trClickable : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {visibleCols.map((col) => (
                    <Table.Td
                      key={col.key}
                      className={styles.td}
                      style={{ textAlign: col.align ?? 'left' }}
                    >
                      {col.render
                        ? col.render(row, ri)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>

      {/* Footer row count */}
      {showRowCount && !loading && (
        <div className={styles.footer}>
          <Text size="xs" c="dimmed">
            {data.length} {data.length === 1 ? 'item' : 'items'}
          </Text>
        </div>
      )}
    </div>
  );
}

export default PPDataTable;
