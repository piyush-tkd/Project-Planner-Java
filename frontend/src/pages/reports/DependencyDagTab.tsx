/**
 * DependencyDagTab — Interactive force-layered DAG visualisation of project
 * dependencies.  Uses a pure-SVG renderer with a longest-path layer assignment
 * and a simple spring-relaxation step so that nodes in the same layer spread
 * apart nicely.
 *
 * Since cross-project dependencies are not yet stored in the DB we synthesise
 * edges that match the real topology rules already used in GanttDependenciesPage:
 *   • Same-POD sequential chains   (A → B when B starts after A in same pod)
 *   • Cross-POD blocking edges     (P0/P1 projects block the next project in a
 *                                   different pod that overlaps or follows)
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Box, Text, Badge, Group, Stack, Paper, Select, ActionIcon,
  Tooltip, Divider, ScrollArea, Center, Loader,
} from '@mantine/core';
import {
  IconCircleFilled, IconArrowRight, IconZoomIn, IconZoomOut,
  IconFocusCentered, IconInfoCircle,
} from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useProjectPodMatrix } from '../../api/projects';
import { AQUA, DEEP_BLUE, FONT_FAMILY, SURFACE_SUBTLE } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DagNode {
  id: number;
  name: string;
  status: string;
  priority: string;
  pod: string;
  startWeek: number;
  x: number;
  y: number;
  layer: number;
}

interface DagEdge {
  from: number;
  to: number;
  kind: 'sequential' | 'blocking' | 'cross-pod';
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { fill: string; stroke: string; label: string }> = {
  'ACTIVE':        { fill: '#dcfce7', stroke: '#16a34a', label: '#15803d' },
  'NOT STARTED':   { fill: '#f1f5f9', stroke: '#94a3b8', label: '#475569' },
  'IN DISCOVERY':  { fill: '#dbeafe', stroke: '#3b82f6', label: '#1d4ed8' },
  'ON HOLD':       { fill: '#fef3c7', stroke: '#f59e0b', label: '#92400e' },
  'COMPLETED':     { fill: '#d1fae5', stroke: '#10b981', label: '#064e3b' },
  'CANCELLED':     { fill: '#fee2e2', stroke: '#ef4444', label: '#991b1b' },
};

const PRIORITY_BADGE: Record<string, string> = {
  P0: '#ef4444', P1: '#f97316', P2: '#3b82f6', P3: '#22c55e',
};

const POD_PALETTE = [
  '#0891b2', '#7c3aed', '#b45309', '#0f766e',
  '#be185d', '#1d4ed8', '#15803d', '#a16207',
  '#6d28d9', '#0369a1',
];

// ─── Edge-generation helpers ──────────────────────────────────────────────────

function buildEdges(nodes: DagNode[]): DagEdge[] {
  if (nodes.length === 0) return [];
  const sorted = [...nodes].sort((a, b) => a.startWeek - b.startWeek);
  const edges: DagEdge[] = [];
  const added = new Set<string>();

  // Same-pod sequential chains: each project links to the next one in the same pod
  const byPod: Record<string, DagNode[]> = {};
  for (const n of sorted) {
    if (!byPod[n.pod]) byPod[n.pod] = [];
    byPod[n.pod].push(n);
  }
  for (const podNodes of Object.values(byPod)) {
    for (let i = 0; i < podNodes.length - 1; i++) {
      const key = `${podNodes[i].id}-${podNodes[i + 1].id}`;
      if (!added.has(key)) {
        edges.push({ from: podNodes[i].id, to: podNodes[i + 1].id, kind: 'sequential' });
        added.add(key);
      }
    }
  }

  // Cross-pod blocking: P0/P1 projects feed into the next project in a different pod
  const criticals = sorted.filter(n => n.priority === 'P0' || n.priority === 'P1');
  for (const src of criticals) {
    const target = sorted.find(
      t => t.id !== src.id &&
           t.pod !== src.pod &&
           t.startWeek >= src.startWeek &&
           !added.has(`${src.id}-${t.id}`),
    );
    if (target) {
      edges.push({ from: src.id, to: target.id, kind: 'blocking' });
      added.add(`${src.id}-${target.id}`);
    }
  }

  // One extra cross-pod link per pod to ensure the graph is connected
  const pods = Object.keys(byPod);
  for (let i = 0; i < pods.length - 1; i++) {
    const srcNodes = byPod[pods[i]];
    const dstNodes = byPod[pods[i + 1]];
    if (!srcNodes.length || !dstNodes.length) continue;
    const src = srcNodes[Math.floor(srcNodes.length / 2)];
    const dst = dstNodes[0];
    const key = `${src.id}-${dst.id}`;
    if (!added.has(key)) {
      edges.push({ from: src.id, to: dst.id, kind: 'cross-pod' });
      added.add(key);
    }
  }

  return edges;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/** Assign layers via longest-path from sources (no predecessors). */
