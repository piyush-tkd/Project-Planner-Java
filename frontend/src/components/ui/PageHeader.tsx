import React from 'react';
import { Title, Text, Group, Stack } from '@mantine/core';
import { DEEP_BLUE, GRAY_200, GRAY_400, TEXT_SECONDARY} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const dark = useDarkMode();

  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
      <Stack gap={4}>
        <Title
          order={2}
          style={{
            fontWeight: 700,
            color: dark ? GRAY_200 : DEEP_BLUE
          }}
        >
          {title}
        </Title>
        {subtitle && (
          <Text
            size="sm"
            style={{ color: dark ? GRAY_400 : TEXT_SECONDARY }}
          >
            {subtitle}
          </Text>
        )}
      </Stack>

      {actions && (
        <Group gap="sm" style={{ flexShrink: 0 }}>
          {actions}
        </Group>
      )}
    </Group>
  );
}
