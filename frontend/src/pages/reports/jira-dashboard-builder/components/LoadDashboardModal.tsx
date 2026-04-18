import { Modal, Stack, Button, Divider, Paper, Group, Text, Badge } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY } from '../../../../brandTokens';
import { JiraDashboardConfig } from '../../../../api/jira';

interface LoadDashboardModalProps {
  opened: boolean;
  dashboards: JiraDashboardConfig[];
  activeDashId: number | null;
  onClose: () => void;
  onNewDashboard: () => void;
  onLoadDashboard: (dashboard: JiraDashboardConfig) => void;
}

export function LoadDashboardModal({
  opened,
  dashboards,
  activeDashId,
  onClose,
  onNewDashboard,
  onLoadDashboard,
}: LoadDashboardModalProps) {
  const handleLoadAndClose = (dashboard: JiraDashboardConfig) => {
    onLoadDashboard(dashboard);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>My Dashboards</Text>}
    >
      <Stack gap="sm">
        <Button
          variant="light"
          color="teal"
          leftSection={<IconPlus size={14} />}
          onClick={onNewDashboard}
          fullWidth
        >
          New Blank Dashboard
        </Button>
        <Divider label="Saved dashboards" labelPosition="center" />
        {dashboards.map(d => (
          <Paper
            key={d.id}
            withBorder
            radius="md"
            p="sm"
            style={{
              cursor: 'pointer',
              borderLeft: d.id === activeDashId ? `3px solid ${AQUA_HEX}` : undefined,
            }}
            onClick={() => handleLoadAndClose(d)}
          >
            <Group justify="space-between">
              <div>
                <Text size="sm" fw={600}>
                  {d.name}
                </Text>
                {d.description && (
                  <Text size="xs" c="dimmed">
                    {d.description}
                  </Text>
                )}
              </div>
              <Group gap={4}>
                {d.isDefault && (
                  <Badge size="xs" variant="light" color="blue">
                    Default
                  </Badge>
                )}
                {d.id === activeDashId && (
                  <Badge size="xs" variant="light" color="teal">
                    Active
                  </Badge>
                )}
                <Text size="xs" c="dimmed">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </Text>
              </Group>
            </Group>
          </Paper>
        ))}
        {dashboards.length === 0 && (
          <Text c="dimmed" ta="center">
            No saved dashboards yet.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
