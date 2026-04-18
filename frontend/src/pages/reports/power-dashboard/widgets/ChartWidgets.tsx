import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend } from 'recharts';
import { WidgetConfig } from '../state/types';
import { fmtValue, chartColor, CHART_PRIMARY } from './helpers';
import { Stack, Text } from '@mantine/core';

function EmptyState({ reason }: { reason?: string }) {
  const isError = reason && !reason.includes('No data');
  return (
    <Stack align="center" justify="center" h="100%" gap={4} px="md">
      <Text style={{ fontSize: 28, lineHeight: 1 }}>{isError ? '⚠️' : '🔍'}</Text>
      <Text size="xs" fw={700} c="dimmed" ta="center">{isError ? 'Query failed' : 'No data'}</Text>
      <Text size="xs" c="dimmed" ta="center" opacity={0.7}>{isError ? reason?.substring(0, 80) : 'Try widening the date range'}</Text>
    </Stack>
  );
}

function BarChartWidget({ data, stacked, dark, config, onDrill }: { data: Record<string, unknown>[]; stacked?: boolean; dark: boolean; config?: WidgetConfig; onDrill?: (field: string, value: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (hasLabel2 && stacked) {
    const labels2 = [...new Set(data.map(d => String(d.label2 ?? '')))];
    const grouped: Record<string, Record<string, number>> = {};
    data.forEach(d => {
      const k = String(d.label ?? '');
      if (!grouped[k]) grouped[k] = {};
      grouped[k][String(d.label2 ?? '')] = Number(d.value ?? 0);
    });
    const chartData = Object.entries(grouped).map(([label, vals]) => ({ label, ...vals }));
    return (
      <div role="img" aria-label="Bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 14)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Legend />
          {labels2.map((l, i) => (
            <Bar key={l} dataKey={l} stackId="a" fill={chartColor(dark, i)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div role="img" aria-label="Bar chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 14)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Bar dataKey="value" name={config?.value_name || 'Value'} radius={[3, 3, 0, 0]} animationBegin={0} animationDuration={600} cursor={onDrill ? 'pointer' : undefined} onClick={onDrill ? (d: Record<string, unknown>) => { const val = d?.label ?? d?.name ?? d?.xValue ?? ''; if (val && config?.groupBy) onDrill(config.groupBy, String(val)); } : undefined}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

function LineChartWidget({ data, area, dark, config, onDrill }: { data: Record<string, unknown>[]; area?: boolean; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  return (
    <div role="img" aria-label="Area chart">
    <ResponsiveContainer width="100%" height="100%">
      {area ? (
        <AreaChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Area type="monotone" dataKey="value" stroke={color} fill={color + '40'} strokeWidth={2} />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Line type="monotone" dataKey="value" name={config?.value_name || 'Value'} stroke={color} strokeWidth={2} dot={{ r: 3, cursor: onDrill ? 'pointer' : undefined }} activeDot={onDrill ? (props: any) => <circle {...props} r={5} style={{ cursor:'pointer' }} onClick={() => { const v = props?.payload?.label; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); }} /> : { r: 5 }} />
        </LineChart>
      )}
    </ResponsiveContainer>
    </div>
  );
}

function PieChartWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (field: string, value: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <div role="img" aria-label="Bar chart">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="35%" outerRadius="70%" paddingAngle={2} cursor={onDrill ? 'pointer' : undefined} onClick={onDrill ? (d: Record<string, unknown>) => { const val = d?.name ?? d?.label ?? ''; if (val && config?.groupBy) onDrill(config.groupBy, String(val)); } : undefined} label={({ label, percent }) => percent > 0.05 ? `${String(label ?? '').substring(0, 10)} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Pie>
        <ReTooltip formatter={(v) => [fmtValue(v), '']} />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
      </PieChart>
    </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarWidget({ data, dark, config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <div role="img" aria-label="Bar chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100} tickFormatter={(v: string) => String(v).substring(0, 18)} />
        <ReTooltip formatter={(v: unknown) => [fmtValue(v), config?.value_name || 'Value']} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 10 }}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

function ScatterWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const pts = data.map(d => ({ x: Number(d.x ?? 0), y: Number(d.y ?? d.value ?? 0), name: String(d.label ?? '') })).filter(p => isFinite(p.x) && isFinite(p.y));
  if (!pts.length) return <EmptyState reason="No numeric x/y values found — configure x_metric" />;
  const color = CHART_PRIMARY(dark);
  return (
    <div role="img" aria-label="Scatter chart">
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 48, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="x" type="number" name={config?.label_name || 'X'} tick={{ fontSize: 11 }} label={{ value: config?.label_name || config?.groupBy || 'X', position: 'insideBottom', offset: -8, fontSize: 11 }} />
        <YAxis dataKey="y" type="number" name={config?.value_name || 'Y'} tick={{ fontSize: 11 }} />
        <ReTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: unknown, n: string) => [fmtValue(v), n]} />
        <Scatter data={pts} fill={color} opacity={0.7} onClick={onDrill ? (d: any) => { const v = d?.name ?? d?.label; if (v) onDrill('assignee_display_name', String(v)); } : undefined} />
      </ScatterChart>
    </ResponsiveContainer>
    </div>
  );
}

function WaterfallWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  let running = 0;
  const wData = data.map(d => {
    const val = Number(d.value ?? 0);
    const base = running;
    running += val;
    return { label: String(d.label ?? ''), value: val, base, total: running, positive: val >= 0 };
  });
  return (
    <div role="img" aria-label="Composed chart">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={wData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]}>
          {wData.map((d, i) => <Cell key={i} fill={d.positive ? '#4ECDC4' : '#F1948A'} />)}
        </Bar>
        <Line type="monotone" dataKey="total" stroke={dark ? '#FFD700' : '#FFA500'} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

export { BarChartWidget, LineChartWidget, PieChartWidget, ScatterWidget, WaterfallWidget, HorizontalBarWidget, EmptyState };
