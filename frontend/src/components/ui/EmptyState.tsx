import React from 'react';
import { Stack, Title, Text, Button, Center, ThemeIcon } from '@mantine/core';
import { DARK_TEXT, GRAY_200, GRAY_400, TEXT_SECONDARY} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface EmptyStateProps {
  /** Pass a rendered icon element, e.g. <IconTag size={36} /> */
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  const dark = useDarkMode();

  return (
    <Center py={64}>
      <Stack align="center" gap="md" maw={420}>
        <ThemeIcon
          size={72}
          radius="xl"
          variant="light"
          color="gray"
        >
          {icon}
        </ThemeIcon>

        <Title
          order={3}
          ta="center"
          style={{
            fontWeight: 600,
            color: dark ? GRAY_200 : DARK_TEXT
          }}
        >
          {title}
        </Title>

        <Text
          size="sm"
          ta="center"
          style={{ color: dark ? GRAY_400 : TEXT_SECONDARY, lineHeight: 1.6 }}
        >
          {description}
        </Text>

        {actionLabel && onAction && (
          <Button variant="light" mt="xs" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Center>
  );
}
