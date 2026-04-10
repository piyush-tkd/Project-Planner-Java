import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, Text, Group, Stack, Badge, Slider, Button, Tooltip, ActionIcon } from '@mantine/core';
import { IconLock, IconLockOpen, IconRefresh, IconGripVertical } from '@tabler/icons-react';
import { AQUA, AQUA_HEX, AQUA_TINTS, COLOR_BLUE_DARK, COLOR_ERROR, COLOR_ORANGE, COLOR_SUCCESS, DARK_BG, DARK_BORDER, DEEP_BLUE, FONT_FAMILY, GRAY_100, GRAY_300, SHADOW, SURFACE_SUCCESS, TEXT_DIM } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { PhaseScheduleResponse, SchedulingRulesResponse } from '../../types';

// Phase color config
const PHASE_COLORS: Record<string, { bg: string; light: string; text: string }> = {
  DEV: { bg: COLOR_BLUE_DARK, light: '#d0ebff', text: '#1864ab' },
  QA:  { bg: COLOR_SUCCESS, light: SURFACE_SUCCESS, text: '#2b8a3e' },
  UAT: { bg: '#e64980', light: '#fcc2d7', text: '#a61e4d' },
  E2E: { bg: COLOR_ORANGE, light: '#ffe8cc', text: '#d9480f' },
};

// Utils
const addDays = (d: Date, n: number): Date => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / 86400000);
const fmtDate = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtISO = (d: Date): string => d.toISOString().slice(0, 10);
const parseDate = (s: string | null): Date | null => s ? new Date(s + 'T00:00:00') : null;

export interface PhaseBar {
  podPlanningId: number;
  podId: number;
  podName: string;
  type: 'DEV' | 'QA' | 'UAT';
  start: Date;
  end: Date;
  locked: boolean;
}

interface TimelineSliderProps {
  phases: PhaseBar[];
  onPhasesChange: (phases: PhaseBar[]) => void;
  rules: SchedulingRulesResponse | null;
  projectStartDate?: Date;
  projectEndDate?: Date;
}

export function phasesFromSchedules(schedules: PhaseScheduleResponse[]): PhaseBar[] {
  const bars: PhaseBar[] = [];
  for (const s of schedules) {
    if (s.devStartDate && s.devEndDate) {
      bars.push({ podPlanningId: s.podPlanningId, podId: s.podId, podName: s.podName, type: 'DEV', start: new Date(s.devStartDate + 'T00:00:00'), end: new Date(s.devEndDate + 'T00:00:00'), locked: s.scheduleLocked });
    }
    if (s.qaStartDate && s.qaEndDate) {
      bars.push({ podPlanningId: s.podPlanningId, podId: s.podId, podName: s.podName, type: 'QA', start: new Date(s.qaStartDate + 'T00:00:00'), end: new Date(s.qaEndDate + 'T00:00:00'), locked: s.scheduleLocked });
    }
    if (s.uatStartDate && s.uatEndDate) {
      bars.push({ podPlanningId: s.podPlanningId, podId: s.podId, podName: s.podName, type: 'UAT', start: new Date(s.uatStartDate + 'T00:00:00'), end: new Date(s.uatEndDate + 'T00:00:00'), locked: s.scheduleLocked });
    }
  }
  return bars;
}

export function phasesToRequests(phases: PhaseBar[]): Record<number, { devStartDate: string | null; devEndDate: string | null; qaStartDate: string | null; qaEndDate: string | null; uatStartDate: string | null; uatEndDate: string | null; scheduleLocked: boolean }> {
  const map: Record<number, any> = {};
  for (const p of phases) {
    if (!map[p.podPlanningId]) {
      map[p.podPlanningId] = { devStartDate: null, devEndDate: null, qaStartDate: null, qaEndDate: null, uatStartDate: null, uatEndDate: null, scheduleLocked: p.locked };
    }
    const key = p.type.toLowerCase();
    map[p.podPlanningId][`${key}StartDate`] = fmtISO(p.start);
    map[p.podPlanningId][`${key}EndDate`] = fmtISO(p.end);
    map[p.podPlanningId].scheduleLocked = p.locked;
  }
  return map;
}

