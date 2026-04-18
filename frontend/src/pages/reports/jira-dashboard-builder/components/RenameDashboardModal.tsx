import { Modal, Stack, TextInput, Group, Button, Text } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { DEEP_BLUE_HEX, FONT_FAMILY } from '../../../../brandTokens';

interface RenameDashboardModalProps {
  opened: boolean;
  renameValue: string;
  onClose: () => void;
  onRename: (newName: string) => void;
  onValueChange: (value: string) => void;
}

export function RenameDashboardModal({
  opened, renameValue, onClose, onRename, onValueChange,
}: RenameDashboardModalProps) {
  const handleRename = () => {
    onRename(renameValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Rename Dashboard</Text>}
      size="sm"
    >
      <Stack gap="md">
        <TextInput
          label="Dashboard Name"
          value={renameValue}
          onChange={e => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="My Dashboard"
          autoFocus
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleRename}
            leftSection={<IconDeviceFloppy size={14} />}
          >
            Rename
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
