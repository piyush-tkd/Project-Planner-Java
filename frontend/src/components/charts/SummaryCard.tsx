import { Card, Text, Group } from '@mantine/core';
import { type ReactNode } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  /** When provided the card becomes a clickable filter chip */
  onClick?: () => void;
  /** Highlights the card as the currently-active filter */
  active?: boolean;
  /** Mini sparkline data points */
  sparkData?: number[];
}

export default function SummaryCard({
  title, value, icon, color, onClick, active, sparkData,
}: SummaryCardProps) {
  const clickable = !!onClick;

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      onClick={onClick}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        borderColor: active ? DEEP_BLUE : (clickable ? 'transparent' : undefined),
        borderWidth: active ? 2 : 1,
        backgroundColor: active ? `${AQUA}12` : undefined,
        transition: 'box-shadow 0.15s ease, transform 0.1s ease, border-color 0.15s ease',
        userSelect: 'none',
        ...(clickable
          ? { boxShadow: active ? `0 0 0 1px ${DEEP_BLUE}33` : undefined }
          : {}),
      }}
      onMouseEnter={e => {
        if (clickable && !active) {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLElement).style.borderColor = `${AQUA}80`;
        }
      }}
      onMouseLeave={e => {
        if (clickable && !active) {
          (e.currentTarget as HTMLElement).style.boxShadow = '';
          (e.currentTarget as HTMLElement).style.transform = '';
          (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
        }
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text
          size="sm"
          c={active ? DEEP_BLUE : 'dimmed'}
          fw={active ? 700 : 500}
          style={{ fontFamily: FONT_FAMILY }}
        >
          {title}
        </Text>
        <span style={{ opacity: active ? 1 : 0.8 }}>{icon}</span>
      </Group>
      <Group justify="space-between" align="flex-end" gap="xs">
        <Text
          size="xl"
          fw={700}
          c={color ?? (active ? DEEP_BLUE : undefined)}
          style={{ fontFamily: FONT_FAMILY }}
        >
          {value}
        </Text>
        {sparkData && sparkData.length > 1 && (
          <div style={{ height: 20, width: 50, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sparkData.map((v, i) => ({ x: i, y: v }))}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke={AQUA}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Group>
      {clickable && (
        <Text
          size="xs"
          mt={6}
          style={{
            color: active ? AQUA : 'transparent',
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            letterSpacing: '0.04em',
            fontSize: 10,
            textTransform: 'uppercase',
            transition: 'color 0.15s',
          }}
        >
          {active ? '✓ Filtered' : 'Click to filter'}
        </Text>
      )}
    </Card>
  );
}
