import { Modal, Stack, TextInput, Textarea, Button, Text } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { DEEP_BLUE_HEX, FONT_FAMILY } from '../../../../brandTokens';

interface SaveDashboardModalProps {
  opened: boolean;
  dashName: string;
  dashDesc: string;
  dashId: number | null;
  isLoading?: boolean;
  onClose: () => void;
  onSave: () => void;
  onNameChange: (name: string) => void;
  onDescChange: (desc: string) => void;
}

export function SaveDashboardModal({
  opened,
  dashName,
  dashDesc,
  dashId,
  isLoading,
  onClose,
  onSave,
  onNameChange,
  onDescChange,
}: SaveDashboardModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Save Dashboard</Text>}
    >
      <Stack gap="md">
        <TextInput
          label="Dashboard Name"
          value={dashName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="My Custom Dashboard"
        />
        <Textarea
          label="Description (optional)"
          value={dashDesc}
          onChange={e => onDescChange(e.target.value)}
          placeholder="What this dashboard tracks..."
        />
        <Button
          loading={isLoading}
          onClick={onSave}
          leftSection={<IconDeviceFloppy size={14} />}
        >
          {dashId ? 'Update Dashboard' : 'Create Dashboard'}
        </Button>
      </Stack>
    </Modal>
  );
}
