import _React, { useState } from 'react';
import { Box, Stack, Text, Loader, Group, Button, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { WidgetConfig } from '../state/types';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../../api/client';
import { fmtValue, chartColor, CHART_PRIMARY } from './helpers';
import { AQUA, DEEP_BLUE } from '../../../../brandTokens';

function TextBlockWidget({ config, dark }: { config: WidgetConfig; dark: boolean }) {
  const content = config.text_content ?? '';
  const align   = config.text_align   ?? 'left';
  const size    = config.text_size    ?? 'sm';
  const isHeader = content.trimStart().startsWith('#');
  const lines    = content.replace(/^#{1,3}\s/gm, '').split('\n');
  return (
    <Box p="md" h="100%" style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
      {isHeader ? (
        <>
          <Text component="h4" ta={align} c={dark ? AQUA : DEEP_BLUE} style={{ letterSpacing: '-0.02em', fontSize: '1.2rem', fontWeight: 600 }}>
            {content.replace(/^#{1,3}\s/, '').split('\n')[0]}
          </Text>
          {lines.length > 1 && <Text size="sm" c="dimmed" ta={align as 'left'}>{lines.slice(1).join('\n')}</Text>}
        </>
      ) : (
        <Text size={size} ta={align as 'left'} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{content}</Text>
      )}
    </Box>
  );
}

function SyncJiraButton() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post('/power-dashboard/sync-jira');
      setLastSync(new Date().toLocaleTimeString());
      notifications.show({ title: 'Jira sync triggered', message: 'Data is syncing in background — refresh widgets in ~1 min', color: 'teal' });
    } catch {
      notifications.show({ title: 'Sync failed', message: 'Check Jira credentials in Settings', color: 'red' });
    } finally {
      setSyncing(false);
    }
  };
  return (
    <Tooltip label={lastSync ? `Last synced ${lastSync}` : 'Pull latest data from Jira into the DB'}>
      <Button size="sm" variant="light" color="teal" leftSection={syncing ? <Loader size={14} /> : <IconRefresh size={15} />} loading={syncing} onClick={handleSync}>
        Sync from Jira
      </Button>
    </Tooltip>
  );
}

function BenchmarkWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return null;
  return (
    <Stack gap={8} p="xs">
      {data.map((row, i) => {
        const chg  = Number(row.change   ?? 0);
        const pct  = Number(row.change_pct ?? 0);
        const cur  = Number(row.current  ?? 0);
        const prev = Number(row.previous ?? 0);
        const up   = chg > 0;
        const pctAbs = Math.abs(pct);
        const ringColor = pctAbs > 20 ? (up ? 'green' : 'red') : (up ? 'teal' : 'orange');
        return (
          <Group key={i} gap={12} wrap="nowrap" p={8} style={{ borderRadius: 8, cursor: onDrill ? 'pointer' : undefined, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }} onClick={() => onDrill?.('__all__', String(row.metric ?? ''))}>
            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 56, height: 56 }}>
              <Text size="xs" fw={700} c={ringColor}>{up ? '↑' : '↓'}{pctAbs.toFixed(0)}%</Text>
            </Box>
            <Box style={{ flex: 1 }}>
              <Text size="xs" fw={700} mb={2}>{String(row.metric ?? '')}</Text>
              <Group gap={12}>
                <Box>
                  <Text size="xs" c="dimmed">Current</Text>
                  <Text size="md" fw={800} c={dark ? '#4ECDC4' : '#1971c2'}>{fmtValue(cur)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Previous</Text>
                  <Text size="sm" fw={500} c="dimmed">{fmtValue(prev)}</Text>
                </Box>
              </Group>
            </Box>
          </Group>
        );
      })}
    </Stack>
  );
}

function RadarWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return null;
  const color = CHART_PRIMARY(dark);
  // Minimal radar implementation — returns text representation
  return (
    <Stack gap={4} p="md" h="100%">
      {data.map((d, i) => (
        <Group key={i} gap={8} style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}>
          <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <Text size="sm">{String(d.label ?? '')}</Text>
          <Text size="sm" fw={700} ml="auto">{fmtValue(d.value)}</Text>
        </Group>
      ))}
    </Stack>
  );
}

function ControlChartWidget({ data, dark: _dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return null;
  const vals = data.map(d => Number(d.value ?? 0));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sigma = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length);
  return (
    <Stack gap={4} p="md" h="100%">
      <Text size="xs" fw={700}>Mean: {mean.toFixed(1)}</Text>
      <Text size="xs" fw={700}>Sigma: {sigma.toFixed(1)}</Text>
      <Text size="xs" c="dimmed">UCL: {(mean + 2 * sigma).toFixed(1)}</Text>
      <Text size="xs" c="dimmed">LCL: {Math.max(0, mean - 2 * sigma).toFixed(1)}</Text>
    </Stack>
  );
}

function BoxPlotWidget({ data, dark: _dark, config: _config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return null;
  return (
    <Stack gap={4} p="md" h="100%">
      {data.map((d, i) => (
        <Group key={i} gap={8} style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && d.label) onDrill('issue_type', String(d.label)); }}>
          <Text size="sm">{String(d.label ?? '')}</Text>
          <Text size="xs" c="dimmed">Q1: {fmtValue(d.q1)} Med: {fmtValue(d.median)} Q3: {fmtValue(d.q3)}</Text>
        </Group>
      ))}
    </Stack>
  );
}

function FunnelWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  return (
    <Stack gap={4} p="md" h="100%">
      {data.map((d, i) => {
        const val = Number(d.value ?? 0);
        const pct = max > 0 ? val / max : 0;
        return (
          <Box key={i} style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}>
            <Group justify="space-between" mb={2}>
              <Text size="sm">{String(d.label ?? '')}</Text>
              <Text size="sm" fw={700}>{fmtValue(val)}</Text>
            </Group>
            <Box style={{ width: `${pct * 100}%`, height: 4, backgroundColor: chartColor(dark, i), borderRadius: 2 }} />
          </Box>
        );
      })}
    </Stack>
  );
}

export { TextBlockWidget, SyncJiraButton, BenchmarkWidget, RadarWidget, ControlChartWidget, BoxPlotWidget, FunnelWidget };
