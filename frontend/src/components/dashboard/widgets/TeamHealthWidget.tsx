import React, { useMemo } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { WrikeCard } from './WrikeCard';
import { SURFACE_LIGHT, TEXT_GRAY, TEXT_SUBTLE } from '../../../brandTokens';
import { ProjectResponse } from '../../../types';

const STATUS_META: Record<string, { label: string; chart: string }> = {
  'In Progress': { label: 'In Progress',  chart: '#2DCCD3' },
  'Backlog':     { label: 'Backlog',       chart: '#818cf8' },
  'Done':        { label: 'Done',          chart: '#34d399' },
  'ON HOLD':     { label: 'ON HOLD',       chart: '#fbbf24' },
  'On Hold':     { label: 'On Hold',       chart: '#fbbf24' },
  'Cancelled':   { label: 'Cancelled',     chart: '#94a3b8' },
  'NOT_STARTED':  { label: 'Not Started',  chart: '#60a5fa' },
  'IN_DISCOVERY': { label: 'In Discovery', chart: '#a78bfa' },
  'ACTIVE':       { label: 'Active',        chart: '#6ee7b7' },
  'IN_PROGRESS':  { label: 'In Progress',  chart: '#2DCCD3' },
  'ON_HOLD':      { label: 'On Hold',       chart: '#fbbf24' },
  'COMPLETED':    { label: 'Completed',     chart: '#34d399' },
  'CANCELLED':    { label: 'Cancelled',     chart: '#94a3b8' },
};

interface TeamHealthWidgetProps {
  projects: ProjectResponse[];
  statusCounts: Array<{ name: string; value: number; color: string }>;
}

const TeamHealthWidget = React.memo(({ projects, statusCounts }: TeamHealthWidgetProps) => {
  const dark = useDarkMode();

  const byOwner = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    projects.forEach(p => {
      if (!map.has(p.owner)) map.set(p.owner, {});
      const entry = map.get(p.owner)!;
      entry[p.status] = (entry[p.status] ?? 0) + 1;
    });
    return Array.from(map.entries())
      .map(([owner, counts]) => ({ owner: owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' '), ...counts }))
      .sort((a, b) => {
        const aTotal = Object.values(a).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        const bTotal = Object.values(b).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        return bTotal - aTotal;
      })
      .slice(0, 6);
  }, [projects]);

  return (
    <WrikeCard title="Projects by Assignee" minH={260}>
      <Box p={20} pt={16}>
        <div role="img" aria-label="Bar chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byOwner} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={dark ? "rgba(255,255,255,0.06)" : SURFACE_LIGHT} />
            <XAxis type="number" fontSize={10} tick={{ fill: TEXT_SUBTLE }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="owner" width={90} fontSize={11} tick={{ fill: TEXT_GRAY }} axisLine={false} tickLine={false} />
            <Tooltip />
            {Object.keys(STATUS_META).map(s => (
              <Bar animationDuration={600} key={s} dataKey={s} stackId="a" fill={STATUS_META[s].chart}
                name={STATUS_META[s].label} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        </div>
        {/* Legend */}
        <Group gap={12} mt={12} wrap="wrap" justify="center">
          {statusCounts.map(s => (
            <Group key={s.name} gap={4} align="center">
              <Box style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <Text size="xs" c="dimmed">{s.name}</Text>
            </Group>
          ))}
        </Group>
      </Box>
    </WrikeCard>
  );
});

TeamHealthWidget.displayName = 'TeamHealthWidget';

export default TeamHealthWidget;
