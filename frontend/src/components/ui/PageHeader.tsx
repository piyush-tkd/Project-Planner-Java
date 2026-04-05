import React from 'react';
import { Title, Text, Group, Stack } from '@mantine/core';
import { DEEP_BLUE, FONT_FAMILY, TEXT_SECONDARY } from '../../brandTokens';
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
            fontFamily: FONT_FAMILY,
            fontWeight: 700,
            color: dark ? '#e0e0e0' : DEEP_BLUE,
          }}
        >
          {title}
        </Title>
        {subtitle && (
          <Text
            size="sm"
            style={{ color: dark ? '#9ca3af' : TEXT_SECONDARY }}
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
