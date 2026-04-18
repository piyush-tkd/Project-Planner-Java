import { Paper, Group, Text, Button, ActionIcon, Transition, Box } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { ReactNode } from 'react';
import { DEEP_BLUE, AQUA } from '../../brandTokens';

interface BulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: Array<{
    label: string;
    icon: ReactNode;
    color?: string;
    onClick: () => void;
  }>;
}

export default function BulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  actions,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount;

  return (
    <Transition
      mounted={selectedCount > 0}
      transition="slide-up"
      duration={300}
      timingFunction="ease-out"
    >
      {styles => (
        <Box
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            ...styles,
          }}
        >
          <Paper
            shadow="lg"
            p="md"
            radius="md"
            style={{
              backgroundColor: DEEP_BLUE,
              margin: '1rem auto',
              maxWidth: '90%',
            }}
          >
            <Group gap="md" justify="center" align="center" wrap="wrap">
              {/* Left section: selection info */}
              <Group gap="sm" align="center">
                <Text c="white" fw={500} size="sm">
                  {selectedCount} selected
                </Text>
              </Group>

              {/* Middle section: select all option */}
              {!isAllSelected && (
                <Button
                  variant="subtle"
                  size="xs"
                  c={AQUA}
                  onClick={onSelectAll}
                >
                  Select all ({totalCount})
                </Button>
              )}

              {/* Action buttons */}
              {actions.map((action, idx) => (
                <Button
                  key={idx}
                  size="xs"
                  variant="light"
                  color={action.color || AQUA}
                  leftSection={action.icon}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}

              {/* Right section: clear button */}
              <ActionIcon
                color="white"
                variant="subtle"
                onClick={onClearSelection}
                title="Clear selection"
                aria-label="Close"
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        </Box>
      )}
    </Transition>
  );
}
