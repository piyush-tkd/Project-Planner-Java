import { Paper, Box, Text } from '@mantine/core';

export function WrikeCard({ title, count, children, minH, onTitleClick }: {
  title: string; count?: number; children: React.ReactNode; minH?: number; onTitleClick?: () => void;
}) {
  return (
    <Paper
      withBorder
      radius="lg"
      p={0}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        boxShadow: '0 1px 4px rgba(12,35,64,0.06)',
        overflow: 'hidden',
        minHeight: minH,
      }}
    >
      <Box px={20} py={14}
        onClick={onTitleClick}
        style={{ borderBottom: '1px solid var(--pp-border)', cursor: onTitleClick ? 'pointer' : 'default' }}>
        <Text fw={700} size="sm" style={{ color: 'var(--pp-text)' }}>
          {title}{count !== undefined && <Text component="span" c="dimmed" fw={400} ml={6}>({count})</Text>}
          {onTitleClick && <Text component="span" c="dimmed" fw={400} ml={6} size="xs">↗</Text>}
        </Text>
      </Box>
      <Box p={0}>{children}</Box>
    </Paper>
  );
}
