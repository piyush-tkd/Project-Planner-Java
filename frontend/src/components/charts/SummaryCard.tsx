import { Card, Text, Group } from '@mantine/core';
import { type ReactNode } from 'react';

const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  /** When provided the card becomes a clickable filter chip */
  onClick?: () => void;
  /** Highlights the card as the currently-active filter */
  active?: boolean;
}

export default function SummaryCard({
  title, value, icon, color, onClick, active,
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
        backgroundColor: active ? `${AGUA}12` : undefined,
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
          (e.currentTarget as HTMLElement).style.borderColor = `${AGUA}80`;
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
          style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}
        >
          {title}
        </Text>
        <span style={{ opacity: active ? 1 : 0.8 }}>{icon}</span>
      </Group>
      <Text
        size="xl"
        fw={700}
        c={color ?? (active ? DEEP_BLUE : undefined)}
        style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}
      >
        {value}
      </Text>
      {clickable && (
        <Text
          size="xs"
          mt={6}
          style={{
            color: active ? AGUA : 'transparent',
            fontFamily: 'Barlow, system-ui, sans-serif',
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
