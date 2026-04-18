import { Group, Button, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

interface BulkActionBarProps {
  selectedCount: number;
  isDark: boolean;
  onDelete: () => void;
  onClearSelection: () => void;
}

export default function BulkActionBar(props: BulkActionBarProps) {
  const { selectedCount, isDark, onDelete, onClearSelection } = props;

  return (
    <Group
      gap="sm"
      p="xs"
      style={{
        background: isDark ? 'var(--mantine-color-dark-6)' : '#fff8f8',
        border: '1px solid var(--mantine-color-red-3)',
        borderRadius: 8,
      }}
    >
      <Text size="sm" fw={600} c="red">
        {selectedCount} project{selectedCount !== 1 ? 's' : ''} selected
      </Text>
      <Button
        size="xs"
        color="red"
        variant="light"
        leftSection={<IconTrash size={13} />}
        onClick={onDelete}
      >
        Delete selected
      </Button>
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        onClick={onClearSelection}
      >
        Clear selection
      </Button>
    </Group>
  );
}
