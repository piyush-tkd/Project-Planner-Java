import { ScrollArea, Box } from '@mantine/core';
import { WidgetConfig } from '../state/types';
import { fmtValue, chartColor } from './helpers';
import { EmptyState } from './ChartWidgets';

function HeatmapWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const xLabels = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const yLabels = [...new Set(data.map(d => String(d.label ?? '')))];
  const maxVal  = Math.max(...data.map(d => Number(d.value ?? 0)));
  const grid: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const y = String(d.label ?? ''); const x = String(d.label2 ?? '');
    if (!grid[y]) grid[y] = {};
    grid[y][x] = Number(d.value ?? 0);
  });
  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', minWidth: 120 }}></th>
              {xLabels.map(x => (
                <th key={x} style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap', color: dark ? '#aaa' : '#555', fontSize: 10, transform: 'rotate(-30deg)', display: 'inline-block' }}>
                  {String(x).substring(0, 15)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(y => (
              <tr key={y}>
                <td style={{ padding: '2px 8px', fontWeight: 500, whiteSpace: 'nowrap', color: dark ? '#ccc' : '#333', fontSize: 11 }}>
                  {String(y).substring(0, 20)}
                </td>
                {xLabels.map(x => {
                  const val = grid[y]?.[x] ?? 0;
                  const pct = maxVal > 0 ? val / maxVal : 0;
                  const bg  = dark ? `rgba(78,205,196,${0.1 + pct * 0.85})` : `rgba(30,100,170,${0.08 + pct * 0.75})`;
                  return (
                    <td key={x} title={`${y} × ${x}: ${val}`} style={{ width: 32, height: 28, textAlign: 'center', backgroundColor: bg, color: pct > 0.6 ? '#fff' : dark ? '#aaa' : '#555', fontSize: 10, fontWeight: pct > 0.3 ? 600 : 400, cursor: 'default', transition: 'background 0.2s', border: `1px solid ${dark ? '#1a1a1a' : '#fff'}` }}>
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

function HeatmapHWidget({ data, dark, config: _config, onDrill: _onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const yLabels = [...new Set(data.map(d => String(d.label ?? '')))];
  const xLabels = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const maxVal  = Math.max(...data.map(d => Number(d.value ?? 0)));
  const grid: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const y = String(d.label ?? ''); const x = String(d.label2 ?? '');
    if (!grid[y]) grid[y] = {};
    grid[y][x] = Number(d.value ?? 0);
  });
  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', minWidth: 100 }}></th>
              {xLabels.map(x => (
                <th key={x} style={{ padding: '4px 6px', fontWeight: 600, color: dark ? '#aaa' : '#555', fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {String(x).substring(0, 15)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(y => (
              <tr key={y}>
                <td style={{ padding: '2px 8px', fontWeight: 500, whiteSpace: 'nowrap', color: dark ? '#ccc' : '#333', fontSize: 11 }}>
                  {String(y).substring(0, 22)}
                </td>
                {xLabels.map(x => {
                  const val = grid[y]?.[x] ?? 0;
                  const pct = maxVal > 0 ? val / maxVal : 0;
                  const bg = dark ? `rgba(78,205,196,${0.1 + pct * 0.85})` : `rgba(30,100,170,${0.08 + pct * 0.75})`;
                  return (
                    <td key={x} title={`${y} / ${x}: ${val}`} style={{ width: 36, height: 26, textAlign: 'center', backgroundColor: bg, color: pct > 0.6 ? '#fff' : dark ? '#aaa' : '#555', fontSize: 10, fontWeight: pct > 0.3 ? 600 : 400, cursor: 'default', border: `1px solid ${dark ? '#1a1a1a' : '#fff'}` }}>
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

function TreemapWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  // Minimal treemap implementation — returns simple blocks sized by value
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  return (
    <Box style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', overflow: 'auto' }}>
      {data.map((d, i) => {
        const val = Number(d.value ?? 0);
        const size = max > 0 ? Math.sqrt(val / max) * 80 : 20;
        return (
          <Box
            key={i}
            style={{
              width: size,
              height: size,
              minWidth: 20,
              minHeight: 20,
              margin: 2,
              backgroundColor: chartColor(dark, i),
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onDrill ? 'pointer' : 'default',
              fontSize: 10,
              fontWeight: 600,
              color: '#fff',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: 4,
            }}
            onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}
            title={String(d.label)}
          >
            {String(d.label).substring(0, 8)}
          </Box>
        );
      })}
    </Box>
  );
}

function LabelCloudWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  const CHART_COLORS_DARK = ['#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F1948A','#82E0AA','#F8C471'];
  const CHART_COLORS_LIGHT = ['#1971c2','#2f9e44','#e03131','#e67700','#6741d9','#0b7285','#a61e4d','#364fc7','#087f5b','#d6336c','#5c940d','#862e9c'];
  const colors = dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  return (
    <Box style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', overflow: 'hidden' }}>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center', alignContent: 'center', maxWidth: '100%' }}>
        {data.map((d, i) => {
          const val   = Number(d.value ?? 0);
          const scale = max > 0 ? 0.75 + (val / max) * 1.25 : 1;
          const color = colors[i % colors.length];
          const fs    = Math.max(11, Math.round(11 * scale));
          const fw    = scale > 1.5 ? 800 : scale > 1.1 ? 700 : 600;
          const bg    = dark ? `${color}28` : `${color}18`;
          const border = dark ? `1px solid ${color}60` : `1px solid ${color}50`;
          return (
            <Box key={i} style={{ fontSize: fs, fontWeight: fw, color, padding: `${Math.round(3 * scale)}px ${Math.round(8 * scale)}px`, borderRadius: 6, backgroundColor: bg, border, cursor: 'default', whiteSpace: 'nowrap', transition: 'transform 0.15s', letterSpacing: scale > 1.3 ? '-0.02em' : undefined }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }} title={`${d.label}: ${fmtValue(d.value)}`}>
              {String(d.label ?? '')}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export { HeatmapWidget, HeatmapHWidget, TreemapWidget, LabelCloudWidget };