function assignLayers(nodes: DagNode[], edges: DagEdge[]): DagNode[] {
  const predOf: Map<number, number[]> = new Map(nodes.map(n => [n.id, []]));
  edges.forEach(e => predOf.get(e.to)?.push(e.from));

  const layerOf: Map<number, number> = new Map();
  const visiting = new Set<number>();

  function depth(id: number): number {
    if (layerOf.has(id)) return layerOf.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const preds = predOf.get(id) ?? [];
    const l = preds.length === 0 ? 0 : Math.max(...preds.map(depth)) + 1;
    layerOf.set(id, l);
    visiting.delete(id);
    return l;
  }

  nodes.forEach(n => depth(n.id));
  return nodes.map(n => ({ ...n, layer: layerOf.get(n.id) ?? 0 }));
}

const LAYER_W   = 240;   // horizontal gap between layers
const NODE_H    = 80;    // vertical gap between nodes in same layer
const PAD_X     = 80;
const PAD_Y     = 60;
const R         = 28;    // node circle radius

/** Compute (x, y) positions from layers. Returns nodes + canvas size. */
function layoutNodes(
  nodes: DagNode[],
): { nodes: DagNode[]; width: number; height: number } {
  const byLayer: Map<number, DagNode[]> = new Map();
  nodes.forEach(n => {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
    byLayer.get(n.layer)!.push(n);
  });

  const maxLayer = Math.max(...nodes.map(n => n.layer));
  const maxInLayer = Math.max(...[...byLayer.values()].map(arr => arr.length));

  const canvasW = PAD_X * 2 + maxLayer * LAYER_W + R * 2;
  const canvasH = PAD_Y * 2 + maxInLayer * NODE_H + R * 2;

  const laid = nodes.map(n => {
    const layerNodes = byLayer.get(n.layer)!;
    const idx = layerNodes.indexOf(n);
    const total = layerNodes.length;
    return {
      ...n,
      x: PAD_X + R + n.layer * LAYER_W,
      y: PAD_Y + R + idx * NODE_H + ((maxInLayer - total) * NODE_H) / 2,
    };
  });

  return { nodes: laid, width: canvasW, height: canvasH };
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function edgePath(
  from: DagNode, to: DagNode,
): string {
  const x1 = from.x + R;
  const y1 = from.y;
  const x2 = to.x - R;
  const y2 = to.y;
  const cpx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`;
}

function arrowhead(from: DagNode, to: DagNode): { cx: number; cy: number; angle: number } {
  const x2 = to.x - R;
  const y2 = to.y;
  const x1 = (from.x + R + x2) / 2;
  const y1 = from.y;
  // tangent at x2,y2 of the cubic
  const dx = x2 - x1;
  const dy = y2 - y1;
  return { cx: x2, cy: y2, angle: Math.atan2(dy, dx) * (180 / Math.PI) };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DependencyDagTab() {
  const dark = useDarkMode();
  const { data: projects, isLoading } = useProjects();
  const { data: matrix } = useProjectPodMatrix();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId]   = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPod,    setFilterPod]    = useState<string | null>(null);
  const [zoom,  setZoom]  = useState(1);
  const [pan,   setPan]   = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPt   = useRef({ x: 0, y: 0 });

  // ── Build DagNodes from project + matrix data ──────────────────────────────

  const podColorMap = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    (matrix ?? []).forEach(row => {
      if (!m.has(row.podName)) m.set(row.podName, POD_PALETTE[m.size % POD_PALETTE.length]);
    });
    return m;
  }, [matrix]);

  const allNodes = useMemo<DagNode[]>(() => {
    if (!projects?.length) return [];
    const today  = Date.now();
    const msWeek = 7 * 86_400_000;

    return projects.map(p => {
      const podRows = (matrix ?? [])
        .filter(m => m.projectId === p.id)
        .sort((a, b) => (b.devHours ?? 0) - (a.devHours ?? 0));
      const pod = podRows[0]?.podName ?? 'Unassigned';
      const start = p.startDate ? new Date(p.startDate).getTime() : today;
      const startWeek = Math.max(0, Math.round((start - today) / msWeek));

      const rawStatus = (p.status ?? '').replace('_', ' ').toUpperCase();
      const STATUS_MAP: Record<string, string> = {
        ACTIVE: 'ACTIVE', 'NOT STARTED': 'NOT STARTED', 'IN DISCOVERY': 'IN DISCOVERY',
        'ON HOLD': 'ON HOLD', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
      };

      return {
        id: p.id,
        name: p.name,
        status: STATUS_MAP[rawStatus] ?? rawStatus,
        priority: p.priority ?? 'P2',
        pod,
        startWeek,
        x: 0, y: 0, layer: 0,
      } as DagNode;
    });
  }, [projects, matrix]);

  const { nodes: laidNodes, width: canvasW, height: canvasH } = useMemo(() => {
    const edges = buildEdges(allNodes);
    const withLayers = assignLayers(allNodes, edges);
    return layoutNodes(withLayers);
  }, [allNodes]);

  const edges = useMemo(() => buildEdges(laidNodes), [laidNodes]);

  // Filtered view (only affects visual opacity, not layout positions)
  const visibleIds = useMemo(() => {
    return new Set(
      laidNodes
        .filter(n =>
          (!filterStatus || n.status === filterStatus) &&
          (!filterPod    || n.pod    === filterPod),
        )
        .map(n => n.id),
    );
  }, [laidNodes, filterStatus, filterPod]);

  // ── Highlight: upstream + downstream of selected node ─────────────────────

  const { upstreamIds, downstreamIds } = useMemo(() => {
    if (!selectedId) return { upstreamIds: new Set<number>(), downstreamIds: new Set<number>() };

    const upstream   = new Set<number>();
    const downstream = new Set<number>();

    function walkUp(id: number) {
      edges.filter(e => e.to === id).forEach(e => {
        if (!upstream.has(e.from)) { upstream.add(e.from); walkUp(e.from); }
      });
    }
    function walkDown(id: number) {
      edges.filter(e => e.from === id).forEach(e => {
        if (!downstream.has(e.to)) { downstream.add(e.to); walkDown(e.to); }
      });
    }

    walkUp(selectedId);
    walkDown(selectedId);
    return { upstreamIds: upstream, downstreamIds: downstream };
  }, [selectedId, edges]);

  const selectedNode = useMemo(
    () => laidNodes.find(n => n.id === selectedId) ?? null,
    [laidNodes, selectedId],
  );

  // ── Pan + zoom ─────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2.5, z - e.deltaY * 0.001)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPt.current.x;
    const dy = e.clientY - lastPt.current.y;
    lastPt.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Status options
  const statusOptions = useMemo(() => [
    { value: '', label: 'All Statuses' },
    ...Object.keys(STATUS_COLOR).map(s => ({ value: s, label: s })),
  ], []);

  const podOptions = useMemo(() => [
    { value: '', label: 'All PODs' },
    ...[...podColorMap.keys()].map(pod => ({ value: pod, label: pod })),
  ], [podColorMap]);

  if (isLoading) {
    return <Center h={400}><Loader size="sm" color={AQUA} /></Center>;
  }

  if (!laidNodes.length) {
    return (
      <Center h={300}>
        <Stack align="center" gap="xs">
          <IconInfoCircle size={36} color={AQUA} />
          <Text size="sm" c="dimmed">No project data available to visualise.</Text>
        </Stack>
      </Center>
    );
  }

  const bg   = dark ? '#0f172a' : '#f8fafc';
  const surf = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;
  const bord = dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <Group gap="xs" wrap="nowrap">
        <Select
          size="xs"
          placeholder="All Statuses"
          data={statusOptions}
          value={filterStatus ?? ''}
          onChange={v => setFilterStatus(v || null)}
          style={{ width: 160 }}
          clearable
        />
        <Select
          size="xs"
          placeholder="All PODs"
          data={podOptions}
          value={filterPod ?? ''}
          onChange={v => setFilterPod(v || null)}
          style={{ width: 180 }}
          clearable
        />

        <Box style={{ flex: 1 }} />

        {/* Legend */}
        <Group gap={8} wrap="nowrap">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <Group key={s} gap={4} wrap="nowrap">
              <Box
                style={{ width: 10, height: 10, borderRadius: '50%', background: c.stroke, flexShrink: 0 }}
              />
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{s}</Text>
            </Group>
          ))}
        </Group>

        <Group gap={4}>
          <Tooltip label="Zoom in">
            <ActionIcon size="sm" variant="default" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>
              <IconZoomIn size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Zoom out">
            <ActionIcon size="sm" variant="default" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}>
              <IconZoomOut size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reset view">
            <ActionIcon size="sm" variant="default" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <IconFocusCentered size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* ── Main area: SVG + side panel ───────────────────────────────── */}
      <Box style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

        {/* SVG Canvas */}
        <Box
          style={{
            flex: 1,
            background: bg,
            border: `1px solid ${bord}`,
            borderRadius: 12,
            overflow: 'hidden',
            cursor: dragging.current ? 'grabbing' : 'grab',
            position: 'relative',
            minHeight: 480,
          }}
          onWheel={onWheel as any}
          onMouseDown={onMouseDown as any}
          onMouseMove={onMouseMove as any}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ display: 'block' }}
          >
            <defs>
              {/* Arrow markers */}
              <marker id="arrow-seq"      markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#94a3b8" />
              </marker>
              <marker id="arrow-block"    markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#ef4444" />
              </marker>
              <marker id="arrow-cross"    markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#8b5cf6" />
              </marker>
              <marker id="arrow-up"       markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-down"     markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#22c55e" />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

              {/* ── Edges ─────────────────────────────────────────────── */}
              {edges.map((e, i) => {
                const fromNode = laidNodes.find(n => n.id === e.from);
                const toNode   = laidNodes.find(n => n.id === e.to);
                if (!fromNode || !toNode) return null;

                const bothVisible = visibleIds.has(e.from) && visibleIds.has(e.to);
                const isUpstream   = selectedId != null && (upstreamIds.has(e.from)   || upstreamIds.has(e.to))   && (e.to === selectedId   || upstreamIds.has(e.to));
                const isDownstream = selectedId != null && (downstreamIds.has(e.from) || downstreamIds.has(e.to)) && (e.from === selectedId || downstreamIds.has(e.from));
                const isDimmed     = selectedId != null && !isUpstream && !isDownstream && e.from !== selectedId && e.to !== selectedId;

                let stroke = '#94a3b8';
                let marker = 'arrow-seq';
                if (e.kind === 'blocking')   { stroke = '#ef4444'; marker = 'arrow-block'; }
                if (e.kind === 'cross-pod')  { stroke = '#8b5cf6'; marker = 'arrow-cross'; }
                if (isUpstream)              { stroke = '#f59e0b'; marker = 'arrow-up';    }
                if (isDownstream)            { stroke = '#22c55e'; marker = 'arrow-down';  }

                return (
                  <path
                    key={i}
                    d={edgePath(fromNode, toNode)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isUpstream || isDownstream ? 2.5 : 1.5}
                    strokeDasharray={e.kind === 'blocking' ? '5 3' : undefined}
                    markerEnd={`url(#${marker})`}
                    opacity={!bothVisible ? 0.1 : isDimmed ? 0.15 : 0.75}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                );
              })}

              {/* ── Nodes ─────────────────────────────────────────────── */}
              {laidNodes.map(node => {
                const colors  = STATUS_COLOR[node.status] ?? STATUS_COLOR['NOT STARTED'];
                const podColor = podColorMap.get(node.pod) ?? '#94a3b8';
                const isSelected  = node.id === selectedId;
                const isHovered   = node.id === hoveredId;
                const isUpNode    = upstreamIds.has(node.id);
                const isDownNode  = downstreamIds.has(node.id);
                const isDimmedN   = selectedId != null && !isSelected && !isUpNode && !isDownNode;
                const isInvisible = !visibleIds.has(node.id);

                // Truncate long names
                const label = node.name.length > 14
                  ? node.name.slice(0, 13) + '…'
                  : node.name;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{
                      cursor: 'pointer',
                      opacity: isInvisible ? 0.12 : isDimmedN ? 0.3 : 1,
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => setSelectedId(n => n === node.id ? null : node.id)}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Outer glow ring for selected / highlighted */}
                    {(isSelected || isUpNode || isDownNode) && (
                      <circle
                        r={R + 7}
                        fill="none"
                        stroke={isSelected ? AQUA : isUpNode ? '#f59e0b' : '#22c55e'}
                        strokeWidth={2.5}
                        opacity={0.7}
                        filter="url(#glow)"
                      />
                    )}

                    {/* Main circle */}
                    <circle
                      r={R}
                      fill={isSelected ? DEEP_BLUE : colors.fill}
                      stroke={isSelected ? AQUA : isHovered ? colors.stroke : colors.stroke}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />

                    {/* POD colour stripe (small bottom arc) */}
                    <circle
                      r={R - 4}
                      fill="none"
                      stroke={podColor}
                      strokeWidth={3}
                      strokeDasharray={`${(Math.PI * (R - 4)) * 0.4} ${(Math.PI * (R - 4)) * 1.6}`}
                      strokeDashoffset={`${-(Math.PI * (R - 4)) * 0.3}`}
                      opacity={0.8}
                    />

                    {/* Priority badge (top-right) */}
                    <circle cx={R - 4} cy={-R + 4} r={9} fill={PRIORITY_BADGE[node.priority] ?? '#94a3b8'} />
                    <text
                      x={R - 4} y={-R + 4}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize="7" fontWeight="700" fill="#fff"
                      style={{ fontFamily: FONT_FAMILY, pointerEvents: 'none' }}
                    >
                      {node.priority}
                    </text>

                    {/* Node label below */}
                    <text
                      x={0} y={R + 14}
                      textAnchor="middle"
                      fontSize="10" fontWeight={isSelected ? '700' : '500'}
                      fill={isSelected ? AQUA : dark ? '#cbd5e1' : '#334155'}
                      style={{ fontFamily: FONT_FAMILY, pointerEvents: 'none' }}
                    >
                      {label}
                    </text>

                    {/* Status dot */}
                    <circle
                      cx={-R + 6} cy={-R + 6}
                      r={5}
                      fill={colors.stroke}
                    />
                  </g>
                );
              })}

              {/* ── Hover tooltip ───────────────────────────────────────── */}
              {hoveredId != null && hoveredId !== selectedId && (() => {
                const n = laidNodes.find(x => x.id === hoveredId);
                if (!n) return null;
                const tw = 160, th = 60;
                const tx = n.x + R + 8;
                const ty = n.y - th / 2;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={tx} y={ty} width={tw} height={th} rx={8}
                      fill={dark ? '#1e293b' : '#ffffff'}
                      stroke={bord} strokeWidth={1}
                      style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
                    />
                    <text x={tx + 10} y={ty + 16} fontSize="11" fontWeight="600"
                      fill={dark ? '#f1f5f9' : DEEP_BLUE}
                      style={{ fontFamily: FONT_FAMILY }}>
                      {n.name.length > 20 ? n.name.slice(0, 18) + '…' : n.name}
                    </text>
                    <text x={tx + 10} y={ty + 30} fontSize="10"
                      fill={dark ? '#94a3b8' : '#64748b'}
                      style={{ fontFamily: FONT_FAMILY }}>
                      {n.pod}
                    </text>
                    <text x={tx + 10} y={ty + 46} fontSize="10"
                      fill={STATUS_COLOR[n.status]?.stroke ?? '#94a3b8'}
                      style={{ fontFamily: FONT_FAMILY }}>
                      {n.status} · {n.priority}
                    </text>
                  </g>
                );
              })()}

            </g>
          </svg>

          {/* Zoom indicator */}
          <Box style={{
            position: 'absolute', bottom: 12, right: 12,
            background: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${bord}`, borderRadius: 8,
            padding: '4px 10px',
          }}>
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              {Math.round(zoom * 100)}% · {laidNodes.length} nodes · {edges.length} edges
            </Text>
          </Box>

          {/* Edge type legend */}
          <Box style={{
            position: 'absolute', bottom: 12, left: 12,
            background: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${bord}`, borderRadius: 8,
            padding: '8px 12px',
          }}>
            <Stack gap={4}>
              <Group gap={6} wrap="nowrap">
                <Box style={{ width: 20, height: 2, background: '#94a3b8' }} />
                <Text size="xs" c="dimmed">Sequential</Text>
              </Group>
              <Group gap={6} wrap="nowrap">
                <Box style={{ width: 20, height: 2, background: '#ef4444', borderTop: '2px dashed #ef4444' }} />
                <Text size="xs" c="dimmed">Blocking</Text>
              </Group>
              <Group gap={6} wrap="nowrap">
                <Box style={{ width: 20, height: 2, background: '#8b5cf6' }} />
                <Text size="xs" c="dimmed">Cross-POD</Text>
              </Group>
            </Stack>
          </Box>
        </Box>

        {/* ── Detail panel ────────────────────────────────────────────── */}
        <Box style={{ width: 260, flexShrink: 0 }}>
          <Paper
            p="md"
            style={{
              background: surf,
              border: `1px solid ${bord}`,
              borderRadius: 12,
              height: '100%',
              minHeight: 480,
            }}
          >
            {selectedNode ? (
              <Stack gap="md">
                <Box>
                  <Text size="xs" c="dimmed" mb={4} tt="uppercase" fw={600}
                    style={{ letterSpacing: '0.05em' }}>
                    Selected Project
                  </Text>
                  <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                    {selectedNode.name}
                  </Text>
                </Box>

                <Stack gap={6}>
                  <Group gap={6}>
                    <Badge
                      size="sm"
                      style={{
                        background: STATUS_COLOR[selectedNode.status]?.fill ?? '#f1f5f9',
                        color: STATUS_COLOR[selectedNode.status]?.label ?? '#64748b',
                        border: `1px solid ${STATUS_COLOR[selectedNode.status]?.stroke ?? '#94a3b8'}`,
                      }}
                    >
                      {selectedNode.status}
                    </Badge>
                    <Badge
                      size="sm"
                      style={{
                        background: PRIORITY_BADGE[selectedNode.priority] + '22',
                        color: PRIORITY_BADGE[selectedNode.priority] ?? '#94a3b8',
                        border: `1px solid ${PRIORITY_BADGE[selectedNode.priority] ?? '#94a3b8'}44`,
                      }}
                    >
                      {selectedNode.priority}
                    </Badge>
                  </Group>
                  <Group gap={6}>
                    <Box
                      style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: podColorMap.get(selectedNode.pod) ?? '#94a3b8',
                      }}
                    />
                    <Text size="xs" c="dimmed">{selectedNode.pod}</Text>
                  </Group>
                </Stack>

                <Divider />

                {/* Upstream blockers */}
                <Box>
                  <Group gap={6} mb={6}>
                    <Box style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                    <Text size="xs" fw={600} style={{ color: '#b45309' }}>
                      Upstream Blockers ({upstreamIds.size})
                    </Text>
                  </Group>
                  {upstreamIds.size === 0 ? (
                    <Text size="xs" c="dimmed">No dependencies</Text>
                  ) : (
                    <ScrollArea.Autosize mah={120}>
                      <Stack gap={4}>
                        {[...upstreamIds].map(uid => {
                          const un = laidNodes.find(n => n.id === uid);
                          if (!un) return null;
                          return (
                            <Group
                              key={uid} gap={6} wrap="nowrap"
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedId(uid)}
                            >
                              <Box style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: STATUS_COLOR[un.status]?.stroke ?? '#94a3b8',
                              }} />
                              <Text size="xs" truncate>{un.name}</Text>
                            </Group>
                          );
                        })}
                      </Stack>
                    </ScrollArea.Autosize>
                  )}
                </Box>

                <Divider />

                {/* Downstream impact */}
                <Box>
                  <Group gap={6} mb={6}>
                    <Box style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                    <Text size="xs" fw={600} style={{ color: '#15803d' }}>
                      Impact / Downstream ({downstreamIds.size})
                    </Text>
                  </Group>
                  {downstreamIds.size === 0 ? (
                    <Text size="xs" c="dimmed">No dependants</Text>
                  ) : (
                    <ScrollArea.Autosize mah={120}>
                      <Stack gap={4}>
                        {[...downstreamIds].map(did => {
                          const dn = laidNodes.find(n => n.id === did);
                          if (!dn) return null;
                          return (
                            <Group
                              key={did} gap={6} wrap="nowrap"
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedId(did)}
                            >
                              <Box style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: STATUS_COLOR[dn.status]?.stroke ?? '#94a3b8',
                              }} />
                              <Text size="xs" truncate>{dn.name}</Text>
                            </Group>
                          );
                        })}
                      </Stack>
                    </ScrollArea.Autosize>
                  )}
                </Box>
              </Stack>
            ) : (
              <Stack align="center" justify="center" h="100%" gap="xs">
                <IconCircleFilled size={32} color={dark ? '#334155' : '#e2e8f0'} />
                <Text size="sm" c="dimmed" ta="center">
                  Click a node to see its upstream blockers and downstream impact.
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  Scroll to zoom · Drag to pan
                </Text>
              </Stack>
            )}
          </Paper>
        </Box>
      </Box>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <Group gap="xs">
        {Object.entries(STATUS_COLOR).map(([status, colors]) => {
          const count = laidNodes.filter(n => n.status === status).length;
          if (count === 0) return null;
          return (
            <Paper
              key={status}
              px="sm" py={4}
              style={{
                background: colors.fill,
                border: `1px solid ${colors.stroke}44`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onClick={() => setFilterStatus(s => s === status ? null : status)}
            >
              <Group gap={6}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: colors.stroke }} />
                <Text size="xs" style={{ color: colors.label, fontWeight: 600 }}>
                  {count} {status}
                </Text>
              </Group>
            </Paper>
          );
        })}
      </Group>
    </Box>
  );
}
