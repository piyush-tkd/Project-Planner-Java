import { useState } from 'react';
import { Stack, Group, TextInput, Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { type JiraAnalyticsData, type AnalyticsBreakdown } from '../../../../api/jira';
import { FONT_FAMILY, DEEP_BLUE_HEX, DEEP_BLUE_TINTS } from '../../../../brandTokens';
import { ExtendedDashboardWidget } from '../state/types';
import { sortAndLimitData, generateCsvFromData, downloadCsv } from '../state/utils';

export function IssueTableWidget({ widget, data, dark }: {
  widget: ExtendedDashboardWidget;
  data: JiraAnalyticsData;
  dark: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const tableData = sortAndLimitData(
    (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byAssignee'] as AnalyticsBreakdown[] ?? [],
    widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 999
  );
  const filtered = tableData.filter(d => (d.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
  const handleCsvExport = () => {
    const csv = generateCsvFromData(widget.title, filtered.map(d => ({ Name: d.name, Count: d.count, 'Story Points': d.sp || 0, Hours: d.hours || 0 })));
    downloadCsv(csv, `${widget.title}-${new Date().toISOString().split('T')[0]}.csv`);
  };
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <TextInput placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="xs" style={{ flex: 1 }} />
        <Button size="xs" variant="light" leftSection={<IconDownload size={12} />} onClick={handleCsvExport}>CSV</Button>
      </Group>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
              <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Name</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Count</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>SP</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[10]}` }}>
                <td style={{ padding: 8, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{row.name}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.count}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.sp || 0}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.hours || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}
