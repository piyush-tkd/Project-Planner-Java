import { useState, useMemo } from 'react';
import { Paper, Group, Stack, Badge, Text, ActionIcon } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../../brandTokens';
import {
  ROLE_COLORS, LOCATION_COLORS, STATUS_COLORS, NLP_LIST_PAGE_SIZE,
} from '../constants';

export function NumberedItemList({
  data,
  onNavigate,
}: {
  data: Record<string, unknown>;
  onNavigate: (route: string, entityName?: string) => void;
}) {
  const [listPage, setListPage] = useState(1);

  const allItems = useMemo(() =>
    Object.entries(data)
      .filter(([k]) => /^#\d+$/.test(k))
      .sort(([a], [b]) => parseInt(a.slice(1)) - parseInt(b.slice(1))),
    [data]
  );
  if (allItems.length === 0) return null;

  const itemIds = Array.isArray(data._itemIds) ? (data._itemIds as number[]) : [];
  const itemType = typeof data._itemType === 'string' ? data._itemType : null;
  const totalPages = Math.ceil(allItems.length / NLP_LIST_PAGE_SIZE);
  const startIdx = (listPage - 1) * NLP_LIST_PAGE_SIZE;
  const pageItems = allItems.slice(startIdx, startIdx + NLP_LIST_PAGE_SIZE);

  const getItemRoute = (index: number): string | null => {
    if (!itemType || index >= itemIds.length) return null;
    const id = itemIds[index];
    switch (itemType) {
      case 'PROJECT': return `/projects/${id}`;
      case 'POD': return `/pods/${id}`;
      case 'RESOURCE': return `/resources?highlight=${id}`;
      default: return null;
    }
  };

  return (
    <Stack gap={4}>
      {pageItems.map(([key, val], idx) => {
        const globalIdx = startIdx + idx;
        const text = String(val);
        const match = text.match(/^(.+?)(?:\s*\[(.+?)\])?\s*(?:—|–|-)\s*(.+)$/);
        const name = match ? match[1].trim() : text;
        const priority = match ? match[2] : null;
        const rest = match ? match[3].trim() : null;
        const statusMatch = rest?.match(/^(Active|Completed|In Discovery|Not Started|On Hold|Cancelled)/);
        const status = statusMatch ? statusMatch[1] : null;
        const extra = status && rest ? rest.slice(status.length).replace(/^\s*\(?/, '').replace(/\)?\s*$/, '').trim() : rest;
        const statusColor = STATUS_COLORS[status ?? ''] ?? 'gray';
        const parts = rest?.split(/\s*·\s*/) ?? [];
        const detectedRole = parts.find(p => Object.keys(ROLE_COLORS).includes(p.trim())) ?? null;
        const detectedLocation = parts.find(p => Object.keys(LOCATION_COLORS).includes(p.trim())) ?? null;
        const route = getItemRoute(globalIdx);
        const isClickable = !!route;

        return (
          <Paper
            key={key}
            px="sm"
            py={8}
            radius="md"
            withBorder
            className={`nlp-list-item nlp-stagger-item`}
            onClick={isClickable ? () => onNavigate(route!, name) : undefined}
            style={{
              borderLeft: `3px solid ${AQUA}`,
              cursor: isClickable ? 'pointer' : 'default',
              animationDelay: `${idx * 50}ms`,
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={700} c="dimmed" style={{ fontFamily: FONT_FAMILY, flexShrink: 0 }}>
                  {key.slice(1)}
                </Text>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={600} truncate style={{ fontFamily: FONT_FAMILY, color: isClickable ? DEEP_BLUE : undefined }}>
                    {name}
                  </Text>
                  {extra && (
                    <Text size="xs" c="dimmed" truncate style={{ fontFamily: FONT_FAMILY }}>
                      {extra}
                    </Text>
                  )}
                </div>
              </Group>
              <Group gap={6} style={{ flexShrink: 0 }}>
                {priority && (
                  <Badge
                    variant="light"
                    size="xs"
                    radius="sm"
                    color={priority === 'HIGHEST' || priority === 'BLOCKER' ? 'red' : priority === 'HIGH' ? 'orange' : 'blue'}
                    style={{ fontFamily: FONT_FAMILY }}
                  >
                    {priority}
                  </Badge>
                )}
                {status && (
                  <Badge
                    variant="light"
                    size="xs"
                    radius="sm"
                    color={statusColor}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}
                  >
                    {status}
                  </Badge>
                )}
                {detectedRole && (
                  <Badge
                    variant="light"
                    size="xs"
                    radius="sm"
                    color={ROLE_COLORS[detectedRole] ?? 'gray'}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}
                  >
                    {detectedRole}
                  </Badge>
                )}
                {detectedLocation && (
                  <Badge
                    variant="light"
                    size="xs"
                    radius="sm"
                    color={LOCATION_COLORS[detectedLocation] ?? 'gray'}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}
                  >
                    {detectedLocation}
                  </Badge>
                )}
                {isClickable && (
                  <IconChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                )}
              </Group>
            </Group>
          </Paper>
        );
      })}

      {totalPages > 1 && (
        <Group justify="space-between" mt={4}>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            {startIdx + 1}–{Math.min(startIdx + NLP_LIST_PAGE_SIZE, allItems.length)} of {allItems.length} items
          </Text>
          <Group gap={4}>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              disabled={listPage <= 1}
              onClick={() => setListPage(p => p - 1)}
              aria-label="Previous page"
            >
              <IconChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
            </ActionIcon>
            <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>
              {listPage}/{totalPages}
            </Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              disabled={listPage >= totalPages}
              onClick={() => setListPage(p => p + 1)}
              aria-label="Next page"
            >
              <IconChevronRight size={12} />
            </ActionIcon>
          </Group>
        </Group>
      )}
    </Stack>
  );
}
