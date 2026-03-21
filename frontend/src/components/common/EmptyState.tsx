import { ReactNode } from 'react';
import { Box, ThemeIcon, Text, Button, Stack, Group } from '@mantine/core';
import { IconMoodEmpty } from '@tabler/icons-react';
import { AQUA, FONT_FAMILY } from '../../brandTokens';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon = <IconMoodEmpty size={40} />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Box
      p="xl"
      style={{
        border: '2px dashed var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
      }}
    >
      <Stack align="center" gap="md">
        <ThemeIcon size={64} variant="light" color="gray" radius="md">
          {icon}
        </ThemeIcon>
        <Text
          size="sm"
          fw={600}
          c="dimmed"
          style={{ fontFamily: FONT_FAMILY }}
        >
          {title}
        </Text>
        {description && (
          <Text
            size="xs"
            c="dimmed"
            style={{ fontFamily: FONT_FAMILY }}
          >
            {description}
          </Text>
        )}
        {action && (
          <Button
            color={AQUA}
            size="sm"
            onClick={action.onClick}
            style={{ fontFamily: FONT_FAMILY }}
          >
            {action.label}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
