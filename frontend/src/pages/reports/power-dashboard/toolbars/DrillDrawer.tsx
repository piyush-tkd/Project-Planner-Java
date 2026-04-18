import _React, { useState } from 'react';
import { Drawer, Box, Group, Text, Badge, TextInput, ActionIcon, Tooltip, Stack, Loader, ScrollArea } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { DrillFilter } from '../state/types';
import { fmtValue } from '../widgets/helpers';
import { AQUA_HEX, DEEP_BLUE_HEX } from '../../../../brandTokens';

function DrillDrawer({ drill, isOpen, dark, onClose }: {
  drill: DrillFilter | null; isOpen: boolean; dark: boolean; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const activeDrill = drill;
  const { data, isLoading } = useQuery<{ data: Record<string, unknown>[]; count: number }>({
    queryKey: ['drill-issues', activeDrill?.field, activeDrill?.value,
               JSON.stringify(activeDrill?.widgetFilters), activeDrill?.widgetDateRange?.preset],
    queryFn: () => apiClient.post('/power-dashboard/drill-issues', {
      drillField:    activeDrill?.field ?? '',
      drillValue:    activeDrill?.value ?? '',
      widgetFilters: activeDrill?.widgetFilters ?? [],
      dateRange:     activeDrill?.widgetDateRange ?? { preset: 'last_2y' },
      days: 730,
      limit: 200,
    }).then(r => r.data),
    enabled: !!activeDrill && isOpen,
  });

  const rows = data?.data ?? [];
  const filtered = search
    ? rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : rows;

  const exportCSV = () => {
    if (!filtered.length) return;
    const cols = Object.keys(filtered[0]);
    const csv  = [cols.join(','), ...filtered.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a    = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'drill-issues.csv'; a.click();
  };

  const COLS = ['issue_key','summary','status_name','priority_name','assignee_display_name','story_points','age_days'];

  return (
    <Drawer opened={isOpen} onClose={onClose} position="right" size="xl"
      title={
        <Group gap={8}>
          <Text fw={700}>🔍 Drill-Through</Text>
          {activeDrill && <Badge size="sm" variant="light" color="teal">{activeDrill.label}</Badge>}
          {data && <Badge size="sm" color="blue">{data.count} issues</Badge>}
        </Group>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' } }}>
      <Box p="sm" style={{ borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
        <Group gap={8}>
          <TextInput size="sm" placeholder="Search issues..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Tooltip label="Export CSV">
            <ActionIcon size="sm" variant="light" onClick={exportCSV}
      aria-label="Download"
    ><IconDownload size={14} /></ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed">{isLoading ? '...' : `${filtered.length} issues`}</Text>
        </Group>
        <Group gap={4} mt={4} wrap="wrap">
          {activeDrill?.field !== '__all__' && activeDrill?.field && (
            <Badge size="xs" variant="light" color="teal">
              🔍 {activeDrill.field.replace(/_/g,' ')} = {activeDrill.value}
            </Badge>
          )}
          {(activeDrill?.widgetFilters ?? []).map((f, i) => (
            <Badge key={i} size="xs" variant="dot" color="gray">
              {f.field.replace(/_/g,' ')} {f.op} {Array.isArray(f.value) ? f.value.join(',') : f.value}
            </Badge>
          ))}
          {activeDrill?.widgetDateRange?.preset && (
            <Badge size="xs" variant="dot" color="blue">{activeDrill.widgetDateRange.preset}</Badge>
          )}
        </Group>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        {isLoading ? (
          <Stack align="center" py="xl"><Loader /></Stack>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: dark ? '#1a1a2e' : '#f8f9fa', position: 'sticky', top: 0 }}>
                {['Key','Summary','Status','Priority','Assignee','SP','Age'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                    color: dark ? AQUA_HEX : DEEP_BLUE_HEX, fontSize: 11, whiteSpace: 'nowrap',
                    borderBottom: `2px solid ${dark ? '#333' : '#e0e0e0'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`,
                  backgroundColor: i % 2 === 0 ? undefined : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') }}>
                  {COLS.map(c => (
                    <td key={c} style={{ padding: '6px 10px', maxWidth: c === 'summary' ? 240 : undefined,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: c === 'issue_key' ? 600 : undefined,
                      color: c === 'issue_key' ? (dark ? AQUA_HEX : DEEP_BLUE_HEX) : undefined }}
                      title={String(row[c] ?? '')}>
                      {fmtValue(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </Drawer>
  );
}

export { DrillDrawer };
