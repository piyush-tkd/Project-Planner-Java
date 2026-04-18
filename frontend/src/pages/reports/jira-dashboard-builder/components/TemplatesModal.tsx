import { Modal, Stack, Paper, Group, Text, Badge } from '@mantine/core';
import { DASHBOARD_TEMPLATES } from '../state/constants';
import { AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY, SHADOW } from '../../../../brandTokens';

interface TemplatesModalProps {
  opened: boolean;
  onClose: () => void;
  onLoadTemplate: (template: typeof DASHBOARD_TEMPLATES[0]) => void;
}

export function TemplatesModal({ opened, onClose, onLoadTemplate }: TemplatesModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Dashboard Templates</Text>}
      size="lg"
    >
      <Stack gap="md">
        {DASHBOARD_TEMPLATES.map(template => (
          <Paper
            key={template.id}
            withBorder
            radius="md"
            p="md"
            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = AQUA_HEX;
              e.currentTarget.style.boxShadow = SHADOW.md;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.boxShadow = '';
            }}
            onClick={() => onLoadTemplate(template)}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>
                  {template.name}
                </Text>
                <Text size="sm" c="dimmed">
                  {template.description}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">
                  {template.widgets.length} widgets
                </Text>
              </div>
              <Badge size="sm" variant="light">
                {template.widgets.length}
              </Badge>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Modal>
  );
}
