import React, { useMemo } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { WrikeCard } from './WrikeCard';
import { TEXT_SUBTLE } from '../../../brandTokens';
import { ProjectResponse } from '../../../types';

const STATUS_META: Record<string, { bg: string; text: string; border: string; label: string; chart: string }> = {
  // Actual DB values
  'In Progress': { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'In Progress',  chart: '#2DCCD3' },
  'Backlog':     { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', label: 'Backlog',      chart: '#818cf8' },
  'Done':        { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Done',         chart: '#34d399' },
  'ON HOLD':     { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: 'ON HOLD',      chart: '#fbbf24' },
  'On Hold':     { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: 'On Hold',      chart: '#fbbf24' },
  'Cancelled':   { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'Cancelled',    chart: '#94a3b8' },
  // Legacy uppercase keys
  'NOT_STARTED':  { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'Not Started',  chart: '#60a5fa' },
  'IN_DISCOVERY': { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', label: 'In Discovery', chart: '#a78bfa' },
  'ACTIVE':       { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Active',        chart: '#6ee7b7' },
  'IN_PROGRESS':  { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'In Progress',  chart: '#2DCCD3' },
  'ON_HOLD':      { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: 'On Hold',       chart: '#fbbf24' },
  'COMPLETED':    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Completed',     chart: '#34d399' },
  'CANCELLED':    { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'Cancelled',     chart: '#94a3b8' },
};

interface ProjectStatusWidgetProps {
  projects: ProjectResponse[];
}

const ProjectStatusWidget = React.memo(({ projects }: ProjectStatusWidgetProps) => {
  const navigate = useNavigate();

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, count]) => ({
        name: STATUS_META[status]?.label ?? status,
        value: count,
        color: STATUS_META[status]?.chart ?? TEXT_SUBTLE,
      }));
  }, [projects]);

  const total = statusCounts.reduce((s, d) => s + d.value, 0);

  return (
    <WrikeCard title="Projects by Status">
      <Box p={20}>
        <Group align="center" justify="center" gap="xl">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie animationDuration={600} data={statusCounts} dataKey="value" cx="50%" cy="50%"
                innerRadius={50} outerRadius={75} paddingAngle={2}
                cursor="pointer"
                onClick={(data) => {
                  const statusKey = Object.keys(STATUS_META).find(k => STATUS_META[k].label === data.name);
                  if (statusKey) navigate(`/projects?status=${statusKey}`);
                }}>
                {statusCounts.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} projects`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <Stack gap={6}>
            {statusCounts.map((entry) => {
              const statusKey = Object.keys(STATUS_META).find(k => STATUS_META[k].label === entry.name);
              return (
                <Group key={entry.name} gap={8} align="center"
                  style={{ cursor: statusKey ? 'pointer' : 'default' }}
                  onClick={() => statusKey && navigate(`/projects?status=${statusKey}`)}>
                  <Box style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                  <Text size="xs" c="dimmed" style={{ minWidth: 90 }}>{entry.name}</Text>
                  <Text size="xs" fw={700} style={{ color: 'var(--pp-text)' }}>
                    {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Group>
      </Box>
    </WrikeCard>
  );
});

ProjectStatusWidget.displayName = 'ProjectStatusWidget';

export default ProjectStatusWidget;
