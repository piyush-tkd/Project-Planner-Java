import { useState } from 'react';
import {
  Modal, Stack, Text, TextInput, Button, Group, Alert, Code,
} from '@mantine/core';
import { IconTicket, IconAlertCircle } from '@tabler/icons-react';
import { FONT_FAMILY } from '../../brandTokens';
import { usePushToJira } from '../../hooks/useJiraEpicSync';
import type { ProjectResponse } from '../../types/project';

interface Props {
  project: ProjectResponse;
  opened: boolean;
  onClose: () => void;
  /** Default Jira project key to pre-fill (e.g. from org settings) */
  defaultJiraProjectKey?: string;
}

export default function PushToJiraModal({
  project,
  opened,
  onClose,
  defaultJiraProjectKey = '',
}: Props) {
  const [jiraProjectKey, setJiraProjectKey] = useState(defaultJiraProjectKey);
  const { pushToJira, pushing } = usePushToJira({
    onSuccess: () => onClose(),
  });

  const handleSubmit = async () => {
    if (!jiraProjectKey.trim()) return;
    await pushToJira(project.id, jiraProjectKey.trim().toUpperCase());
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTicket size={18} color="#0052CC" />
          <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>
            Create in Jira
          </Text>
        </Group>
      }
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          This will create a new <strong>Epic</strong> in Jira for:
        </Text>

        <Alert
          color="blue"
          variant="light"
          icon={<IconTicket size={16} />}
        >
          <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>
            {project.name}
          </Text>
          {project.notes && (
            <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
              {project.notes.slice(0, 120)}{project.notes.length > 120 ? '…' : ''}
            </Text>
          )}
        </Alert>

        <TextInput
          label="Jira Project Key"
          placeholder="e.g. PMO"
          description={
            <>
              The Jira project key for the epic. You can find this in your{' '}
              <a href="https://baylorgenetics.atlassian.net" target="_blank" rel="noreferrer">
                Jira project URL
              </a>.
            </>
          }
          value={jiraProjectKey}
          onChange={e => setJiraProjectKey(e.target.value.toUpperCase())}
          required
          rightSection={jiraProjectKey ? <Code>{jiraProjectKey}</Code> : null}
          styles={{ input: { fontFamily: FONT_FAMILY } }}
        />

        <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
          <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
            After pushing, this project's source will change to <strong>Pushed to Jira</strong>.
            The PP project stays as the source of truth for planning data;
            Jira owns delivery status.
          </Text>
        </Alert>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose} disabled={pushing}>
            Cancel
          </Button>
          <Button
            color="blue"
            leftSection={<IconTicket size={14} />}
            loading={pushing}
            disabled={!jiraProjectKey.trim()}
            onClick={handleSubmit}
          >
            Create Epic in Jira
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
