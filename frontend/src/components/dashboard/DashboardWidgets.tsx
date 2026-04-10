import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  FunnelChart, Funnel, Treemap, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ZAxis, LabelList,
} from 'recharts';
import {
  Box, Progress, Table, Text, Group, Stack, Center, Badge, Flex, ThemeIcon,
} from '@mantine/core';
import {
  IconTrendingUp, IconTrendingDown, IconClick,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import {
  AQUA, AQUA_HEX, DEEP_BLUE, COLOR_SUCCESS, COLOR_WARNING, COLOR_ERROR_DARK,
  DARK_SURFACE, DARK_BORDER, CHART_COLORS, SPACING,
} from '../../brandTokens';

export interface WidgetData {
  labels: string[];
  values: number[];
  series?: Array<{ name: string; data: number[]; color?: string }>;
  rawData?: any[];
}

export interface WidgetProps {
  widgetType: string;
  title: string;
  data: WidgetData;
  config: Record<string, any>;
  isDark: boolean;
  isLoading?: boolean;
  height?: number;
  onDataPointClick?: (label: string, value: number, index: number) => void;
}

export interface WidgetMeta {
  type: string;
  label: string;
  icon: string;
  description: string;
  defaultSize: { w: number; h: number };
  category: 'kpi' | 'chart' | 'table' | 'misc';
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { type: 'widget_kpi_tile', label: 'KPI Tile', icon: '📊', description: 'Large metric with trend indicator and sparkline', defaultSize: { w: 4, h: 3 }, category: 'kpi' },
  { type: 'widget_line_chart', label: 'Line Chart', icon: '📈', description: 'Multi-series time series chart', defaultSize: { w: 6, h: 4 }, category: 'chart' },
  { type: 'widget_bar_chart', label: 'Bar Chart', icon: '📊', description: 'Vertical bar chart with grouping support', defaultSize: { w: 6, h: 4 }, category: 'chart' },
  { type: 'widget_pie_chart', label: 'Pie/Donut', icon: '🥧', description: 'Pie or donut chart with legend', defaultSize: { w: 4, h: 4 }, category: 'chart' },
  { type: 'widget_area_chart', label: 'Area Chart', icon: '📉', description: 'Stacked area chart with gradient', defaultSize: { w: 6, h: 4 }, category: 'chart' },
  { type: 'widget_scatter_plot', label: 'Scatter Plot', icon: '⚡', description: 'XY scatter plot with optional bubble size', defaultSize: { w: 5, h: 4 }, category: 'chart' },
  { type: 'widget_radar_chart', label: 'Radar Chart', icon: '🎯', description: 'Multi-axis radar chart', defaultSize: { w: 4, h: 4 }, category: 'chart' },
  { type: 'widget_heatmap', label: 'Heatmap', icon: '🔥', description: 'Grid of colored cells showing intensity', defaultSize: { w: 5, h: 4 }, category: 'chart' },
  { type: 'widget_gauge', label: 'Gauge', icon: '⏱️', description: 'Gauge meter with threshold zones', defaultSize: { w: 3, h: 4 }, category: 'chart' },
  { type: 'widget_waterfall', label: 'Waterfall', icon: '💧', description: 'Waterfall chart showing deltas', defaultSize: { w: 6, h: 4 }, category: 'chart' },
  { type: 'widget_treemap', label: 'Treemap', icon: '🌳', description: 'Hierarchical treemap visualization', defaultSize: { w: 5, h: 4 }, category: 'chart' },
  { type: 'widget_funnel', label: 'Funnel', icon: '🔻', description: 'Funnel chart showing stage progression', defaultSize: { w: 4, h: 4 }, category: 'chart' },
  { type: 'widget_sparkline_tile', label: 'Sparkline Tile', icon: '✨', description: 'Compact metric with inline chart and badge', defaultSize: { w: 3, h: 2 }, category: 'kpi' },
  { type: 'widget_progress_grid', label: 'Progress Grid', icon: '📊', description: 'Multiple progress bars with labels', defaultSize: { w: 4, h: 4 }, category: 'chart' },
  { type: 'widget_data_table', label: 'Data Table', icon: '📋', description: 'Sortable data table widget', defaultSize: { w: 8, h: 4 }, category: 'table' },
  { type: 'widget_calendar_heatmap', label: 'Calendar Heatmap', icon: '📅', description: 'GitHub-style contribution heatmap', defaultSize: { w: 8, h: 5 }, category: 'chart' },
  { type: 'widget_mini_timeline', label: 'Mini Timeline', icon: '⏳', description: 'Compact timeline with ranges', defaultSize: { w: 6, h: 3 }, category: 'misc' },
  { type: 'widget_text_block', label: 'Text Block', icon: '📝', description: 'Formatted text content', defaultSize: { w: 4, h: 3 }, category: 'misc' },
  { type: 'widget_status_matrix', label: 'Status Matrix', icon: '🚦', description: 'RAG status grid for multiple items', defaultSize: { w: 5, h: 4 }, category: 'misc' },
  { type: 'widget_bubble_chart', label: 'Bubble Chart', icon: '🫧', description: 'Scatter plot with bubble sizing', defaultSize: { w: 5, h: 4 }, category: 'chart' },
  { type: 'widget_sankey', label: 'Sankey Diagram', icon: '🌊', description: 'Flow diagram showing relationships', defaultSize: { w: 6, h: 4 }, category: 'chart' },
  { type: 'widget_linked_metric', label: 'Linked Metric', icon: '🔗', description: 'Clickable metric for drill-down', defaultSize: { w: 4, h: 3 }, category: 'kpi' },
];

function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function EmptyState({ isDark }: { isDark: boolean }): JSX.Element {
  return (
    <Center h={200} c={isDark ? '#888' : '#999'}>
      <Text size="sm">No data available</Text>
    </Center>
  );
}

function KpiTile(props: WidgetProps): JSX.Element {
  const { data, config, isDark, onDataPointClick } = props;
  const value = data.values[0] ?? 0;
  const label = data.labels[0] ?? 'KPI';
  const trend = config.trend ?? 'flat';
  const trendValue = config.trendValue ?? '';
  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';
  const trendIcon = trend === 'up' ? <IconTrendingUp size={20} color={COLOR_SUCCESS} /> : trend === 'down' ? <IconTrendingDown size={20} color={COLOR_ERROR_DARK} /> : null;
  const sparklineData = data.series?.[0]?.data || data.values;
  const sparkChart = sparklineData && sparklineData.length > 1 ? (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={sparklineData.map((v) => ({ value: v }))}>
        <Line type="monotone" dataKey="value" stroke={AQUA_HEX} dot={false} isAnimationActive={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  ) : null;
  return (
    <Box p={SPACING[16]} bg={isDark ? DARK_SURFACE : 'white'} style={{ cursor: onDataPointClick ? 'pointer' : 'default' }} onClick={() => onDataPointClick?.(label, value, 0)}>
      <Stack gap={SPACING[8]}>
        <Text size="xs" c={isDark ? '#aaa' : '#666'} fw={600} tt="uppercase">{label}</Text>
        <Text size="xl" fw={700} c={isDark ? '#fff' : DEEP_BLUE}>{prefix}{value.toLocaleString()}{suffix}</Text>
        {sparkChart}
        <Group justify="space-between">
          {trendIcon && (
            <Group gap={4}>
              {trendIcon}
              <Text size="xs" c={isDark ? '#aaa' : '#666'}>{trendValue}</Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Box>
  );
}

function LineChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.series || data.series.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, ...Object.fromEntries(data.series!.map((s) => [s.name, s.data[idx] ?? 0])) }));
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" stroke={textColor} />
        <YAxis stroke={textColor} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Legend />
        {data.series.map((series, idx) => (
          <Line key={series.name} type="monotone" dataKey={series.name} stroke={series.color || getChartColor(idx)} strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200, config } = props;
  if (!data.series || data.series.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, ...Object.fromEntries(data.series!.map((s) => [s.name, s.data[idx] ?? 0])) }));
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  const layout = config.layout || 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout={layout}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type={layout === 'vertical' ? 'number' : 'category'} stroke={textColor} />
        <YAxis type={layout === 'vertical' ? 'category' : 'number'} dataKey="name" stroke={textColor} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Legend />
        {data.series.map((series, idx) => (
          <Bar key={series.name} dataKey={series.name} fill={series.color || getChartColor(idx)} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200, config } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, value: data.values[idx] }));
  const innerRadius = config.innerRadius ?? 0;
  const bgColor = isDark ? DARK_SURFACE : 'white';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={50} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getChartColor(index)} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${isDark ? DARK_BORDER : '#e0e0e0'}` }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AreaChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.series || data.series.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, ...Object.fromEntries(data.series!.map((s) => [s.name, s.data[idx] ?? 0])) }));
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          {data.series.map((series, idx) => (
            <linearGradient key={`grad-${idx}`} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.color || getChartColor(idx)} stopOpacity={0.8} />
              <stop offset="100%" stopColor={series.color || getChartColor(idx)} stopOpacity={0.1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" stroke={textColor} />
        <YAxis stroke={textColor} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Legend />
        {data.series.map((series, idx) => (
          <Area key={series.name} type="monotone" dataKey={series.name} fill={`url(#grad-${idx})`} stroke={series.color || getChartColor(idx)} strokeWidth={2} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ScatterPlotWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="x" stroke={textColor} />
        <YAxis dataKey="y" stroke={textColor} />
        <ZAxis dataKey="z" range={[50, 1000]} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Scatter data={data.rawData} fill={AQUA_HEX} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function RadarChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, value: data.values[idx] }));
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={chartData}>
        <PolarGrid stroke={isDark ? DARK_BORDER : '#e0e0e0'} />
        <PolarAngleAxis dataKey="name" stroke={textColor} />
        <Radar name="Value" dataKey="value" stroke={AQUA_HEX} fill={AQUA_HEX} fillOpacity={0.5} isAnimationActive={false} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function HeatmapWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const maxValue = Math.max(...data.values);
  const minValue = Math.min(...data.values);
  const getIntensityColor = (value: number): string => {
    const ratio = (value - minValue) / (maxValue - minValue || 1);
    if (ratio < 0.33) return COLOR_SUCCESS;
    if (ratio < 0.67) return COLOR_WARNING;
    return COLOR_ERROR_DARK;
  };
  return (
    <Box p={SPACING[16]}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(40px, 1fr))', gap: SPACING[4] }}>
        {data.labels.map((label, idx) => (
          <Box key={idx} p={SPACING[8]} bg={getIntensityColor(data.values[idx])} style={{ borderRadius: 4, textAlign: 'center', fontSize: 10, color: isDark ? '#000' : '#fff', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`${label}: ${data.values[idx]}`}>
            {data.values[idx]}
          </Box>
        ))}
      </div>
    </Box>
  );
}

function GaugeWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, config } = props;
  const value = data.values[0] ?? 0;
  const maxValue = config.maxValue ?? 100;
  const ratio = (value / maxValue) * 100;
  let gaugeColor = COLOR_SUCCESS;
  if (ratio >= 75) gaugeColor = COLOR_ERROR_DARK;
  else if (ratio >= 50) gaugeColor = COLOR_WARNING;
  return (
    <Box p={SPACING[16]}>
      <Stack gap={SPACING[16]} align="center">
        <Box style={{ position: 'relative', width: 150, height: 75 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[{ name: 'Used', value: ratio }, { name: 'Remaining', value: 100 - ratio }]} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={40} outerRadius={60} dataKey="value">
                <Cell fill={gaugeColor} />
                <Cell fill={isDark ? DARK_BORDER : '#e0e0e0'} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <Box style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <Text size="lg" fw={700} c={isDark ? '#fff' : DEEP_BLUE}>{value}</Text>
            <Text size="xs" c={isDark ? '#aaa' : '#666'}>/ {maxValue}</Text>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

function WaterfallWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => {
    const value = data.values[idx];
    return { name: label, value: Math.abs(value), fill: value >= 0 ? COLOR_SUCCESS : COLOR_ERROR_DARK };
  });
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" stroke={textColor} />
        <YAxis stroke={textColor} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Bar dataKey="value" isAnimationActive={false}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TreemapWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, value: data.values[idx] }));
  const bgColor = isDark ? DARK_SURFACE : 'white';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={chartData} dataKey="value" stroke={isDark ? DARK_BORDER : '#e0e0e0'} fill={AQUA_HEX} isAnimationActive={false}>
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${isDark ? DARK_BORDER : '#e0e0e0'}` }} />
      </Treemap>
    </ResponsiveContainer>
  );
}

function FunnelWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const chartData = data.labels.map((label, idx) => ({ name: label, value: data.values[idx] }));
  const bgColor = isDark ? DARK_SURFACE : 'white';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <FunnelChart>
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${isDark ? DARK_BORDER : '#e0e0e0'}` }} />
        <Funnel data={chartData} dataKey="value" stroke={isDark ? DARK_BORDER : '#e0e0e0'} fill={AQUA_HEX} isAnimationActive={false}>
          <LabelList dataKey="name" position="insideLeft" fill="#fff" />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

