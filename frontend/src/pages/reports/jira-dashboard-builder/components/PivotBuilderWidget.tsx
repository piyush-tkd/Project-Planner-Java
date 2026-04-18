import { useState, useMemo, useEffect } from 'react';
import { Text, Badge, Group, ActionIcon, Select, SegmentedControl, Loader } from '@mantine/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { usePowerQuery, type PowerQueryRequest } from '../../../../api/jira';
import ChartCard from '../../../../components/common/ChartCard';
import { AQUA_HEX, DEEP_BLUE_HEX, DEEP_BLUE_TINTS, FONT_FAMILY, SURFACE_LIGHT, TEXT_SUBTLE } from '../../../../brandTokens';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { ExtendedDashboardWidget } from '../state/types';
import { PIVOT_DIM_OPTIONS, PIE_COLORS, PIVOT_METRIC_OPTIONS, PIVOT_VIEW_OPTIONS, PIVOT_DIM_OPTIONS_FLAT } from '../state/constants';
import { joinsForDim } from '../state/utils';

export function PivotBuilderWidget({
  widget,
  editMode,
  onRemove,
  onEdit,
  pods,
  months,
}: {
  widget: ExtendedDashboardWidget;
  editMode: boolean;
  onRemove: () => void;
  onEdit: () => void;
  pods?: string;
  months?: number;
}) {
  const dark = useDarkMode();

  // Local state for dimension/metric selection (mirrors widget config)
  const [rowDim, setRowDim] = useState(widget.pivotRowDim ?? 'issueType');
  const [colDim, setColDim] = useState<string | null>(widget.pivotColDim ?? 'priority');
  const [metric, setMetric] = useState<'count' | 'storyPoints' | 'hours' | 'cycleTimeDays'>(
    widget.pivotMetric ?? 'count'
  );
  const [view, setView] = useState<'table' | 'bar' | 'heatmap'>(widget.pivotView ?? 'table');

  // Keep local state in sync with widget config changes from parent
  useEffect(() => { setRowDim(widget.pivotRowDim ?? 'issueType'); }, [widget.pivotRowDim]);
  useEffect(() => { setColDim(widget.pivotColDim ?? 'priority'); }, [widget.pivotColDim]);
  useEffect(() => { setMetric(widget.pivotMetric ?? 'count'); }, [widget.pivotMetric]);
  useEffect(() => { setView(widget.pivotView ?? 'table'); }, [widget.pivotView]);

  // Build Power Query request
  const pqRequest = useMemo((): PowerQueryRequest => {
    const groupBy = colDim ? [rowDim, colDim] : [rowDim];
    const joins = [...joinsForDim(rowDim), ...joinsForDim(colDim ?? '')];
    const needsWorklogs = metric === 'hours' && !joins.includes('worklogs');
    const allJoins = needsWorklogs ? [...joins, 'worklogs'] : joins;

    const metricDef = metric === 'count'
      ? { field: 'count' as const, aggregation: 'count' as const, alias: 'val' }
      : metric === 'storyPoints'
      ? { field: 'storyPoints' as const, aggregation: 'sum' as const, alias: 'val' }
      : metric === 'hours'
      ? { field: 'hours' as const, aggregation: 'sum' as const, alias: 'val' }
      : { field: 'cycleTimeDays' as const, aggregation: 'avg' as const, alias: 'val' };

    const isTimeDim = (d: string) => d === 'created' || d === 'resolved';
    const granularity = widget.pivotGranularity ?? 'month';

    return {
      groupBy,
      metrics: [metricDef],
      joins: allJoins.length > 0 ? allJoins : undefined,
      granularity: (isTimeDim(rowDim) || isTimeDim(colDim ?? '')) ? granularity : undefined,
      timeField: 'created',
      pods,
      limit: (widget.limit ?? 50),
      orderBy: 'val',
      orderDirection: 'desc',
      ...(months ? (() => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - months);
        return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
      })() : {}),
    } as unknown as PowerQueryRequest;
  }, [rowDim, colDim, metric, pods, months, widget.limit, widget.pivotGranularity]);

  const { data: pqResp, isLoading, error } = usePowerQuery(pqRequest, true);

  // Pivot the flat result into cross-tab structure
  type PivotResult = { pivotRows: string[]; pivotCols: string[]; cells: Record<string, Record<string, number>>; rowTotals: Record<string, number>; colTotals: Record<string, number>; grandTotal: number; flatRows: { name: string; val: number }[] };
  const { pivotRows, pivotCols, cells, rowTotals, colTotals, grandTotal, flatRows } = useMemo((): PivotResult => {
    const rawRows = pqResp?.data ?? [];
    if (!rawRows.length) return { pivotRows: [], pivotCols: [], cells: {}, rowTotals: {}, colTotals: {}, grandTotal: 0, flatRows: [] };

    const rowKey = rowDim.includes('-') ? rowDim.replace('-', '_') : rowDim;

    if (!colDim) {
      // 1D: flat list
      const flat = rawRows.map(r => ({
        name: String(r[rowKey] ?? r[rowDim] ?? '—'),
        val: Number(r['val'] ?? 0),
      }));
      return { pivotRows: [], pivotCols: [], cells: {}, rowTotals: {}, colTotals: {}, grandTotal: 0, flatRows: flat };
    }

    const colKey = colDim.includes('-') ? colDim.replace('-', '_') : colDim;

    // Collect unique rows/cols (ordered by first-seen in data)
    const rowOrder: string[] = [];
    const colOrder: string[] = [];
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const cells: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rawRows.forEach(r => {
      const rv = String(r[rowKey] ?? r[rowDim] ?? '—');
      const cv = String(r[colKey] ?? r[colDim] ?? '—');
      const val = Number(r['val'] ?? 0);

      if (!rowSet.has(rv)) { rowSet.add(rv); rowOrder.push(rv); }
      if (!colSet.has(cv)) { colSet.add(cv); colOrder.push(cv); }
      if (!cells[rv]) cells[rv] = {};
      cells[rv][cv] = (cells[rv][cv] ?? 0) + val;
      rowTotals[rv] = (rowTotals[rv] ?? 0) + val;
      colTotals[cv] = (colTotals[cv] ?? 0) + val;
      grandTotal += val;
    });

    // Sort cols by total desc, limit to top 8
    const sortedCols = colOrder.sort((a, b) => (colTotals[b] ?? 0) - (colTotals[a] ?? 0)).slice(0, 8);
    // Sort rows by total desc, limit
    const sortedRows = rowOrder.sort((a, b) => (rowTotals[b] ?? 0) - (rowTotals[a] ?? 0)).slice(0, widget.limit ?? 20);

    return { pivotRows: sortedRows, pivotCols: sortedCols, cells, rowTotals, colTotals, grandTotal, flatRows: [] };
  }, [pqResp, rowDim, colDim, widget.limit]);

  const metricLabel = PIVOT_METRIC_OPTIONS.find(m => m.value === metric)?.label ?? 'Count';
  const rowLabel = PIVOT_DIM_OPTIONS_FLAT.find(d => d.value === rowDim)?.label ?? rowDim;
  const colLabel = colDim ? PIVOT_DIM_OPTIONS_FLAT.find(d => d.value === colDim)?.label ?? colDim : null;

  const maxVal = useMemo(() => {
    if (flatRows.length) return Math.max(...flatRows.map(r => r.val), 1);
    if (!pivotRows.length) return 1;
    return Math.max(...pivotRows.map(r => rowTotals[r] ?? 0), 1);
  }, [flatRows, pivotRows, rowTotals]);

  const editButtons = editMode ? (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      <ActionIcon size="sm" variant="light" onClick={onEdit}
      aria-label="Edit"
    ><IconPencil size={13} /></ActionIcon>
      <ActionIcon size="sm" variant="light" color="red" onClick={onRemove}
      aria-label="Delete"
    ><IconTrash size={13} /></ActionIcon>
    </Group>
  ) : undefined;

  return (
    <div>
      <ChartCard title={widget.title} minHeight={320} headerRight={editButtons}>
        {/* ── Config bar ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 10, paddingBottom: 10,
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Rows:</Text>
            <Select
              size="xs" data={PIVOT_DIM_OPTIONS} value={rowDim} onChange={v => v && setRowDim(v)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <Text size="xs" c="dimmed">×</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Cols:</Text>
            <Select
              size="xs" data={[{ value: '', label: '— none —' }, ...PIVOT_DIM_OPTIONS]}
              value={colDim ?? ''} onChange={v => setColDim(v || null)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Metric:</Text>
            <Select
              size="xs" data={PIVOT_METRIC_OPTIONS} value={metric} onChange={v => v && setMetric(v as typeof metric)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <SegmentedControl
              size="xs" data={PIVOT_VIEW_OPTIONS} value={view} onChange={v => setView(v as typeof view)}
              styles={{ root: { height: 26 }, label: { fontSize: 11, padding: '0 8px' } }}
            />
          </div>
          {isLoading && <Loader size="xs" color={AQUA_HEX} />}
        </div>

        {/* ── Result ─────────────────────────────────────────────────── */}
        {error ? (
          <Text c="red" size="xs" ta="center" py="md">Query failed — check dimensions and try again</Text>
        ) : isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Loader size="sm" color={AQUA_HEX} />
          </div>
        ) : (!pivotRows.length && !flatRows.length) ? (
          <Text c="dimmed" ta="center" size="sm" py="xl">No data for selected dimensions</Text>
        ) : view === 'table' ? (
          /* ── Cross-tab table ────────────────────────────────────── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
              <thead>
                <tr style={{ background: dark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10] }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, whiteSpace: 'nowrap', minWidth: 140 }}>
                    {rowLabel}
                    {colLabel && <span style={{ color: AQUA_HEX, fontWeight: 400 }}> × {colLabel}</span>}
                  </th>
                  {pivotCols.map(col => (
                    <th key={col} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {col}
                    </th>
                  ))}
                  {pivotCols.length === 0 && (
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
                      {metricLabel}
                    </th>
                  )}
                  {pivotCols.length > 0 && (
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, fontSize: 11 }}>Total</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* 1D (no colDim) */}
                {flatRows.map((row, i) => (
                  <tr key={row.name} style={{ background: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 500, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: Math.round((row.val / maxVal) * 80), height: 4, background: AQUA_HEX, borderRadius: 2, opacity: 0.6, transition: 'width 0.4s ease' }} />
                        {row.name}
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
                      {metric === 'cycleTimeDays' ? row.val.toFixed(1) : row.val.toLocaleString()}
                    </td>
                  </tr>
                ))}

                {/* 2D cross-tab */}
                {pivotRows.map((row, i) => {
                  const rowTotal = rowTotals[row] ?? 0;
                  const pct = grandTotal > 0 ? Math.round((rowTotal / grandTotal) * 100) : 0;
                  return (
                    <tr key={row} style={{ background: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row}
                          <Badge size="xs" variant="light" color="gray" style={{ fontFamily: FONT_FAMILY }}>{pct}%</Badge>
                        </div>
                      </td>
                      {pivotCols.map(col => {
                        const val = cells[row]?.[col] ?? 0;
                        const intensity = grandTotal > 0 ? val / Math.max(...Object.values(cells).flatMap(r => Object.values(r)), 1) : 0;
                        return (
                          <td key={col} style={{
                            padding: '5px 8px', textAlign: 'right', fontWeight: val > 0 ? 600 : 400,
                            color: val > 0 ? (dark ? '#e2e8f0' : DEEP_BLUE_HEX) : dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                            background: val > 0 ? `${AQUA_HEX}${Math.round(intensity * 30 + 8).toString(16).padStart(2, '0')}` : 'transparent',
                            borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                            fontSize: 11,
                          }}>
                            {val > 0 ? (metric === 'cycleTimeDays' ? val.toFixed(1) : val.toLocaleString()) : '—'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, fontSize: 11 }}>
                        {metric === 'cycleTimeDays' ? rowTotal.toFixed(1) : rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

                {/* Column totals row */}
                {pivotCols.length > 0 && (
                  <tr style={{ background: dark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10], fontWeight: 700 }}>
                    <td style={{ padding: '6px 10px', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontSize: 11, fontWeight: 700 }}>Total</td>
                    {pivotCols.map(col => (
                      <td key={col} style={{ padding: '6px 8px', textAlign: 'right', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontSize: 11 }}>
                        {metric === 'cycleTimeDays' ? (colTotals[col] ?? 0).toFixed(1) : (colTotals[col] ?? 0).toLocaleString()}
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: AQUA_HEX, fontSize: 12 }}>
                      {metric === 'cycleTimeDays' ? grandTotal.toFixed(1) : grandTotal.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : view === 'bar' ? (
          /* ── Grouped bar chart ──────────────────────────────────── */
          <div role="img" aria-label="Bar chart">
          <ResponsiveContainer width="100%" height={Math.max(260, (pivotRows.length || flatRows.length) * 30 + 80)}>
            <BarChart
              data={pivotRows.length ? pivotRows.slice(0, 15).map(r => ({
                name: r.length > 18 ? r.slice(0, 17) + '…' : r,
                ...Object.fromEntries(pivotCols.map(c => [c, cells[r]?.[c] ?? 0])),
                ...(pivotCols.length === 0 ? { [metricLabel]: rowTotals[r] ?? 0 } : {}),
              })) : flatRows.slice(0, 15).map(r => ({ name: r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name, [metricLabel]: r.val }))}
              layout="vertical"
              margin={{ top: 4, right: 60, bottom: 4, left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.06)' : SURFACE_LIGHT} />
              <XAxis type="number" tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
              <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
              <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
              {widget.showLegend !== false && pivotCols.length > 0 && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
              {pivotCols.length > 0 ? (
                pivotCols.map((col, i) => (
                  <Bar key={col} dataKey={col} name={col} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[0, 3, 3, 0]} animationDuration={500} stackId={widget.showLegend !== false ? undefined : 'stack'} />
                ))
              ) : (
                <Bar dataKey={metricLabel} fill={widget.color || AQUA_HEX} radius={[0, 3, 3, 0]} animationDuration={500} />
              )}
            </BarChart>
          </ResponsiveContainer>
          </div>
        ) : (
          /* ── Heatmap view ───────────────────────────────────────── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 2, fontFamily: FONT_FAMILY, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', textAlign: 'left', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontWeight: 600 }}></th>
                  {(pivotCols.length > 0 ? pivotCols : [metricLabel]).map(col => (
                    <th key={col} style={{ padding: '4px 6px', textAlign: 'center', color: dark ? '#cbd5e1' : DEEP_BLUE_TINTS[60], fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>
                      {col.length > 12 ? col.slice(0, 11) + '…' : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pivotRows.length ? pivotRows : flatRows.map(r => r.name)).map(rowName => {
                  const row = typeof rowName === 'string' ? rowName : (rowName as { name: string }).name;
                  return (
                    <tr key={row}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {row.length > 18 ? row.slice(0, 17) + '…' : row}
                      </td>
                      {(pivotCols.length > 0 ? pivotCols : [metricLabel]).map(col => {
                        const val = pivotCols.length > 0
                          ? (cells[row]?.[col] ?? 0)
                          : (flatRows.find(r => r.name === row)?.val ?? 0);
                        const intensity = maxVal > 0 ? val / maxVal : 0;
                        const bg = intensity < 0.01 ? (dark ? '#1a2635' : '#f8fafc')
                          : `${AQUA_HEX}${Math.round(intensity * 200 + 30).toString(16).padStart(2, '0')}`;
                        return (
                          <td key={col} title={`${row} × ${col}: ${val}`} style={{
                            padding: '5px 8px', textAlign: 'center', fontWeight: val > 0 ? 700 : 400,
                            fontSize: 11, borderRadius: 4, background: bg,
                            color: intensity > 0.5 ? '#fff' : val > 0 ? (dark ? '#e2e8f0' : DEEP_BLUE_HEX) : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                            transition: 'background 0.2s',
                            cursor: 'default',
                          }}>
                            {val > 0 ? (metric === 'cycleTimeDays' ? val.toFixed(1) : val) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Text size="xs" c="dimmed" ta="center" mt={8} style={{ fontFamily: FONT_FAMILY }}>
              Intensity = proportion of max value ({maxVal.toLocaleString()} {metricLabel})
            </Text>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
