import { Group, Badge, ActionIcon, Text } from '@mantine/core';
import { IconX, IconFilter } from '@tabler/icons-react';

export interface FilterPill {
  key: string;
  label: string;
  color?: string;
  onRemove: () => void;
}

interface FilterPillsProps {
  pills: FilterPill[];
  onClearAll?: () => void;
}

/**
 * Renders a row of dismissible filter badge pills.
 * Shows nothing when pills array is empty.
 */
export default function FilterPills({ pills, onClearAll }: FilterPillsProps) {
  if (pills.length === 0) return null;

  return (
    <Group gap={6} align="center" wrap="wrap">
      <IconFilter size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
      {pills.map(pill => (
        <Badge
          key={pill.key}
          color={pill.color ?? 'blue'}
          variant="light"
          size="sm"
          style={{ paddingRight: 4, cursor: 'default' }}
          rightSection={
            <ActionIcon
              size={14}
              color={pill.color ?? 'blue'}
              variant="transparent"
              onClick={pill.onRemove}
              aria-label={`Remove ${pill.label} filter`}
              style={{ marginLeft: 2 }}
            >
              <IconX size={10} />
            </ActionIcon>
          }
        >
          {pill.label}
        </Badge>
      ))}
      {onClearAll && pills.length > 1 && (
        <Text
          size="xs"
          c="dimmed"
          style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
          onClick={onClearAll}
        >
          Clear all
        </Text>
      )}
    </Group>
  );
}
