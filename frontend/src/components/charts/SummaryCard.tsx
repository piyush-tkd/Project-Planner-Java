import { Card, Text, Group } from '@mantine/core';
import { type ReactNode } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { AQUA, AQUA_HEX, COLOR_ERROR, COLOR_GREEN_LIGHT, DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

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
  /** Trend indicator: positive or negative percentage change */
  trend?: string;
  /** Override the label shown when active (default: '✓ Filtered'). Pass null to suppress. */
  filterLabel?: string | null;
}

export default function SummaryCard({
  title, value, icon, color, onClick, active, sparkData, trend, filterLabel,
}: SummaryCardProps) {
  const clickable = !!onClick;
  const trendColor = trend?.startsWith('+') ? COLOR_GREEN_LIGHT : COLOR_ERROR;

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius={16}
      withBorder
      onClick={onClick}
      className="kpi-card-modern"
      style={{
        cursor: clickable ? 'pointer' : 'default',
        borderColor: active ? AQUA : (clickable ? 'transparent' : undefined),
        borderWidth: active ? 2 : 1,
        backgroundColor: active ? `${AQUA}12` : undefined,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        ...(clickable
          ? { boxShadow: active ? `0 0 0 1px ${AQUA}33, 0 8px 24px ${AQUA}15` : undefined }
          : {}),
      }}
    >
      {/* Background gradient overlay based on icon color */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: color
            ? `radial-gradient(ellipse at top right, ${color}10 0%, transparent 60%)`
            : undefined,
          pointerEvents: 'none',
        }}
      />
      <Group justify="space-between" mb="xs" style={{ position: 'relative', zIndex: 1 }}>
        <Text
          size="sm"
          c={active ? DEEP_BLUE : 'dimmed'}
          fw={active ? 700 : 600}
          style={{ fontFamily: FONT_FAMILY, letterSpacing: '-0.01em' }}
        >
          {title}
        </Text>
        <span style={{
          opacity: active ? 1 : 0.7,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}>{icon}</span>
      </Group>
      <Group justify="space-between" align="flex-end" gap="xs" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <Text
            size="xl"
            fw={800}
            c={color ?? (active ? DEEP_BLUE : undefined)}
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              animation: 'countUp 0.6s ease-out',
            }}
          >
            {value}
          </Text>
          {trend && (
            <Group gap={4} mt={6}>
              {trend.startsWith('+') ? (
                <IconArrowUp size={14} color={trendColor} />
              ) : (
                <IconArrowDown size={14} color={trendColor} />
              )}
              <span style={{
                color: trendColor,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: FONT_FAMILY,
              }}>
                {trend}
              </span>
            </Group>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ height: 36, width: 80, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sparkData.map((v, i) => ({ x: i, y: v }))}
                  margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                >
                  <Line
                    type="monotone"
                    dataKey="y"
                    stroke={AQUA_HEX}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: sparkData[sparkData.length - 1] >= sparkData[0] ? COLOR_GREEN_LIGHT : COLOR_ERROR,
                flexShrink: 0,
                boxShadow: `0 0 6px ${sparkData[sparkData.length - 1] >= sparkData[0] ? '#51cf6660' : '#fa525260'}`,
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </Group>
      {clickable && filterLabel !== null && (
        <Text
          size="xs"
          mt={8}
          style={{
            color: active ? AQUA : 'transparent',
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            letterSpacing: '0.04em',
            fontSize: 10,
            textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}
        >
          {active ? (filterLabel ?? '✓ Filtered') : 'Click to filter'}
        </Text>
      )}
    </Card>
  );
}
