import { Modal, Stack, Button, Text } from '@mantine/core';
import { DEEP_BLUE_TINTS, FONT_FAMILY } from '../../../../brandTokens';
import { AnalyticsBreakdown } from '../../../../api/jira';

interface DrillDownModalProps {
  opened: boolean;
  title: string;
  items: AnalyticsBreakdown[];
  limit: number;
  onClose: () => void;
  onShowMore: () => void;
}

export function DrillDownModal({
  opened,
  title,
  items,
  limit,
  onClose,
  onShowMore,
}: DrillDownModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="sm">{title}</Text>}
      size="lg"
      centered
      radius="lg"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Stack gap="xs">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Name</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Count</th>
              {items[0]?.sp !== undefined && (
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>SP</th>
              )}
              {items[0]?.hours !== undefined && (
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Hours</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, limit).map((item, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
                <td style={{ padding: '5px 8px' }}>{item.name}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{item.count}</td>
                {item.sp !== undefined && (
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.sp}</td>
                )}
                {item.hours !== undefined && (
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.hours}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > limit && (
          <Button
            variant="light"
            size="xs"
            fullWidth
            onClick={onShowMore}
          >
            Show more ({items.length - limit} remaining)
          </Button>
        )}
        <Text size="xs" c="dimmed" ta="right">
          Showing {Math.min(limit, items.length)} of {items.length} items
        </Text>
      </Stack>
    </Modal>
  );
}
