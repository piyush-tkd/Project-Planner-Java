import _React, { useState, useEffect } from 'react';
import { Stack, Text, Badge, Tooltip, Box } from '@mantine/core';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { WidgetConfig } from '../state/types';
import { useCountUp, fmtValue, CHART_PRIMARY } from './helpers';
import { AQUA, DEEP_BLUE } from '../../../../brandTokens';

function KpiCard({ data, title, metric, dark, onDrill }: {
  data: Record<string, unknown>[];
  title: string; metric: string; dark: boolean;
  onDrill?: () => void;
}) {
  const raw   = Number(data[0]?.value ?? 0);
  const value = useCountUp(Number.isFinite(raw) ? Math.round(raw) : 0);
  const displayValue = Number.isInteger(raw) ? value.toLocaleString() : fmtValue(data[0]?.value ?? 0);
  const prev  = data[1]?.value;
  const change = (prev && Number(prev) > 0)
    ? ((raw - Number(prev)) / Number(prev) * 100).toFixed(1)
    : null;
  const m = metric ?? '';
  const kpiColor = CHART_PRIMARY(dark);

  return (
    <Stack gap={4} align="center" justify="center" h="100%" py="sm"
      style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={onDrill}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" ta="center" style={{ letterSpacing: '0.06em' }}>{title}</Text>
      <Tooltip label={onDrill ? 'Click to see issues' : ''} disabled={!onDrill} withArrow>
        <Text style={{ fontSize: '2.6rem', fontWeight: 900, color: kpiColor, lineHeight: 1,
          letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          textDecoration: onDrill ? 'underline dotted' : undefined, textUnderlineOffset: 4 }}>
          {displayValue}
        </Text>
      </Tooltip>
      {m.includes('pct')  && <Badge size="xs" variant="light" color="gray">%</Badge>}
      {m.includes('days') && <Badge size="xs" variant="light" color="gray">days</Badge>}
      {m.includes('hours')&& <Badge size="xs" variant="light" color="gray">hrs</Badge>}
      {m.includes('sp') || m.includes('velocity') ? <Badge size="xs" variant="light" color="teal">SP</Badge> : null}
      {change !== null && (
        <Badge color={Number(change) >= 0 ? 'green' : 'red'} size="sm">
          {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(Number(change))}%
        </Badge>
      )}
    </Stack>
  );
}

/** Gauge — SVG arc speedometer (270° sweep, fixed viewBox) */
function GaugeWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  const value  = Number(data[0]?.value ?? 0);
  const warn   = config?.threshold_warning;
  const crit   = config?.threshold_critical;
  const maxVal = crit ? crit * 1.25 : warn ? warn * 2.5 : Math.max(value * 1.5, 100);
  const pct    = Math.min(1, value / maxVal);

  const AQUA_HEX = '#4ECDC4';
  const cx = 100; const cy = 95; const r = 70;
  const START_DEG = 150;
  const SWEEP_DEG = 240;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const pt = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  const arcPath = (fromDeg: number, toDeg: number) => {
    const s = pt(fromDeg); const e = pt(toDeg);
    const span = ((toDeg - fromDeg) + 360) % 360;
    const large = span > 180 ? 1 : 0;
    const sweep = 1;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const endDeg  = START_DEG + SWEEP_DEG;
  const valDeg  = START_DEG + pct * SWEEP_DEG;
  const needleAngle = START_DEG + pct * SWEEP_DEG;
  const nx = cx + (r - 22) * Math.cos(toRad(needleAngle));
  const ny = cy + (r - 22) * Math.sin(toRad(needleAngle));

  const needleColor = (crit && value > crit) ? '#e74c3c' : (warn && value > warn) ? '#f39c12' : AQUA_HEX;
  const trackColor  = dark ? '#2d2d2d' : '#e2e8f0';

  return (
    <Stack align="center" justify="center" h="100%" style={{ overflow: 'hidden', cursor: onDrill ? 'pointer' : undefined }}
      onClick={() => onDrill?.('__all__', 'gauge')}>
      <svg viewBox="0 0 200 155" style={{ width: '100%', maxWidth: 240, maxHeight: '85%', pointerEvents: 'none' }}>
        <path d={arcPath(START_DEG, endDeg)} fill="none" stroke={trackColor} strokeWidth={14} strokeLinecap="round" />
        {warn && <path d={arcPath(START_DEG, START_DEG + (warn / maxVal) * SWEEP_DEG)} fill="none" stroke="#4ECDC4" strokeWidth={14} strokeLinecap="round" opacity={0.45} />}
        {crit && <path d={arcPath(START_DEG + (warn ? (warn / maxVal) * SWEEP_DEG : 0), START_DEG + (crit / maxVal) * SWEEP_DEG)} fill="none" stroke="#f39c12" strokeWidth={14} strokeLinecap="round" opacity={0.45} />}
        <path d={arcPath(START_DEG, valDeg)} fill="none" stroke={needleColor} strokeWidth={14} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
          stroke={dark ? '#ddd' : '#333'} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={needleColor} />
        <text x={cx} y={cy + 24} textAnchor="middle"
          fontSize={String(fmtValue(value)).length > 5 ? 18 : 24}
          fontWeight="800" fill={needleColor} fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-1">{fmtValue(value)}</text>
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize={11} fill={dark ? '#888' : '#aaa'}
          fontFamily="system-ui, -apple-system, sans-serif">{config?.value_name || 'Value'}</text>
        <text x={pt(START_DEG).x - 4} y={pt(START_DEG).y + 14} textAnchor="middle" fontSize={9} fill={dark ? '#666' : '#bbb'}>0</text>
        <text x={pt(endDeg).x + 4} y={pt(endDeg).y + 14} textAnchor="middle" fontSize={9} fill={dark ? '#666' : '#bbb'}>{fmtValue(maxVal)}</text>
        {warn && <text x={cx - 28} y={cy + 52} textAnchor="middle" fontSize={9} fill="#f39c12">⚠ {warn}</text>}
        {crit && <text x={cx + 28} y={cy + 52} textAnchor="middle" fontSize={9} fill="#e74c3c">🔴 {crit}</text>}
      </svg>
    </Stack>
  );
}

