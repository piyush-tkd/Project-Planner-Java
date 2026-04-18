import { ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ReferenceLine } from 'recharts';
import { ScrollArea, Stack, Group, Box, Text, Badge } from '@mantine/core';
import { WidgetConfig } from '../state/types';
import { chartColor, CHART_PRIMARY } from './helpers';
import { EmptyState } from './ChartWidgets';

function GanttWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const dates = data.flatMap(d => [String(d.start_date ?? ''), String(d.end_date ?? '')]).filter(Boolean).sort();
  const minDate = new Date(dates[0] ?? new Date());
  const maxDate = new Date(dates[dates.length - 1] ?? new Date());
  const totalMs = Math.max(1, maxDate.getTime() - minDate.getTime());
  const pct = (d: string) => ((new Date(d).getTime() - minDate.getTime()) / totalMs) * 100;
  const width = (s: string, e: string) => Math.max(0.5, pct(e) - pct(s));
  const statusColor = (sc: string) => sc === 'done' ? '#82E0AA' : sc === 'indeterminate' ? '#F7DC6F' : '#85C1E9';
  return (
    <ScrollArea h="100%">
      <Stack gap={3} p="xs">
        {data.map((d, i) => (
          <Group key={i} gap={4} wrap="nowrap" style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && d.project_key) onDrill('project_key', String(d.project_key)); }}>
            <Text size="xs" style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(d.summary ?? '')}>
              {String(d.issue_key ?? '')} {String(d.summary ?? '').substring(0, 20)}
            </Text>
            <Box style={{ flex: 1, position: 'relative', height: 18, backgroundColor: dark ? '#1a1a2e' : '#f5f5f5', borderRadius: 4 }}>
              <Box style={{ position: 'absolute', left: `${pct(String(d.start_date ?? ''))}%`, width: `${width(String(d.start_date ?? ''), String(d.end_date ?? ''))}%`, height: '100%', backgroundColor: statusColor(String(d.status_category ?? '')), borderRadius: 4, minWidth: 4, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                <Text size="xs" style={{ fontSize: 9, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {String(d.start_date ?? '')} → {String(d.end_date ?? '')}
                </Text>
              </Box>
            </Box>
            <Badge size="xs" variant="light" color={String(d.status_category ?? '') === 'done' ? 'green' : 'blue'}>
              {String(d.status_name ?? '').substring(0, 12)}
            </Badge>
          </Group>
        ))}
        <Group gap={8} mt={4}>
          {[['Done','#82E0AA'],['In Progress','#F7DC6F'],['Todo','#85C1E9']].map(([l, c]) => (
            <Group key={l} gap={4}>
              <Box style={{ width: 10, height: 10, backgroundColor: c, borderRadius: 2 }} />
              <Text size="xs" c="dimmed">{l}</Text>
            </Group>
          ))}
        </Group>
      </Stack>
    </ScrollArea>
  );
}

function EpicProgressWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ScrollArea h="100%">
      <Stack gap={8} p="xs">
        {data.map((d, i) => {
          const pct = Math.min(100, Number(d.value ?? 0));
          const bar = pct >= 80 ? '#82E0AA' : pct >= 50 ? '#F7DC6F' : '#F1948A';
          return (
            <Box key={i} style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}>
              <Group justify="space-between" mb={3}>
                <Text size="xs" fw={500} style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(d.label ?? '—')}
                </Text>
                <Text size="xs" fw={700} c={pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}>{pct}%</Text>
              </Group>
              <Box style={{ height: 8, backgroundColor: dark ? '#2a2a2a' : '#eee', borderRadius: 4, overflow: 'hidden' }}>
                <Box style={{ height: '100%', width: `${pct}%`, backgroundColor: bar, borderRadius: 4, transition: 'width 0.5s' }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

function ReleaseReadinessWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const rData = data.slice(0, 6).map((d, i) => ({ name: String(d.sprint_name ?? '').substring(0, 20), pct: Number(d.completion_pct ?? 0), fill: chartColor(dark, i) }));
  return (
    <Stack gap={6} p="xs" h="100%">
      {rData.map((d, i) => (
        <Box key={i} style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => { if (onDrill) onDrill('sprint_name', d.name); }}>
          <Group justify="space-between" mb={2}>
            <Text size="xs" fw={500} style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Text>
            <Text size="xs" fw={700} c={d.pct >= 80 ? 'green' : d.pct >= 50 ? 'yellow' : 'red'}>{d.pct}%</Text>
          </Group>
          <Box style={{ height: 8, backgroundColor: dark ? '#2a2a2a' : '#eee', borderRadius: 4 }}>
            <Box style={{ height: '100%', width: `${d.pct}%`, backgroundColor: d.fill, borderRadius: 4, transition: 'width 0.5s' }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function SprintComparisonWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return null; // Fallback to BarChartWidget
  const labels2 = [...new Set(data.map(d => String(d.label2 ?? '')))].slice(0, 6);
  const grouped: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const k = String(d.label ?? '');
    if (!grouped[k]) grouped[k] = {};
    grouped[k][String(d.label2 ?? '')] = Number(d.value ?? 0);
  });
  const allSprints = Object.keys(grouped);
  const sprints = allSprints.slice(-8);
  const chartData = sprints.map(label => ({ label: String(label).substring(0, 16), ...grouped[label] }));
  return (
    <div role="img" aria-label="Composed chart">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        {labels2.map((l, i) => (
          <Bar key={l} dataKey={l} fill={chartColor(dark, i)} radius={[2, 2, 0, 0]} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

function VelocityChart({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <div role="img" aria-label="Composed chart">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Bar dataKey="value" name="Velocity (SP)" fill={CHART_PRIMARY(dark)} radius={[3, 3, 0, 0]} cursor={onDrill ? 'pointer' : undefined} onClick={onDrill ? (d: Record<string,unknown>) => { const v = d?.label ?? d?.name; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); } : undefined} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

function WorklogTrendWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return null;
  const persons = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const weeks   = [...new Set(data.map(d => String(d.label ?? '')))].sort();
  const series: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const w = String(d.label ?? ''); const p = String(d.label2 ?? '');
    if (!series[w]) series[w] = {};
    series[w][p] = Number(d.value ?? 0);
  });
  const chartData = weeks.map(w => ({ week: w, ...series[w] }));
  return (
    <div role="img" aria-label="Line chart">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(weeks.length / 6)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {persons.map((p, i) => (
          <Line key={p} type="monotone" dataKey={p} stroke={chartColor(dark, i)} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

// @ts-expect-error -- unused
function CreatedVsResolvedWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <div role="img" aria-label="Area chart">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(data.length / 8)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        <Area type="monotone" dataKey="created" name="Created" stroke="#F1948A" fill="#F1948A" fillOpacity={0.2} strokeWidth={2} />
        <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#82E0AA" fill="#82E0AA" fillOpacity={0.2} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

function OpenTrendWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  return (
    <div role="img" aria-label="Composed chart">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(data.length / 8)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        <Bar yAxisId="left" dataKey="created" name="Created" fill="#F1948A" opacity={0.5} />
        <Bar yAxisId="left" dataKey="resolved" name="Resolved" fill="#82E0AA" opacity={0.5} />
        <Line yAxisId="right" type="monotone" dataKey="open_running_total" name="Open Total" stroke={color} strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

function SprintBurndownWidget({ data, dark, config: _config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No sprint found — try setting a project filter" />;
  const burndown = data.filter(d => d.day !== undefined || d.remaining !== undefined);
  if (!burndown.length) return <EmptyState reason="No burndown data" />;
  const color = CHART_PRIMARY(dark);
  return (
    <Box h="100%" style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={() => onDrill?.('__all__', 'burndown')}>
      <div role="img" aria-label="Line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={burndown} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: 'SP', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <ReTooltip />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
          <Line type="monotone" dataKey="remaining" name="Actual" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#aaa" strokeDasharray="6 3" strokeWidth={1.5} dot={false} />
          <ReferenceLine y={0} stroke={dark ? '#444' : '#ccc'} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </Box>
  );
}

function CfdWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  let chartData = data;
  let statuses: string[] = [];
  if ('label2' in (data[0] ?? {})) {
    const weeks    = [...new Set(data.map(d => String(d.label ?? '')))].sort();
    statuses       = [...new Set(data.map(d => String(d.label2 ?? '')))].filter(Boolean).sort();
    const grid: Record<string, Record<string, number>> = {};
    data.forEach(d => {
      const w = String(d.label ?? ''); const s = String(d.label2 ?? '');
      if (!grid[w]) grid[w] = {};
      grid[w][s] = (grid[w][s] ?? 0) + Number(d.value ?? 0);
    });
    chartData = weeks.map(w => ({ week: w, ...grid[w] }));
  } else {
    statuses = Object.keys(data[0] ?? {}).filter(k => k !== 'week' && k !== 'label');
  }
  if (statuses.length === 0) return null;
  const numWeeks = chartData.length;
  const topStatuses = statuses.slice(0, 8);
  return (
    <div role="img" aria-label="Area chart">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.max(0, Math.ceil(numWeeks / 6) - 1)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {topStatuses.map((s, i) => (
          <Area key={s} type="monotone" dataKey={s} stackId="cfd" name={s} stroke={chartColor(dark, i)} fill={chartColor(dark, i)} fillOpacity={0.55} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

export { GanttWidget, EpicProgressWidget, ReleaseReadinessWidget, SprintComparisonWidget, VelocityChart, WorklogTrendWidget, CreatedVsResolvedWidget, OpenTrendWidget, SprintBurndownWidget, CfdWidget };