export default function TimelineSlider({ phases, onPhasesChange, rules, projectStartDate, projectEndDate }: TimelineSliderProps) {
  const dark = useDarkMode();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ idx: number; type: 'move' | 'resize-left' | 'resize-right'; startX: number; origStart: Date; origEnd: Date } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ idx: number; side: string } | null>(null);

  const LABEL_W = 120;
  const PAD_R = 32;
  const PAD_T = 56;
  const BAR_H = 42;
  const BAR_GAP = 20;
  const SVG_W = 960;
  const trackW = SVG_W - LABEL_W - PAD_R;

  // Compute timeline range from phase data
  const { timeStart, timeEnd, totalDays } = useMemo(() => {
    if (phases.length === 0) {
      const now = new Date();
      return { timeStart: now, timeEnd: addDays(now, 60), totalDays: 60 };
    }
    const allDates = phases.flatMap(p => [p.start, p.end]);
    if (projectStartDate) allDates.push(projectStartDate);
    if (projectEndDate) allDates.push(projectEndDate);
    const min = new Date(Math.min(...allDates.map(d => d.getTime())));
    const max = new Date(Math.max(...allDates.map(d => d.getTime())));
    const start = addDays(min, -7);
    const end = addDays(max, 14);
    return { timeStart: start, timeEnd: end, totalDays: Math.max(1, daysBetween(start, end)) };
  }, [phases, projectStartDate, projectEndDate]);

  const dayToX = useCallback((d: Date) => LABEL_W + (daysBetween(timeStart, d) / totalDays) * trackW, [timeStart, totalDays, trackW]);
  const xToDay = useCallback((x: number) => Math.round(((x - LABEL_W) / trackW) * totalDays), [totalDays, trackW]);

  // Week grid lines
  const weekLines = useMemo(() => {
    const lines: { x: number; label: string }[] = [];
    const d = new Date(timeStart);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    while (d < timeEnd) {
      lines.push({ x: dayToX(d), label: fmtDate(d) });
      d.setDate(d.getDate() + 7);
    }
    return lines;
  }, [timeStart, timeEnd, dayToX]);

  // TODAY marker
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = today >= timeStart && today <= timeEnd ? dayToX(today) : null;

  // Group phases by pod for display
  const podGroups = useMemo(() => {
    const groups: Record<string, PhaseBar[]> = {};
    for (const p of phases) {
      const key = `${p.podName}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups);
  }, [phases]);

  // Flat list for row positioning
  const flatRows = useMemo(() => {
    const rows: { phase: PhaseBar; podGroup: string; rowInGroup: number }[] = [];
    for (const [podName, podPhases] of podGroups) {
      podPhases.forEach((p, i) => rows.push({ phase: p, podGroup: podName, rowInGroup: i }));
    }
    return rows;
  }, [podGroups]);

  const svgH = PAD_T + flatRows.length * (BAR_H + BAR_GAP) + 52;

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    setDrag({ idx, type, startX: svgP.x, origStart: new Date(phases[idx].start), origEnd: new Date(phases[idx].end) });
  }, [phases]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!drag || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const dx = svgP.x - drag.startX;
    const daysDelta = Math.round((dx / trackW) * totalDays);

    const next = [...phases];
    const p = { ...next[drag.idx] };

    if (drag.type === 'move') {
      p.start = addDays(drag.origStart, daysDelta);
      p.end = addDays(drag.origEnd, daysDelta);
    } else if (drag.type === 'resize-left') {
      const newStart = addDays(drag.origStart, daysDelta);
      if (newStart < p.end) p.start = newStart;
    } else if (drag.type === 'resize-right') {
      const newEnd = addDays(drag.origEnd, daysDelta);
      if (newEnd > p.start) p.end = newEnd;
    }

    next[drag.idx] = p;
    onPhasesChange(next);
  }, [drag, totalDays, trackW, phases, onPhasesChange]);

  const handleMouseUp = useCallback(() => {
    setDrag(null);
  }, []);

  useEffect(() => {
    if (drag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [drag, handleMouseMove, handleMouseUp]);

  // Overlap detection
  const overlapZones = useMemo(() => {
    const zones: { start: Date; end: Date; labels: string[] }[] = [];
    for (let i = 0; i < phases.length; i++) {
      for (let j = i + 1; j < phases.length; j++) {
        if (phases[i].podPlanningId !== phases[j].podPlanningId) continue;
        const a = phases[i], b = phases[j];
        const overStart = new Date(Math.max(a.start.getTime(), b.start.getTime()));
        const overEnd = new Date(Math.min(a.end.getTime(), b.end.getTime()));
        if (overStart < overEnd) {
          zones.push({ start: overStart, end: overEnd, labels: [a.type, b.type] });
        }
      }
    }
    return zones;
  }, [phases]);

  if (phases.length === 0) {
    return (
      <Card withBorder padding="lg" style={{ boxShadow: SHADOW.card, textAlign: 'center' }}>
        <Text c="dimmed" size="sm" py="xl">No phases scheduled yet. Add phase dates to POD assignments to see the timeline.</Text>
      </Card>
    );
  }

  const HANDLE_W = 7;

  return (
    <Card withBorder padding="xl" style={{ boxShadow: SHADOW.card, overflow: 'visible' }}>
      <Group justify="space-between" mb="lg">
        <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
          Phase Timeline
        </Text>
        <Group gap="xs">
          {Object.entries(PHASE_COLORS).map(([key, col]) => (
            <Badge key={key} size="xs" color={col.bg} variant="filled">{key}</Badge>
          ))}
        </Group>
      </Group>

      <div style={{ overflowX: 'auto', padding: '8px 0' }}>
        <svg
          ref={svgRef}
          width={SVG_W}
          height={svgH}
          style={{ display: 'block', cursor: drag ? (drag.type === 'move' ? 'grabbing' : 'ew-resize') : 'default', userSelect: 'none' }}
        >
          {/* Background */}
          <rect width={SVG_W} height={svgH} fill={dark ? DARK_BG : '#fafbfc'} rx={8} />

          {/* Week gridlines */}
          {weekLines.map((wl, i) => (
            <g key={i}>
              <line x1={wl.x} x2={wl.x} y1={PAD_T - 5} y2={svgH - 10} stroke={dark ? DARK_BORDER : GRAY_100} strokeWidth={1} />
              <text x={wl.x} y={PAD_T - 14} fill={dark ? '#5C5F66' : GRAY_300} fontSize={9} textAnchor="middle" fontFamily={FONT_FAMILY}>{wl.label}</text>
            </g>
          ))}

          {/* TODAY marker */}
          {todayX !== null && (
            <g>
              <line x1={todayX} x2={todayX} y1={PAD_T - 5} y2={svgH - 10} stroke={COLOR_ERROR} strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={todayX} y={PAD_T - 14} fill={COLOR_ERROR} fontSize={9} fontWeight={700} textAnchor="middle" fontFamily={FONT_FAMILY}>TODAY</text>
            </g>
          )}

          {/* Overlap zones */}
          {overlapZones.map((z, i) => {
            const x1 = dayToX(z.start);
            const x2 = dayToX(z.end);
            return (
              <g key={`ov-${i}`}>
                <rect x={x1} y={PAD_T - 2} width={x2 - x1} height={svgH - PAD_T - 20} rx={4} fill={AQUA_HEX} opacity={0.08} />
                <text x={(x1 + x2) / 2} y={svgH - 12} fill={AQUA_HEX} fontSize={8} textAnchor="middle" fontWeight={600} fontFamily={FONT_FAMILY}>{z.labels.join('+')}</text>
              </g>
            );
          })}

          {/* Phase bars */}
          {flatRows.map((row, i) => {
            const { phase } = row;
            const globalIdx = phases.indexOf(phase);
            const y = PAD_T + i * (BAR_H + BAR_GAP);
            const x = dayToX(phase.start);
            const w = Math.max(20, dayToX(phase.end) - x);
            const pc = PHASE_COLORS[phase.type] || PHASE_COLORS.DEV;
            const dur = daysBetween(phase.start, phase.end);
            const isBeingDragged = drag?.idx === globalIdx;

            return (
              <g key={`${phase.podPlanningId}-${phase.type}`}>
                {/* Pod + Phase label */}
                <text x={10} y={y + BAR_H / 2 + 4} fill={dark ? '#C1C2C5' : pc.text} fontSize={11} fontWeight={700} fontFamily={FONT_FAMILY}>
                  {phase.podName.length > 10 ? phase.podName.slice(0, 10) + '..' : phase.podName} · {phase.type}
                </text>

                {/* Main bar */}
                <rect
                  x={x + HANDLE_W}
                  y={y}
                  width={Math.max(4, w - HANDLE_W * 2)}
                  height={BAR_H}
                  rx={6}
                  fill={pc.bg}
                  opacity={isBeingDragged ? 1 : 0.85}
                  style={{ cursor: phase.locked ? 'not-allowed' : 'grab', filter: isBeingDragged ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' : 'none' }}
                  onMouseDown={phase.locked ? undefined : (e) => handleMouseDown(e, globalIdx, 'move')}
                />

                {/* Left resize handle */}
                {!phase.locked && (
                  <>
                    <rect
                      x={x} y={y + 2} width={HANDLE_W} height={BAR_H - 4} rx={3}
                      fill={hoveredEdge?.idx === globalIdx && hoveredEdge?.side === 'left' ? pc.text : pc.bg}
                      opacity={hoveredEdge?.idx === globalIdx && hoveredEdge?.side === 'left' ? 1 : 0.5}
                      style={{ cursor: 'ew-resize' }}
                      onMouseDown={(e) => handleMouseDown(e, globalIdx, 'resize-left')}
                      onMouseEnter={() => setHoveredEdge({ idx: globalIdx, side: 'left' })}
                      onMouseLeave={() => !drag && setHoveredEdge(null)}
                    />
                    <line x1={x + 2.5} x2={x + 2.5} y1={y + BAR_H / 2 - 4} y2={y + BAR_H / 2 + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
                    <line x1={x + 4.5} x2={x + 4.5} y1={y + BAR_H / 2 - 4} y2={y + BAR_H / 2 + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
                  </>
                )}

                {/* Right resize handle */}
                {!phase.locked && (
                  <>
                    <rect
                      x={x + w - HANDLE_W} y={y + 2} width={HANDLE_W} height={BAR_H - 4} rx={3}
                      fill={hoveredEdge?.idx === globalIdx && hoveredEdge?.side === 'right' ? pc.text : pc.bg}
                      opacity={hoveredEdge?.idx === globalIdx && hoveredEdge?.side === 'right' ? 1 : 0.5}
                      style={{ cursor: 'ew-resize' }}
                      onMouseDown={(e) => handleMouseDown(e, globalIdx, 'resize-right')}
                      onMouseEnter={() => setHoveredEdge({ idx: globalIdx, side: 'right' })}
                      onMouseLeave={() => !drag && setHoveredEdge(null)}
                    />
                    <line x1={x + w - 4.5} x2={x + w - 4.5} y1={y + BAR_H / 2 - 4} y2={y + BAR_H / 2 + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
                    <line x1={x + w - 2.5} x2={x + w - 2.5} y1={y + BAR_H / 2 - 4} y2={y + BAR_H / 2 + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
                  </>
                )}

                {/* Lock icon */}
                {phase.locked && (
                  <text x={x + w + 4} y={y + BAR_H / 2 + 4} fill={TEXT_DIM} fontSize={11}>🔒</text>
                )}

                {/* Bar label */}
                {w > 100 && (
                  <text x={x + w / 2} y={y + BAR_H / 2 + 1} fill="#fff" fontSize={10} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT_FAMILY}>
                    {fmtDate(phase.start)} → {fmtDate(phase.end)} ({dur}d)
                  </text>
                )}
                {w <= 100 && w > 35 && (
                  <text x={x + w / 2} y={y + BAR_H / 2 + 1} fill="#fff" fontSize={9} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT_FAMILY}>
                    {dur}d
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
