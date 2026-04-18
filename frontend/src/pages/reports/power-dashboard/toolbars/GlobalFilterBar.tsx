import _React, { useCallback } from 'react';
import { Box, Group, Select, TextInput, Button, Badge, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { GlobalFilters } from '../state/types';
import { DATE_PRESETS } from '../widgets/constants';

function GlobalFilterBar({ dashboardId, filters, onChange, dark }: {
  dashboardId: number; filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void; dark: boolean;
}) {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery<string[]>({
    queryKey: ['power-field-values', 'project_key', 'issues'],
    queryFn: () => apiClient.get('/power-dashboard/fields/values?field=project_key&source=issues').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const save = useCallback(async (next: GlobalFilters) => {
    onChange(next);
    try {
      await apiClient.put(`/power-dashboard/dashboards/${dashboardId}/global-filters`, next);
      qc.invalidateQueries({ queryKey: ['power-widget-data'] });
    } catch { /* silent */ }
  }, [dashboardId, onChange, qc]);

  return (
    <Box style={{
      padding: '10px 16px',
      borderRadius: 10,
      background: dark ? 'rgba(78,205,196,0.05)' : 'rgba(28,126,214,0.04)',
      border: `1px solid ${dark ? '#4ECDC440' : '#1971c220'}`,
      marginBottom: 8,
    }}>
      <Group gap={12} wrap="wrap" align="flex-end">
        <Group gap={6} align="center">
          <Text size="xs">🌐</Text>
          <Text size="xs" fw={700} c={dark ? 'teal' : 'blue'} style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Dashboard Filters
          </Text>
        </Group>
        <Select size="xs" placeholder="All dates" clearable
          value={filters.date_preset ?? null}
          data={DATE_PRESETS}
          style={{ width: 140 }}
          onChange={v => save({ ...filters, date_preset: v ?? undefined })} />
        <Select size="xs" placeholder="All projects" clearable searchable
          value={filters.project_key ?? null}
          data={projects.map(p => ({ value: p, label: p }))}
          style={{ width: 130 }}
          onChange={v => save({ ...filters, project_key: v ?? undefined })} />
        <TextInput size="xs" placeholder="Filter by assignee..."
          value={filters.assignee ?? ''}
          style={{ width: 160 }}
          onChange={e => onChange({ ...filters, assignee: e.target.value || undefined })}
          onBlur={() => save(filters)} />
        {(filters.date_preset || filters.project_key || filters.assignee) && (
          <Button size="xs" variant="subtle" color="red"
            onClick={() => save({})}>
            Clear all
          </Button>
        )}
        {(filters.date_preset || filters.project_key || filters.assignee) && (
          <Badge size="sm" variant="filled" color="teal">
            {[filters.date_preset, filters.project_key, filters.assignee].filter(Boolean).length} active
          </Badge>
        )}
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          Applies to all widgets
        </Text>
      </Group>
    </Box>
  );
}

export { GlobalFilterBar };
