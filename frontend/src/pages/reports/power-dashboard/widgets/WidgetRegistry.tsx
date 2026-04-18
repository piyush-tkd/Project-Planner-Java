import React from 'react';
import { KpiCard, SparklineKpiWidget, CountdownWidget, RatioKpiWidget, GaugeWidget } from './KpiWidgets';
import { BarChartWidget, LineChartWidget, PieChartWidget, ScatterWidget, WaterfallWidget, HorizontalBarWidget, EmptyState } from './ChartWidgets';
import { TableWidget, LeaderboardWidget, MonthlySummaryWidget, PeriodVsPeriodWidget, IssueTableRawWidget, WorklogTimelineWidget } from './TableWidgets';
import { HeatmapWidget, HeatmapHWidget, TreemapWidget, LabelCloudWidget } from './GridWidgets';
import { GanttWidget, EpicProgressWidget, ReleaseReadinessWidget, SprintComparisonWidget, VelocityChart, WorklogTrendWidget, CreatedVsResolvedWidget, OpenTrendWidget, SprintBurndownWidget, CfdWidget } from './TimelineWidgets';
import { TextBlockWidget, BenchmarkWidget, RadarWidget, ControlChartWidget, BoxPlotWidget, FunnelWidget } from './TextWidgets';
import { WidgetConfig } from '../state/types';

function renderWidget(
  widgetType: string,
  data: Record<string, unknown>[],
  columns: string[],
  config: WidgetConfig,
  dark: boolean,
  onDrill?: (field: string, value: string) => void
): React.ReactNode {
  switch (widgetType) {
    case 'kpi_card':
      return <KpiCard data={data} title="Widget" metric={config.metric} dark={dark} onDrill={onDrill ? () => onDrill('__all__', 'kpi') : undefined} />;
    case 'bar':
      return <BarChartWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'stacked_bar':
      return <BarChartWidget data={data} stacked dark={dark} config={config} onDrill={onDrill} />;
    case 'line':
      return <LineChartWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'area':
      return <LineChartWidget data={data} area dark={dark} config={config} onDrill={onDrill} />;
    case 'pie':
      return <PieChartWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'table':
      return <TableWidget data={data} columns={columns} dark={dark} config={config} onDrill={onDrill} />;
    case 'heatmap':
      return <HeatmapWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'heatmap_h':
      return <HeatmapHWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'leaderboard':
      return <LeaderboardWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'velocity':
      return <VelocityChart data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'text_block':
    case 'section_header':
      return <TextBlockWidget config={config} dark={dark} />;
    case 'benchmark':
      return <BenchmarkWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'ratio_kpi':
      return <RatioKpiWidget data={data} dark={dark} config={config} onDrill={() => onDrill?.('__all__', 'ratio_kpi')} />;
    case 'created_vs_resolved':
      return <CreatedVsResolvedWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'open_trend':
      return <OpenTrendWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'sprint_burndown':
      return <SprintBurndownWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'horizontal_bar':
      return <HorizontalBarWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'gauge':
      return <GaugeWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'radar':
      return <RadarWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'sparkline_kpi':
      return <SparklineKpiWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'countdown':
      return <CountdownWidget dark={dark} config={config} />;
    case 'epic_progress':
      return <EpicProgressWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'monthly_summary':
      return <MonthlySummaryWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'period_vs_period':
      return <PeriodVsPeriodWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'issue_table_raw':
      return <IssueTableRawWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'worklog_timeline':
      return <WorklogTimelineWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'treemap':
      return <TreemapWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'funnel':
      return <FunnelWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'scatter':
      return <ScatterWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'waterfall':
      return <WaterfallWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'sprint_comparison':
      return <SprintComparisonWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'label_cloud':
      return <LabelCloudWidget data={data} dark={dark} onDrill={onDrill} config={config} />;
    case 'cfd':
      return <CfdWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'control_chart':
      return <ControlChartWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'box_plot':
      return <BoxPlotWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'gantt':
      return <GanttWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'release_readiness':
      return <ReleaseReadinessWidget data={data} dark={dark} onDrill={onDrill} />;
    case 'worklog_heatmap':
      return <HeatmapHWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    case 'worklog_trend':
      return <WorklogTrendWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
    default:
      return <EmptyState />;
  }
}

export { renderWidget };
