import React from 'react';
import { Paper, Text, Group, Stack } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import { FONT_FAMILY, TEXT_SECONDARY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: string;
}

const TREND_CONFIG = {
  up:   { Icon: IconTrendingUp,   color: '#16a34a' }, // green-600
  down: { Icon: IconTrendingDown, color: '#dc2626' }, // red-600
  flat: { Icon: IconMinus,        color: '#9ca3af' }, // gray-400
};

export default function KpiCard({
  label,
  value,
  trend,
  trendValue,
  color = 'blue',
}: KpiCardProps) {
  const dark = useDarkMode();
  const trendConfig = trend ? TREND_CONFIG[trend] : null;

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{
        background: dark ? 'rgba(255,255,255,0.04)' : '#ffffff',
        borderColor: dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
      }}
    >
      <Stack gap={6}>
        <Text
          size="xs"
          fw={500}
          tt="uppercase"
          style={{
            color: dark ? '#9ca3af' : TEXT_SECONDARY,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </Text>

        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Text
            size="xl"
            fw={700}
            style={{
              fontFamily: FONT_FAMILY,
              color: dark ? '#e0e0e0' : '#111827',
              lineHeight: 1,
            }}
          >
            {value}
          </Text>

          {trendConfig && (
            <Group gap={4} align="center" style={{ flexShrink: 0 }}>
              <trendConfig.Icon
                size={16}
                stroke={2}
                style={{ color: trendConfig.color }}
              />
              {trendValue && (
                <Text
                  size="xs"
                  fw={600}
                  style={{ color: trendConfig.color, fontFamily: FONT_FAMILY }}
                >
                  {trendValue}
                </Text>
              )}
            </Group>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