function SparktileTile(props: WidgetProps): JSX.Element {
  const { data, isDark, onDataPointClick } = props;
  const value = data.values[0] ?? 0;
  const label = data.labels[0] ?? 'Metric';
  const trend = data.values[1] ? (data.values[1] >= data.values[0] ? 'up' : 'down') : 'flat';
  const sparkData = data.series?.[0]?.data || data.values;
  return (
    <Box p={SPACING[12]} bg={isDark ? DARK_SURFACE : 'white'} style={{ cursor: onDataPointClick ? 'pointer' : 'default' }} onClick={() => onDataPointClick?.(label, value, 0)}>
      <Flex justify="space-between" align="center" gap={SPACING[8]}>
        <Stack gap={SPACING[4]}>
          <Text size="xs" c={isDark ? '#aaa' : '#666'} fw={600}>{label}</Text>
          <Text size="lg" fw={700} c={isDark ? '#fff' : DEEP_BLUE}>{value}</Text>
        </Stack>
        <Box style={{ width: 60, height: 30 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData.map((v) => ({ value: v }))}>
              <Line type="monotone" dataKey="value" stroke={trend === 'up' ? COLOR_SUCCESS : COLOR_ERROR_DARK} dot={false} isAnimationActive={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Badge size="sm" color={trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'gray'}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </Badge>
      </Flex>
    </Box>
  );
}

function ProgressGridWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.values || data.values.length === 0) return <EmptyState isDark={isDark} />;
  const maxValue = Math.max(...data.values, 100);
  return (
    <Stack gap={SPACING[12]} p={SPACING[16]}>
      {data.labels.map((label, idx) => {
        const value = data.values[idx];
        const percentage = (value / maxValue) * 100;
        return (
          <div key={idx}>
            <Flex justify="space-between" mb={SPACING[4]}>
              <Text size="sm" fw={500}>{label}</Text>
              <Text size="sm" fw={600} c={isDark ? '#fff' : DEEP_BLUE}>{value.toLocaleString()}</Text>
            </Flex>
            <Progress value={percentage} color={AQUA} size="md" />
          </div>
        );
      })}
    </Stack>
  );
}

function DataTableWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const rows = data.rawData.slice(0, 10);
  const columns = Object.keys(rows[0] || {});
  return (
    <Box p={SPACING[16]} style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover={!isDark} style={{ backgroundColor: isDark ? DARK_SURFACE : 'white' }}>
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th key={col} style={{ color: isDark ? '#aaa' : DEEP_BLUE }}>{col}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, idx) => (
            <Table.Tr key={idx}>
              {columns.map((col) => (
                <Table.Td key={`${idx}-${col}`} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>{String(row[col])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

function CalendarHeatmapWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const maxValue = Math.max(...data.rawData.map((d: any) => d.value || 0));
  const getColor = (value: number): string => {
    const ratio = value / maxValue;
    if (ratio < 0.25) return COLOR_SUCCESS;
    if (ratio < 0.5) return '#61D9DE';
    if (ratio < 0.75) return '#2DCCD3';
    return DEEP_BLUE;
  };
  return (
    <Box p={SPACING[16]}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: SPACING[4] }}>
        {data.rawData.slice(0, 56).map((item: any, idx: number) => (
          <Box key={idx} p={SPACING[6]} bg={getColor(item.value || 0)} style={{ borderRadius: 4, textAlign: 'center', fontSize: 10, color: '#fff', minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={item.date}>
            {item.value}
          </Box>
        ))}
      </div>
    </Box>
  );
}

function MiniTimelineWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const maxEnd = Math.max(...data.rawData.map((d: any) => d.end || 0));
  return (
    <Stack gap={SPACING[16]} p={SPACING[16]}>
      {data.rawData.map((item: any, idx: number) => {
        const startPercent = (item.start / maxEnd) * 100;
        const widthPercent = ((item.end - item.start) / maxEnd) * 100;
        return (
          <div key={idx}>
            <Text size="sm" fw={500} mb={SPACING[4]}>{item.label}</Text>
            <Box style={{ width: '100%', height: 20, backgroundColor: isDark ? DARK_BORDER : '#e0e0e0', borderRadius: 4, position: 'relative' }}>
              <Box style={{ position: 'absolute', left: `${startPercent}%`, width: `${widthPercent}%`, height: '100%', backgroundColor: item.color || AQUA, borderRadius: 4 }} />
            </Box>
          </div>
        );
      })}
    </Stack>
  );
}

function TextBlockWidget(props: WidgetProps): JSX.Element {
  const { config, isDark } = props;
  const content = config.content || '';
  const formatted = content.split('\n').map((line: string) => {
    let text = line;
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    return text;
  }).join('<br/>');
  return <Box p={SPACING[16]} dangerouslySetInnerHTML={{ __html: formatted }} style={{ color: isDark ? '#fff' : DEEP_BLUE }} />;
}

function StatusMatrixWidget(props: WidgetProps): JSX.Element {
  const { data, isDark } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const dimensions = Object.keys(data.rawData[0]?.dimensions || {});
  const statusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'green':
      case 'success':
        return COLOR_SUCCESS;
      case 'amber':
      case 'warning':
        return COLOR_WARNING;
      case 'red':
      case 'error':
        return COLOR_ERROR_DARK;
      default:
        return isDark ? DARK_BORDER : '#e0e0e0';
    }
  };
  return (
    <Box p={SPACING[16]} style={{ overflowX: 'auto' }}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ color: isDark ? '#aaa' : DEEP_BLUE }}>Item</Table.Th>
            {dimensions.map((dim) => (
              <Table.Th key={dim} style={{ color: isDark ? '#aaa' : DEEP_BLUE }}>{dim}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.rawData.map((item: any, idx: number) => (
            <Table.Tr key={idx}>
              <Table.Td fw={500}>{item.label}</Table.Td>
              {dimensions.map((dim) => (
                <Table.Td key={`${idx}-${dim}`}>
                  <Badge size="sm" style={{ backgroundColor: statusColor(item.dimensions[dim]) }}>{item.dimensions[dim]}</Badge>
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

function BubbleChartWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="x" stroke={textColor} />
        <YAxis dataKey="y" stroke={textColor} />
        <ZAxis dataKey="z" range={[100, 1000]} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Scatter data={data.rawData} fill={AQUA_HEX} fillOpacity={0.6} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function SankeyWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, height = 200 } = props;
  if (!data.rawData || data.rawData.length === 0) return <EmptyState isDark={isDark} />;
  const rawData = data.rawData!;
  const sources = [...new Set(rawData.map((d: any) => d.source))];
  const chartData = sources.map((source) => {
    const items = rawData.filter((d: any) => d.source === source);
    const total = items.reduce((sum: number, d: any) => sum + d.value, 0);
    return { name: source, value: total };
  });
  const bgColor = isDark ? DARK_SURFACE : 'white';
  const gridColor = isDark ? DARK_BORDER : '#e0e0e0';
  const textColor = isDark ? '#aaa' : '#666';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type="number" stroke={textColor} />
        <YAxis type="category" dataKey="name" stroke={textColor} />
        <Tooltip contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}` }} />
        <Bar dataKey="value" fill={AQUA_HEX} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LinkedMetricWidget(props: WidgetProps): JSX.Element {
  const { data, isDark, onDataPointClick } = props;
  const value = data.values[0] ?? 0;
  const label = data.labels[0] ?? 'Metric';
  return (
    <motion.div whileHover={{ scale: 1.02 }} style={{ cursor: 'pointer' }}>
      <Box p={SPACING[16]} bg={isDark ? DARK_SURFACE : 'white'} style={{ border: `2px solid ${AQUA}`, borderRadius: 8 }} onClick={() => onDataPointClick?.(label, value, 0)}>
        <Stack gap={SPACING[8]}>
          <Flex justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="xs" c={isDark ? '#aaa' : '#666'} fw={600} tt="uppercase">{label}</Text>
              <Text size="xl" fw={700} c={isDark ? '#fff' : DEEP_BLUE}>{value.toLocaleString()}</Text>
            </Stack>
            <ThemeIcon variant="light" size="lg" color="cyan">
              <IconClick size={20} />
            </ThemeIcon>
          </Flex>
          <Text size="xs" c={AQUA} fw={600}>Click to drill down</Text>
        </Stack>
      </Box>
    </motion.div>
  );
}

export function DashboardWidget(props: WidgetProps): JSX.Element {
  const { widgetType, isLoading } = props;
  if (isLoading) return <EmptyState isDark={props.isDark} />;
  switch (widgetType) {
    case 'widget_kpi_tile': return <KpiTile {...props} />;
    case 'widget_line_chart': return <LineChartWidget {...props} />;
    case 'widget_bar_chart': return <BarChartWidget {...props} />;
    case 'widget_pie_chart': return <PieChartWidget {...props} />;
    case 'widget_area_chart': return <AreaChartWidget {...props} />;
    case 'widget_scatter_plot': return <ScatterPlotWidget {...props} />;
    case 'widget_radar_chart': return <RadarChartWidget {...props} />;
    case 'widget_heatmap': return <HeatmapWidget {...props} />;
    case 'widget_gauge': return <GaugeWidget {...props} />;
    case 'widget_waterfall': return <WaterfallWidget {...props} />;
    case 'widget_treemap': return <TreemapWidget {...props} />;
    case 'widget_funnel': return <FunnelWidget {...props} />;
    case 'widget_sparkline_tile': return <SparktileTile {...props} />;
    case 'widget_progress_grid': return <ProgressGridWidget {...props} />;
    case 'widget_data_table': return <DataTableWidget {...props} />;
    case 'widget_calendar_heatmap': return <CalendarHeatmapWidget {...props} />;
    case 'widget_mini_timeline': return <MiniTimelineWidget {...props} />;
    case 'widget_text_block': return <TextBlockWidget {...props} />;
    case 'widget_status_matrix': return <StatusMatrixWidget {...props} />;
    case 'widget_bubble_chart': return <BubbleChartWidget {...props} />;
    case 'widget_sankey': return <SankeyWidget {...props} />;
    case 'widget_linked_metric': return <LinkedMetricWidget {...props} />;
    default:
      return (
        <Center h={200} c="#999">
          <Text size="sm">Unknown widget type: {widgetType}</Text>
        </Center>
      );
  }
}
