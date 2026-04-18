import _React, { useState } from 'react';
import { ScrollArea, Box, Stack, Group, Text, ActionIcon, Tooltip, TextInput } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { WidgetConfig } from '../state/types';
import { fmtValue, chartColor } from './helpers';
import { AQUA, DEEP_BLUE } from '../../../../brandTokens';
import { EmptyState } from './ChartWidgets';

function TableWidget({ data, columns, dark, config, onDrill }: { data: Record<string, unknown>[]; columns: string[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const cols = columns.length ? columns : Object.keys(data[0] ?? {});
  const colLabel = (c: string): string => {
    if (c === 'label'  && config?.label_name)  return config.label_name;
    if (c === 'label2' && config?.label2_name) return config.label2_name;
    if (c === 'value'  && config?.value_name)  return config.value_name;
    return c.replace(/_/g, ' ').toUpperCase();
  };
  const valueHeader = (c: string): string => {
    const base = colLabel(c);
    if (c === 'value' && !config?.value_name) {
      const m = config?.metric ?? '';
      if (m.includes('hours') || m.includes('hrs')) return base + ' (hrs)';
      if (m.includes('sp') || m.includes('velocity')) return base + ' (SP)';
      if (m.includes('pct') || m.includes('rate'))    return base + ' (%)';
      if (m.includes('days'))                          return base + ' (days)';
    }
    return base;
  };
  return (
    <ScrollArea h="100%" style={{ fontSize: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}` }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap', fontSize: 11 }}>
                {valueHeader(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#222' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && config?.groupBy && row.label) onDrill(config.groupBy, String(row.label)); }}>
              {cols.map(c => (
                <td key={c} style={{ padding: '5px 8px', fontSize: 12 }}>
                  {fmtValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function LeaderboardWidget({ data, dark, onDrill, config }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f: string, v: string) => void; config?: WidgetConfig }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  return (
    <ScrollArea h="100%">
      <Stack gap={6} p="xs">
        {data.map((row, i) => (
          <Group key={i} gap="sm" wrap="nowrap" style={{ cursor: onDrill ? 'pointer' : undefined, borderRadius: 4, padding: '2px 4px', transition: 'background 0.15s' }} onClick={() => onDrill?.(config?.groupBy ?? 'label', String(row.label ?? ''))}>
            <Text size="xs" c="dimmed" fw={700} w={20} ta="right">{i + 1}</Text>
            <Box style={{ flex: 1 }}>
              <Group justify="space-between" mb={3}>
                <Text size="sm" fw={500} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(row.label ?? '—')}
                </Text>
                <Text size="sm" fw={700} c={dark ? AQUA : DEEP_BLUE}>{fmtValue(row.value)}</Text>
              </Group>
              <Box style={{ height: 4, background: dark ? '#2a2a2a' : '#eee', borderRadius: 2, overflow: 'hidden' }}>
                <Box style={{ height: '100%', width: `${max > 0 ? (Number(row.value) / max * 100) : 0}%`, background: chartColor(dark, i), borderRadius: 2, transition: 'width 0.6s' }} />
              </Box>
            </Box>
          </Group>
        ))}
      </Stack>
    </ScrollArea>
  );
}

function MonthlySummaryWidget({ data, dark, config: _config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const cols = ['month','created','resolved','open','net_new_open','avg_age_days'];
  const hdrs = ['Month','Created','Resolved','Open','Net New','Avg Age (d)'];
  return (
    <ScrollArea h="100%">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}` }}>
            {hdrs.map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Month' ? 'left' : 'right', fontWeight: 700, color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const net = Number(row.net_new_open ?? 0);
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && row.month) onDrill('resolution_month', String(row.month)); }}>
                {cols.map((c, ci) => (
                  <td key={c} style={{ padding: '4px 8px', textAlign: ci === 0 ? 'left' : 'right', color: c === 'net_new_open' ? (net > 0 ? '#e74c3c' : net < 0 ? '#82E0AA' : undefined) : undefined }}>
                    {fmtValue(row[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function PeriodVsPeriodWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ScrollArea h="100%">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${dark ? '#333' : '#eee'}` }}>
            {['Metric','Current','Previous','Change'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Metric' ? 'left' : 'right', fontWeight: 700, color: dark ? AQUA : DEEP_BLUE }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const chg  = Number(row.change ?? 0);
            const pct  = Number(row.change_pct ?? 0);
            const up   = chg > 0;
            const arrow = chg === 0 ? '→' : up ? '↑' : '↓';
            const color = chg === 0 ? undefined : up ? '#82E0AA' : '#F1948A';
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }} onClick={() => onDrill?.('__all__', String(row.metric ?? ''))}>
                <td style={{ padding: '5px 8px', fontWeight: 500 }}>{String(row.metric ?? '')}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtValue(row.current)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: dark ? '#888' : '#999' }}>{fmtValue(row.previous)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color }}>
                  {arrow} {Math.abs(Number(fmtValue(chg)))} ({pct > 0 ? '+' : ''}{pct}%)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function IssueTableRawWidget({ data, dark, config: _config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  const [search, setSearch] = useState('');
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const filtered = search ? data.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase()))) : data;
  const exportCSV = () => {
    const cols = Object.keys(data[0] ?? {});
    const csv  = [cols.join(','), ...filtered.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'issues.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const cols = ['issue_key','summary','issue_type','status_name','priority_name','assignee_display_name','story_points','age_days'];
  const hdrs = ['Key','Summary','Type','Status','Priority','Assignee','SP','Age(d)'];
  return (
    <Stack gap={6} h="100%">
      <Group gap={6}>
        <TextInput size="xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <Tooltip label="Export CSV">
          <ActionIcon size="sm" variant="light" onClick={exportCSV}
      aria-label="Download"
    ><IconDownload size={14} /></ActionIcon>
        </Tooltip>
        <Text size="xs" c="dimmed">{filtered.length} rows</Text>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}`, position: 'sticky', top: 0, backgroundColor: dark ? '#1a1a2e' : '#fff' }}>
              {hdrs.map(h => (
                <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700, color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f8f8f8'}`, cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && row.assignee_display_name) onDrill('assignee_display_name', String(row.assignee_display_name)); }}>
                {cols.map(c => (
                  <td key={c} style={{ padding: '3px 6px', maxWidth: c === 'summary' ? 200 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }} title={String(row[c] ?? '')}>
                    {fmtValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </Stack>
  );
}

function WorklogTimelineWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return <LeaderboardWidget data={data} dark={dark} />;
  const periods  = [...new Set(data.map(d => String(d.label2 ?? '')))].sort();
  const authors  = [...new Set(data.map(d => String(d.label ?? '')))];
  const grid: Record<string, Record<string, number>> = {};
  let grandTotal = 0;
  data.forEach(d => {
    const a = String(d.label ?? ''); const p = String(d.label2 ?? '');
    if (!grid[a]) grid[a] = {};
    grid[a][p] = Number(d.value ?? 0);
    grandTotal += Number(d.value ?? 0);
  });
  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 400 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${dark ? '#333' : '#ddd'}` }}>
              <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, minWidth: 120 }}>Assignee</th>
              {periods.map(p => <th key={p} style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 10, color: dark ? '#aaa' : '#777' }}>{String(p).substring(0, 10)}</th>)}
              <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: dark ? AQUA : DEEP_BLUE }}>Total</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#888' : '#999', fontSize: 10 }}>% Share</th>
            </tr>
          </thead>
          <tbody>
            {authors.map((a, i) => {
              const total = periods.reduce((s, p) => s + (grid[a]?.[p] ?? 0), 0);
              const share = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0';
              return (
                <tr key={a} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, backgroundColor: i % 2 === 0 ? (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') : undefined }}>
                  <td style={{ padding: '3px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>{a.substring(0, 22)}</td>
                  {periods.map(p => {
                    const v = grid[a]?.[p] ?? 0;
                    return <td key={p} style={{ padding: '3px 6px', textAlign: 'right', color: v > 0 ? undefined : dark ? '#333' : '#ddd' }}>{v > 0 ? v.toFixed(1) : '—'}</td>;
                  })}
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700 }}>{total.toFixed(1)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: dark ? '#888' : '#999', fontSize: 10 }}>{share}%</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${dark ? '#333' : '#ddd'}`, fontWeight: 700 }}>
              <td style={{ padding: '4px 8px' }}>Total</td>
              {periods.map(p => {
                const colTotal = authors.reduce((s, a) => s + (grid[a]?.[p] ?? 0), 0);
                return <td key={p} style={{ padding: '4px 6px', textAlign: 'right' }}>{colTotal > 0 ? colTotal.toFixed(1) : '—'}</td>;
              })}
              <td style={{ padding: '4px 8px', textAlign: 'right', color: dark ? AQUA : DEEP_BLUE }}>{grandTotal.toFixed(1)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

export { TableWidget, LeaderboardWidget, MonthlySummaryWidget, PeriodVsPeriodWidget, IssueTableRawWidget, WorklogTimelineWidget };