/** Sparkline KPI — large number + mini trend line */
function SparklineKpiWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));
  const latest = Number(sorted[sorted.length - 1]?.value ?? 0);
  const prev   = Number(sorted[sorted.length - 2]?.value ?? 0);
  const trend  = prev > 0 ? ((latest - prev) / prev * 100).toFixed(1) : null;
  const color  = dark ? AQUA : DEEP_BLUE;
  return (
    <Stack gap={4} align="center" h="100%" justify="center"
      style={{ cursor: onDrill ? 'pointer' : undefined }}
      onClick={() => onDrill?.('__all__', 'sparkline')}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">{config?.value_name || 'Value'}</Text>
      <Text size="2rem" fw={800} c={color} lh={1}>{fmtValue(latest)}</Text>
      {trend && (
        <Badge size="xs" color={Number(trend) >= 0 ? 'green' : 'red'}>
          {Number(trend) >= 0 ? '↑' : '↓'} {Math.abs(Number(trend))}% vs prior
        </Badge>
      )}
      <Box style={{ width: '100%', height: 50, pointerEvents: 'none' }}>
        <div role="img" aria-label="Line chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sorted} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </Box>
    </Stack>
  );
}

/** Countdown Timer — days/hours to a target date (stored in special_params) */
function CountdownWidget({ dark, config }: { dark: boolean; config?: WidgetConfig }) {
  const target = config?.special_params?.target_date;
  const label  = config?.special_params?.target_label ?? config?.label_name ?? 'Target';
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  if (!target) return (
    <Stack align="center" justify="center" h="100%">
      <Text size="xs" c="dimmed">Set target_date in special_params</Text>
      <Text size="xs" c="dimmed" ff="monospace">e.g. 2026-06-30</Text>
    </Stack>
  );
  const ms   = new Date(target).getTime() - now.getTime();
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const past = ms < 0;
  const color = past ? 'red' : days < 7 ? 'orange' : days < 30 ? 'yellow' : dark ? AQUA : DEEP_BLUE;
  return (
    <Stack align="center" justify="center" h="100%" gap={4}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
      <Text style={{ fontSize: '2.8rem', fontWeight: 900, color, lineHeight: 1 }}>
        {past ? `+${Math.abs(days)}` : days}
      </Text>
      <Text size="sm" fw={600} c="dimmed">{past ? 'days overdue' : 'days remaining'}</Text>
      {!past && days < 30 && <Text size="xs" c="dimmed">{hrs}h left today</Text>}
      <Text size="xs" c="dimmed">{new Date(target).toLocaleDateString()}</Text>
    </Stack>
  );
}

/** Ratio KPI — metric A : metric B (e.g. Bug:Story ratio) */
function RatioKpiWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: () => void }) {
  if (!data.length) return null;
  const d = data[0] ?? {};
  const num  = Number(d.numerator   ?? 0);
  const den  = Number(d.denominator ?? 0);
  const pct  = Number(d.ratio_pct   ?? 0);
  const total = Number(d.total      ?? 0);
  const color = CHART_PRIMARY(dark);
  const sp = config?.special_params ?? {};
  return (
    <Stack align="center" justify="center" h="100%" gap={6}
      style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={onDrill}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {sp.numeratorType || 'Bug'} : {sp.denominatorType || 'Story'} Ratio
      </Text>
      <Text style={{ fontSize: '2.4rem', fontWeight: 900, color, lineHeight: 1 }}>{pct}%</Text>
      <Stack gap={0} align="center" style={{ display: 'flex', flexDirection: 'row', gap: 16 }}>
        <Stack gap={0} align="center">
          <Text size="xl" fw={700} c="red">{num.toLocaleString()}</Text>
          <Text size="xs" c="dimmed">{sp.numeratorType || 'Bugs'}</Text>
        </Stack>
        <Text size="xl" c="dimmed">:</Text>
        <Stack gap={0} align="center">
          <Text size="xl" fw={700} c={color}>{den.toLocaleString()}</Text>
          <Text size="xs" c="dimmed">{sp.denominatorType || 'Stories'}</Text>
        </Stack>
      </Stack>
      <Text size="xs" c="dimmed">out of {total.toLocaleString()} total issues</Text>
    </Stack>
  );
}

export { KpiCard, SparklineKpiWidget, CountdownWidget, RatioKpiWidget, GaugeWidget };
