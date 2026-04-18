import { Modal, Stack, Text, Alert, Group, Button } from '@mantine/core';
import { IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import type { ProjectResponse } from '../../../types';

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  deleteTarget: number[] | null;
  projects: ProjectResponse[] | undefined;
  isLoading: boolean;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  opened,
  onClose,
  deleteTarget,
  projects,
  isLoading,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTrash size={18} color="var(--mantine-color-red-6)" />
          <Text fw={600} c="red">
            {deleteTarget && deleteTarget.length > 1
              ? `Delete ${deleteTarget.length} Projects`
              : 'Delete Project'}
          </Text>
        </Group>
      }
      size="sm"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {deleteTarget && deleteTarget.length > 1 ? (
            <>
              You are about to permanently delete{' '}
              <Text span fw={700}>
                {deleteTarget.length} projects
              </Text>
              . This will also remove all associated POD assignments and planning data.
            </>
          ) : (
            <>
              You are about to permanently delete{' '}
              <Text span fw={700}>
                {deleteTarget && projects?.find(p => p.id === deleteTarget[0])?.name}
              </Text>
              . This will also remove all associated POD assignments and planning data.
            </>
          )}
        </Text>
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
          <Text size="xs">This action cannot be undone.</Text>
        </Alert>
        <Group justify="flex-end">
          <Button variant="light" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={onConfirm}
            loading={isLoading}
          >
            Delete{deleteTarget && deleteTarget.length > 1 ? ` ${deleteTarget.length} Projects` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
