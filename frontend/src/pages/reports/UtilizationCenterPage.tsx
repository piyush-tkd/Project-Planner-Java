import { useState, useMemo } from 'react';
import {
  Tabs, Badge, Group, Text, SegmentedControl, MultiSelect, ScrollArea, Stack,
  Modal, SimpleGrid, Paper, Box, Card, Button, ThemeIcon, ActionIcon, Divider,
  Table, Tooltip, Alert, Collapse, Anchor,
} from '@mantine/core';
import {
  IconFlame, IconBulb, IconChartBar, IconArrowsLeftRight,
  IconUsers, IconTrendingDown, IconTrendingUp, IconAlertTriangle, IconCheck, IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useCapacityGap, useUtilizationHeatmap, useConcurrencyRisk } from '../../api/reports';
import { useProjectPodMatrix } from '../../api/projects';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getGapCellColor, getUtilizationBgColor, getConcurrencyColorByLevel } from '../../utils/colors';
import { formatGapHours, formatGapFte, formatPercent, formatHours } from '../../utils/formatting';
import HeatmapChart from '../../components/charts/HeatmapChart';
import CapacityBarChart from '../../components/charts/CapacityBarChart';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import MonthHeader from '../../components/common/MonthHeader';
import PageError from '../../components/common/PageError';
import ReportPageShell, { SummaryCardItem } from '../../components/common/ReportPageShell';
import ExportableChart from '../../components/common/ExportableChart';
import ChartCard from '../../components/common/ChartCard';
import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Local Types ───────────────────────────────────────────────────────────────

interface PodMonthGap {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  demandHours: number;
  capacityHours: number;
  gapHours: number;
  gapFte: number;
}

interface RebalanceSuggestion {
  id: string;
  fromPod: string;
  toPod: string;
  months: string[];
  fromAvgFte: number;
  toAvgFte: number;
  suggestedFte: number;
  impact: number;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function getSlackColors(gapHours: number, isDark = false): { bg: string; text: string } {
  if (isDark) {
    if (gapHours > 160) return { bg: 'rgba(47,158,68,0.35)', text: '#69db7c' };
    if (gapHours > 0)   return { bg: 'rgba(64,192,87,0.12)', text: '#51cf66' };
    if (Math.abs(gapHours) <= 8) return { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.5)' };
    if (gapHours > -160) return { bg: 'rgba(230,119,0,0.20)', text: '#ffc078' };
    return { bg: 'rgba(201,42,42,0.30)', text: '#ff8787' };
  }
  if (gapHours > 160) return { bg: '#d3f9d8', text: '#2f9e44' };
  if (gapHours > 0)   return { bg: '#ebfbee', text: '#40c057' };
  if (Math.abs(gapHours) <= 8) return { bg: '#f8f9fa', text: '#868e96' };
  if (gapHours > -160) return { bg: '#fff3bf', text: '#e67700' };
  return { bg: '#ffe3e3', text: '#c92a2a' };
}

// ── Smart Rebalancing Algorithm ───────────────────────────────────────────────

function computeSuggestions(
  gaps: PodMonthGap[],
  monthLabels: Record<number, string>,
): RebalanceSuggestion[] {
  // Build POD → month → gap map
  const podMap: Record<string, Record<number, { gapFte: number }>> = {};
  gaps.forEach(g => {
    if (!podMap[g.podName]) podMap[g.podName] = {};
    podMap[g.podName][g.monthIndex] = { gapFte: g.gapFte };
  });

  const pods = Object.keys(podMap);
  const suggestions: RebalanceSuggestion[] = [];

  for (const defPod of pods) {
    for (const surPod of pods) {
      if (defPod === surPod) continue;

      // Months where defPod is in deficit AND surPod has surplus
      const monthIndices = Object.keys(podMap[defPod])
        .map(Number)
        .filter(m => {
          const defGap = podMap[defPod][m]?.gapFte ?? 0;
          const surGap = podMap[surPod][m]?.gapFte ?? 0;
          return defGap < -0.1 && surGap > 0.1;
        });

      if (monthIndices.length < 1) continue;

      const avgDef = monthIndices.reduce((s, m) => s + Math.abs(podMap[defPod][m].gapFte), 0) / monthIndices.length;
      const avgSur = monthIndices.reduce((s, m) => s + (podMap[surPod][m]?.gapFte ?? 0), 0) / monthIndices.length;
      const suggestedFte = Math.min(avgDef, avgSur * 0.7);

      if (suggestedFte < 0.1) continue;

      suggestions.push({
        id: `${surPod}→${defPod}`,
        fromPod: surPod,
        toPod: defPod,
        months: monthIndices.sort((a, b) => a - b).map(m => monthLabels[m] ?? `M${m}`),
        fromAvgFte: avgSur,
        toAvgFte: avgDef,
        suggestedFte: Math.round(suggestedFte * 10) / 10,
        impact: avgDef * monthIndices.length,
      });
    }
  }

  return suggestions.sort((a, b) => b.impact - a.impact).slice(0, 10);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UtilizationCenterPage() {
  const dark = useDarkMode();
  const navigate = useNavigate();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const [activeTab, setActiveTab] = useState<string | null>('utilization');

  // Shared data
  const { data: gapData, isLoading: gapLoading, error: gapError } = useCapacityGap();
  const { data: utilData, isLoading: utilLoading, error: utilError } = useUtilizationHeatmap();
  const { data: concurrencyData } = useConcurrencyRisk();
  const { data: matrixData } = useProjectPodMatrix();

  // Detect active projects with POD assignments that are invisible to demand calculation:
  // either (a) all role hours are zero, or (b) has hours but no effort pattern assigned
  const missingDemandProjects = useMemo(() => {
    if (!matrixData) return [];
    const ACTIVE_STATUSES = ['ACTIVE', 'IN_DISCOVERY', 'NOT_STARTED', 'ON_HOLD'];

    // Per planning row, track the issues
    type RowIssue = { podName: string; reason: 'no-hours' | 'no-pattern' };
    const projectMap = new Map<number, { name: string; status: string; issues: RowIssue[] }>();

    for (const row of matrixData) {
      if (!ACTIVE_STATUSES.includes(row.status)) continue;
      const rowHours = (row.devHours ?? 0) + (row.qaHours ?? 0) + (row.bsaHours ?? 0) + (row.techLeadHours ?? 0);
      const effectivePattern = row.effortPattern ?? row.defaultPattern;

      let reason: 'no-hours' | 'no-pattern' | null = null;
      if (rowHours === 0) reason = 'no-hours';
      else if (!effectivePattern) reason = 'no-pattern';

      if (reason) {
        const existing = projectMap.get(row.projectId);
        if (existing) {
          existing.issues.push({ podName: row.podName, reason });
        } else {
          projectMap.set(row.projectId, {
            name: row.projectName,
            status: row.status,
            issues: [{ podName: row.podName, reason }],
          });
        }
      }
    }
    return Array.from(projectMap.entries()).map(([id, v]) => ({ id, ...v }));
  }, [matrixData]);

  const [zeroHoursExpanded, setZeroHoursExpanded] = useState(false);

  const gaps: PodMonthGap[] = gapData?.gaps ?? [];
  const allPodNames = useMemo(() => [...new Set(gaps.map(g => g.podName))].sort(), [gaps]);

  // Summary cards (shared across all tabs)
  const summaryCards = useMemo<SummaryCardItem[]>(() => {
    if (!gapData || !utilData) return [];
    const utilVals = utilData.map(u => u.utilizationPct);
    const avgUtil = utilVals.length ? utilVals.reduce((s, v) => s + v, 0) / utilVals.length : 0;
    const peakUtil = utilVals.length ? Math.max(...utilVals) : 0;
    const overloadedPods = new Set(utilData.filter(u => u.utilizationPct > 100).map(u => u.podName)).size;
    const netGapFte = gaps.reduce((s, g) => s + g.gapFte, 0);
    return [
      { label: 'PODs', value: allPodNames.length, icon: <IconUsers size={18} />, color: 'blue' },
      { label: 'Avg Utilization', value: formatPercent(avgUtil), icon: <IconFlame size={18} />, color: avgUtil > 100 ? 'orange' : 'teal' },
      { label: 'Peak Utilization', value: formatPercent(peakUtil), icon: <IconAlertTriangle size={18} />, color: peakUtil > 120 ? 'red' : 'orange' },
      { label: 'Overloaded PODs', value: overloadedPods, icon: <IconTrendingDown size={18} />, color: overloadedPods > 0 ? 'red' : 'teal' },
      { label: 'Net Gap (FTE)', value: formatGapFte(netGapFte), icon: <IconChartBar size={18} />, color: netGapFte >= 0 ? 'teal' : 'red' },
    ];
  }, [gapData, utilData, gaps, allPodNames]);

  // ── All hooks must come before any conditional returns ──────────────────
  const suggestionCount = useMemo(() => computeSuggestions(gaps, monthLabels).length, [gaps, monthLabels]);

  if (gapLoading || utilLoading) return <LoadingSpinner variant="chart" message="Loading utilization data…" />;
  if (gapError) return <PageError context="loading capacity data" error={gapError} />;
  if (utilError) return <PageError context="loading utilization data" error={utilError} />;

  return (
    <ReportPageShell
      title="Utilization Center"
      subtitle="Capacity health · Slack & buffer · Rebalancing opportunities"
      summaryCards={summaryCards}
    >
      {/* ── Demand data quality warning ───────────────────────────────────────── */}
      {missingDemandProjects.length > 0 && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="yellow"
          variant="light"
          mb="md"
          style={{ borderRadius: 10 }}
          title={
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={600}>
                {missingDemandProjects.length} project{missingDemandProjects.length > 1 ? 's' : ''} contribute 0 demand hours (hidden from utilization)
              </Text>
              <Anchor
                size="xs"
                fw={600}
                onClick={() => setZeroHoursExpanded(e => !e)}
                style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                {zeroHoursExpanded ? 'Hide' : 'Show all'}
              </Anchor>
            </Group>
          }
        >
          <Text size="xs" c="dimmed" mb={zeroHoursExpanded ? 8 : 0}>
            These projects appear in the Concurrency Grid but show 0% utilization. Each POD assignment
            either has no hours entered, or is missing an effort pattern. Open the project to fix.
          </Text>
          <Collapse in={zeroHoursExpanded}>
            <Stack gap={4} mt={4}>
              {missingDemandProjects.map(p => (
                <Group key={p.id} gap={8} wrap="nowrap" align="flex-start">
                  <IconAlertTriangle size={12} color="#f59e0b" style={{ marginTop: 3 }} />
                  <div>
                    <Group gap={6} wrap="nowrap">
                      <Anchor
                        size="xs"
                        fw={500}
                        onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {p.name}
                      </Anchor>
                      {p.status !== 'ACTIVE' && (
                        <Badge size="xs" variant="outline" color="gray">{p.status.replace(/_/g, ' ')}</Badge>
                      )}
                    </Group>
                    {p.issues.map((issue, i) => (
                      <Text key={i} size="xs" c="dimmed">
                        → {issue.podName}:{' '}
                        <Text span c="yellow.7" fw={500}>
                          {issue.reason === 'no-hours' ? 'no hours entered' : 'no effort pattern'}
                        </Text>
                      </Text>
                    ))}
                  </div>
                </Group>
              ))}
            </Stack>
          </Collapse>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          root: { '--tabs-color': AQUA },
          list: {
            padding: '4px 6px',
            gap: 2,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
            borderRadius: 12,
            border: `1px solid ${dark ? 'rgba(45,204,211,0.12)' : 'rgba(12,35,64,0.08)'}`,
            marginBottom: 20,
            '&::before': { display: 'none' },           // remove Mantine's default bottom border
          },
          tab: {
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 8,
            padding: '8px 16px',
            color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)',
            border: 'none',
            transition: 'all 180ms ease',
            '&[data-active]': {
              background: dark ? 'rgba(45,204,211,0.14)' : '#ffffff',
              color: dark ? AQUA : DEEP_BLUE,
              boxShadow: dark
                ? `0 0 0 1px ${AQUA}30, 0 2px 8px rgba(0,0,0,0.3)`
                : '0 1px 6px rgba(12,35,64,0.12), 0 0 0 1px rgba(12,35,64,0.06)',
              borderBottom: `2.5px solid ${AQUA}`,
            },
            '&:hover:not([data-active])': {
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,35,64,0.05)',
              color: dark ? 'rgba(255,255,255,0.8)' : DEEP_BLUE,
            },
          },
          panel: { paddingTop: 4 },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="utilization"
            leftSection={<IconFlame size={15} color={activeTab === 'utilization' ? '#ff6b35' : undefined} />}
          >
            Utilization %
          </Tabs.Tab>

          <Tabs.Tab
            value="slack"
            leftSection={<IconBulb size={15} color={activeTab === 'slack' ? '#ffd43b' : undefined} />}
          >
            Slack &amp; Buffer
          </Tabs.Tab>

          <Tabs.Tab
            value="gap"
            leftSection={<IconChartBar size={15} color={activeTab === 'gap' ? AQUA : undefined} />}
          >
            Capacity Gap
          </Tabs.Tab>

          <Tabs.Tab
            value="concurrency"
            leftSection={<IconAlertTriangle size={15} color={activeTab === 'concurrency' ? '#f59e0b' : undefined} />}
          >
            Concurrency Risk
          </Tabs.Tab>

          <Tabs.Tab
            value="rebalance"
            leftSection={<IconArrowsLeftRight size={15} color={activeTab === 'rebalance' ? '#cc5de8' : undefined} />}
          >
            <Group gap={6} wrap="nowrap">
              Smart Rebalancing
              {suggestionCount > 0 && (
                <Badge
                  size="xs"
                  variant="gradient"
                  gradient={{ from: 'orange', to: 'red' }}
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    fontSize: 10,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 700,
                    boxShadow: '0 1px 4px rgba(255,100,0,0.35)',
                  }}
                >
                  {suggestionCount}
                </Badge>
              )}
            </Group>
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Tab 1: Utilization % ──────────────────────────────────────────── */}
        <Tabs.Panel value="utilization">
          <UtilizationTab data={utilData ?? []} monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} dark={dark} />
        </Tabs.Panel>

        {/* ── Tab 2: Slack & Buffer ─────────────────────────────────────────── */}
        <Tabs.Panel value="slack">
          <SlackBufferTab gaps={gaps} allPodNames={allPodNames} monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} dark={dark} />
        </Tabs.Panel>

        {/* ── Tab 3: Capacity Gap ───────────────────────────────────────────── */}
        <Tabs.Panel value="gap">
          <CapacityGapTab gaps={gaps} monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} dark={dark} />
        </Tabs.Panel>

        {/* ── Tab 4: Concurrency Risk ───────────────────────────────────────── */}
        <Tabs.Panel value="concurrency">
          <ConcurrencyRiskTab data={concurrencyData ?? []} gapData={gapData} monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} dark={dark} />
        </Tabs.Panel>

        {/* ── Tab 5: Smart Rebalancing ─────────────────────────────────────── */}
        <Tabs.Panel value="rebalance">
          <SmartRebalancingTab gaps={gaps} monthLabels={monthLabels} dark={dark} onNavigate={() => navigate('/overrides')} />
        </Tabs.Panel>
      </Tabs>
    </ReportPageShell>
  );
}

// ── Tab Components ────────────────────────────────────────────────────────────

function UtilizationTab({
  data,
  monthLabels,
  currentMonthIndex,
  dark,
}: {
  data: { podName: string; monthIndex: number; utilizationPct: number }[];
  monthLabels: Record<number, string>;
  currentMonthIndex: number;
  dark: boolean;
}) {
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'peak' | 'avg'>('name');

  const allPods = useMemo(() => [...new Set(data.map(u => u.podName))].sort(), [data]);

  const heatmapRows = useMemo(() => {
    const podMap = new Map<string, { month: number; value: number; display: string }[]>();
    data.forEach(u => {
      if (selectedPods.length > 0 && !selectedPods.includes(u.podName)) return;
      const arr = podMap.get(u.podName) ?? [];
      arr.push({ month: u.monthIndex, value: u.utilizationPct, display: formatPercent(u.utilizationPct) });
      podMap.set(u.podName, arr);
    });
    const rows = Array.from(podMap.entries()).map(([label, values]) => ({ label, values }));
    return rows.sort((a, b) => {
      if (sortBy === 'name') return a.label.localeCompare(b.label);
      const avgA = a.values.reduce((s, v) => s + v.value, 0) / (a.values.length || 1);
      const avgB = b.values.reduce((s, v) => s + v.value, 0) / (b.values.length || 1);
      const peakA = Math.max(...a.values.map(v => v.value));
      const peakB = Math.max(...b.values.map(v => v.value));
      return sortBy === 'peak' ? peakB - peakA : avgB - avgA;
    });
  }, [data, selectedPods, sortBy]);

  return (
    <Stack gap="md">
      <Group gap="md" align="flex-end" wrap="wrap">
        <MultiSelect
          label="Filter PODs"
          placeholder="All PODs"
          data={allPods}
          value={selectedPods}
          onChange={setSelectedPods}
          clearable searchable
          style={{ minWidth: 240, maxWidth: 400 }}
          size="sm"
        />
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Sort rows by</Text>
          <SegmentedControl
            value={sortBy}
            onChange={v => setSortBy(v as 'name' | 'peak' | 'avg')}
            data={[{ value: 'name', label: 'Name' }, { value: 'peak', label: 'Peak %' }, { value: 'avg', label: 'Avg %' }]}
            size="sm"
          />
        </Box>
        <Group gap="sm" ml="auto">
          {[
            { label: '<80%', bg: dark ? 'rgba(64,192,87,0.15)' : '#d3f9d8', text: '#40c057' },
            { label: '80–100%', bg: dark ? 'rgba(250,176,5,0.15)' : '#fff3bf', text: '#e67700' },
            { label: '100–120%', bg: dark ? 'rgba(253,126,20,0.2)' : '#ffe8cc', text: '#e8590c' },
            { label: '>120%', bg: dark ? 'rgba(250,82,82,0.2)' : '#ffe3e3', text: '#c92a2a' },
          ].map(item => (
            <Group key={item.label} gap={4} wrap="nowrap">
              <Box style={{ width: 14, height: 14, background: item.bg, border: `1px solid ${item.text}`, borderRadius: 3 }} />
              <Text size="xs" c="dimmed">{item.label}</Text>
            </Group>
          ))}
        </Group>
      </Group>
      <ExportableChart title="Utilization Heatmap">
        <HeatmapChart rows={heatmapRows} monthLabels={monthLabels} colorFn={getUtilizationBgColor} currentMonthIndex={currentMonthIndex} />
      </ExportableChart>
    </Stack>
  );
}

function SlackBufferTab({
  gaps,
  allPodNames,
  monthLabels,
  currentMonthIndex,
  dark,
}: {
  gaps: PodMonthGap[];
  allPodNames: string[];
  monthLabels: Record<number, string>;
  currentMonthIndex: number;
  dark: boolean;
}) {
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'hours' | 'fte'>('hours');
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedCell, setSelectedCell] = useState<PodMonthGap | null>(null);

  const months = useMemo(() => [...new Set(gaps.map(g => g.monthIndex))].sort((a, b) => a - b), [gaps]);
  const filteredGaps = useMemo(() =>
    selectedPods.length === 0 ? gaps : gaps.filter(g => selectedPods.includes(g.podName)),
    [gaps, selectedPods]);

  const monthTotals = useMemo(() => {
    const totals = new Map<number, { hours: number; fte: number }>();
    filteredGaps.forEach(g => {
      const cur = totals.get(g.monthIndex) ?? { hours: 0, fte: 0 };
      cur.hours += g.gapHours; cur.fte += g.gapFte;
      totals.set(g.monthIndex, cur);
    });
    return totals;
  }, [filteredGaps]);

  const podOptions = allPodNames.map(p => ({ value: p, label: p }));
  const TH_STYLE: React.CSSProperties = {
    background: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE,
    color: dark ? 'rgba(255,255,255,0.9)' : '#fff',
    padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' as const,
    borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : undefined,
  };

  return (
    <Stack gap="md">
      <Group gap="md" align="flex-end" wrap="wrap">
        <MultiSelect
          label="Filter PODs" placeholder="All PODs"
          data={podOptions} value={selectedPods} onChange={setSelectedPods}
          style={{ flex: '0 1 280px' }} size="sm"
        />
        <SegmentedControl
          value={viewMode} onChange={v => setViewMode(v as 'hours' | 'fte')}
          data={[{ value: 'hours', label: 'Hours' }, { value: 'fte', label: 'FTE' }]}
          size="sm"
        />
        <Group gap="xs" ml="auto">
          {[
            { range: '>160h', bg: dark ? 'rgba(47,158,68,0.35)' : '#d3f9d8', text: dark ? '#69db7c' : '#2f9e44' },
            { range: '0–160h', bg: dark ? 'rgba(64,192,87,0.12)' : '#ebfbee', text: dark ? '#51cf66' : '#40c057' },
            { range: '±0', bg: dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa', text: dark ? 'rgba(255,255,255,0.4)' : '#868e96' },
            { range: '-160–0', bg: dark ? 'rgba(230,119,0,0.20)' : '#fff3bf', text: dark ? '#ffc078' : '#e67700' },
            { range: '<-160h', bg: dark ? 'rgba(201,42,42,0.30)' : '#ffe3e3', text: dark ? '#ff8787' : '#c92a2a' },
          ].map(item => (
            <Group key={item.range} gap={4} wrap="nowrap">
              <Box style={{ width: 14, height: 14, background: item.bg, border: `1px solid ${item.text}`, borderRadius: 3 }} />
              <Text size="xs" c="dimmed">{item.range}</Text>
            </Group>
          ))}
        </Group>
      </Group>

      <ScrollArea>
        <table style={{ borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...TH_STYLE, textAlign: 'left', minWidth: 130, position: 'sticky', left: 0, zIndex: 2 }}>POD</th>
              {months.map(m => (
                <th key={m} style={{ ...TH_STYLE, textAlign: 'center', minWidth: 90,
                  background: m === currentMonthIndex ? (dark ? 'rgba(45,204,211,0.25)' : AQUA) : TH_STYLE.background,
                }}>
                  <Stack gap={0}>
                    <Text size="xs" fw={600}>{monthLabels[m] ?? `M${m}`}</Text>
                    {m === currentMonthIndex && <Badge size="xs" color="white" c={dark ? 'white' : AQUA} variant="filled">Now</Badge>}
                  </Stack>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPodNames.map(podName => (
              <tr key={podName}>
                <td style={{ background: dark ? 'rgba(255,255,255,0.04)' : DEEP_BLUE, color: dark ? 'rgba(255,255,255,0.9)' : '#fff',
                  padding: '10px 12px', fontWeight: 600, position: 'sticky', left: 0, zIndex: 1,
                  borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                  {podName}
                </td>
                {months.map(m => {
                  const gap = filteredGaps.find(g => g.podName === podName && g.monthIndex === m);
                  if (!gap) return (
                    <td key={m} style={{ padding: '10px 12px', textAlign: 'center', color: dark ? 'rgba(255,255,255,0.2)' : '#ccc',
                      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e9ecef'}` }}>—</td>
                  );
                  const displayHours = viewMode === 'hours' ? gap.gapHours : gap.gapFte * 160;
                  const cols = getSlackColors(displayHours, dark);
                  return (
                    <td key={m} onClick={() => { setSelectedCell(gap); setModalOpened(true); }}
                      style={{ background: cols.bg, padding: '10px 12px', textAlign: 'center', cursor: 'pointer',
                        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e9ecef'}`,
                        transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      <Stack gap={1}>
                        <Text fw={700} size="sm" c={cols.text} style={{ lineHeight: 1 }}>
                          {viewMode === 'hours' ? formatGapHours(gap.gapHours) : formatGapFte(gap.gapFte)}
                        </Text>
                        <Text size="xs" c={cols.text} style={{ opacity: 0.7, lineHeight: 1 }}>
                          {viewMode === 'hours' ? formatGapFte(gap.gapFte) : formatGapHours(gap.gapHours)}
                        </Text>
                      </Stack>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Totals row */}
            <tr>
              <td style={{ background: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE, color: dark ? 'rgba(255,255,255,0.9)' : '#fff',
                padding: '10px 12px', fontWeight: 600, position: 'sticky', left: 0, zIndex: 1 }}>Total</td>
              {months.map(m => {
                const t = monthTotals.get(m) ?? { hours: 0, fte: 0 };
                const cols = getSlackColors(viewMode === 'hours' ? t.hours : t.fte * 160, dark);
                return (
                  <td key={m} style={{ background: cols.bg, padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                    <Text fw={700} size="sm" c={cols.text}>
                      {viewMode === 'hours' ? formatGapHours(t.hours) : formatGapFte(t.fte)}
                    </Text>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </ScrollArea>

      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title="Capacity Detail" size="sm"
        styles={{ title: { fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 700 } }}>
        {selectedCell && (
          <Stack gap="md">
            <div>
              <Text fw={600} size="lg">{selectedCell.podName}</Text>
              <Text size="sm" c="dimmed">{selectedCell.monthLabel}</Text>
            </div>
            <SimpleGrid cols={2}>
              <Paper p="md" withBorder>
                <Text size="xs" c="dimmed">Capacity</Text>
                <Text fw={700} size="lg">{formatGapHours(selectedCell.capacityHours)}</Text>
                <Text size="xs" c="dimmed">{formatGapFte(selectedCell.capacityHours / 160)}</Text>
              </Paper>
              <Paper p="md" withBorder>
                <Text size="xs" c="dimmed">Demand</Text>
                <Text fw={700} size="lg">{formatGapHours(selectedCell.demandHours)}</Text>
                <Text size="xs" c="dimmed">{formatGapFte(selectedCell.demandHours / 160)}</Text>
              </Paper>
            </SimpleGrid>
            <Paper p="md" withBorder style={{ background: getSlackColors(selectedCell.gapHours, dark).bg }}>
              <Text size="xs" c="dimmed" mb={4}>Available Capacity (Gap)</Text>
              <Group gap="xl">
                <div>
                  <Text fw={700} size="xl" c={getSlackColors(selectedCell.gapHours, dark).text}>{formatGapHours(selectedCell.gapHours)}</Text>
                  <Text size="xs" c="dimmed">Hours</Text>
                </div>
                <div>
                  <Text fw={700} size="xl" c={getSlackColors(selectedCell.gapHours, dark).text}>{formatGapFte(selectedCell.gapFte)}</Text>
                  <Text size="xs" c="dimmed">FTE</Text>
                </div>
              </Group>
            </Paper>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function CapacityGapTab({
  gaps,
  monthLabels,
  currentMonthIndex,
  dark,
}: {
  gaps: PodMonthGap[];
  monthLabels: Record<number, string>;
  currentMonthIndex: number;
  dark: boolean;
}) {
  const [unit, setUnit] = useState<'hours' | 'fte'>('hours');

  const heatmapRows = useMemo(() => {
    const podMap = new Map<string, { month: number; value: number; display: string }[]>();
    gaps.forEach(g => {
      const arr = podMap.get(g.podName) ?? [];
      const gap = unit === 'hours' ? g.gapHours : g.gapFte;
      arr.push({ month: g.monthIndex, value: gap, display: unit === 'hours' ? formatGapHours(gap) : formatGapFte(gap) });
      podMap.set(g.podName, arr);
    });
    return Array.from(podMap.entries()).map(([label, values]) => ({ label, values }));
  }, [gaps, unit]);

  const workingHoursMap = useMemo(() => {
    const map: Record<number, number> = {};
    gaps.forEach(g => {
      if (g.gapFte !== 0 && g.gapHours !== 0 && !map[g.monthIndex]) {
        map[g.monthIndex] = Math.abs(g.gapHours / g.gapFte);
      }
    });
    return map;
  }, [gaps]);

  const chartData = useMemo(() => {
    const monthMap = new Map<number, { demand: number; capacity: number }>();
    gaps.forEach(g => {
      const ex = monthMap.get(g.monthIndex) ?? { demand: 0, capacity: 0 };
      ex.demand += g.demandHours; ex.capacity += g.capacityHours;
      monthMap.set(g.monthIndex, ex);
    });
    return Array.from(monthMap.entries()).sort(([a], [b]) => a - b).map(([m, v]) => {
      const wh = workingHoursMap[m] ?? 160;
      if (unit === 'fte') {
        return { month: monthLabels[m] ?? `M${m}`, demand: Math.round((v.demand / wh) * 10) / 10, capacity: Math.round((v.capacity / wh) * 10) / 10 };
      }
      return { month: monthLabels[m] ?? `M${m}`, demand: Math.round(v.demand), capacity: Math.round(v.capacity) };
    });
  }, [gaps, unit, monthLabels, workingHoursMap]);

  return (
    <Stack gap="md">
      <Group gap="md" align="flex-end" wrap="wrap">
        <SegmentedControl
          value={unit} onChange={v => setUnit(v as 'hours' | 'fte')}
          data={[{ value: 'hours', label: 'Hours' }, { value: 'fte', label: 'FTE' }]}
          size="sm"
        />
        <Group gap="sm" ml="auto">
          <Badge color="green" variant="light" size="sm">+ Surplus (capacity &gt; demand)</Badge>
          <Badge color="red" variant="light" size="sm">− Deficit (hiring needed)</Badge>
        </Group>
      </Group>
      <ChartCard title="Capacity Gap Heatmap" minHeight={0}>
        <HeatmapChart rows={heatmapRows} monthLabels={monthLabels} colorFn={getGapCellColor} currentMonthIndex={currentMonthIndex} />
      </ChartCard>
      <ChartCard title="Demand vs Capacity" minHeight={350}>
        <CapacityBarChart data={chartData} unit={unit} />
      </ChartCard>
    </Stack>
  );
}

function SmartRebalancingTab({
  gaps,
  monthLabels,
  dark,
  onNavigate,
}: {
  gaps: PodMonthGap[];
  monthLabels: Record<number, string>;
  dark: boolean;
  onNavigate: () => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => computeSuggestions(gaps, monthLabels), [gaps, monthLabels]);
  const visible = suggestions.filter(s => !dismissed.has(s.id));

  // POD-level summary: overloaded vs underloaded
  const podSummary = useMemo(() => {
    const map = new Map<string, { totalGapFte: number; months: number }>();
    gaps.forEach(g => {
      const cur = map.get(g.podName) ?? { totalGapFte: 0, months: 0 };
      cur.totalGapFte += g.gapFte;
      cur.months += 1;
      map.set(g.podName, cur);
    });
    return Array.from(map.entries())
      .map(([pod, v]) => ({ pod, avgFte: v.totalGapFte / (v.months || 1) }))
      .sort((a, b) => a.avgFte - b.avgFte); // overloaded first
  }, [gaps]);

  const overloaded = podSummary.filter(p => p.avgFte < -0.3);
  const underloaded = podSummary.filter(p => p.avgFte > 0.3);

  if (visible.length === 0 && overloaded.length === 0) {
    return (
      <Card withBorder padding="xl" style={{ textAlign: 'center' }}>
        <ThemeIcon size={48} radius="xl" variant="light" color="teal" mx="auto" mb="md">
          <IconCheck size={24} />
        </ThemeIcon>
        <Text fw={600} size="lg" mb={4}>All PODs are balanced</Text>
        <Text c="dimmed" size="sm">No significant capacity imbalances detected. Check back after projects are updated.</Text>
      </Card>
    );
  }

  return (
    <Stack gap="xl">
      {/* POD Balance Overview */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Overloaded */}
        <Card withBorder padding="lg" style={{ borderColor: dark ? '#c92a2a' : '#ffc9c9' }}>
          <Group mb="md">
            <ThemeIcon size={32} radius="xl" variant="light" color="red">
              <IconTrendingDown size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: dark ? '#ff8787' : '#c92a2a' }}>
                Overloaded PODs
              </Text>
              <Text size="xs" c="dimmed">Avg demand exceeds capacity</Text>
            </div>
          </Group>
          {overloaded.length === 0
            ? <Text c="dimmed" size="sm">None</Text>
            : overloaded.map(p => (
              <Group key={p.pod} justify="space-between" mb={6}>
                <Text size="sm" fw={600}>{p.pod}</Text>
                <Badge color="red" variant="light" size="sm">{formatGapFte(p.avgFte)} avg/mo</Badge>
              </Group>
            ))
          }
        </Card>

        {/* Underloaded */}
        <Card withBorder padding="lg" style={{ borderColor: dark ? '#2f9e44' : '#b2f2bb' }}>
          <Group mb="md">
            <ThemeIcon size={32} radius="xl" variant="light" color="green">
              <IconTrendingUp size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: dark ? '#69db7c' : '#2f9e44' }}>
                Underloaded PODs
              </Text>
              <Text size="xs" c="dimmed">Have available capacity to lend</Text>
            </div>
          </Group>
          {underloaded.length === 0
            ? <Text c="dimmed" size="sm">None</Text>
            : underloaded.map(p => (
              <Group key={p.pod} justify="space-between" mb={6}>
                <Text size="sm" fw={600}>{p.pod}</Text>
                <Badge color="green" variant="light" size="sm">+{formatGapFte(p.avgFte)} avg/mo</Badge>
              </Group>
            ))
          }
        </Card>
      </SimpleGrid>

      {/* Suggestions */}
      <Divider label={
        <Group gap={6}>
          <IconArrowsLeftRight size={14} />
          <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Rebalancing Opportunities
          </Text>
        </Group>
      } labelPosition="left" />

      {visible.length > 0 ? (
        <>
          <Text size="sm" c="dimmed">
            Based on capacity gaps, these transfers could help balance workload without new hires.
            All suggestions are algorithmic — validate with your team before acting.
          </Text>

          <Stack gap="md">
            {visible.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                dark={dark}
                onDismiss={() => setDismissed(prev => new Set([...prev, s.id]))}
                onAct={onNavigate}
              />
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c="dimmed">No rebalancing suggestions available.</Text>
      )}

      {/* PODs in deficit with no matching surplus partner */}
      {(() => {
        const coveredDefPods = new Set(suggestions.map(s => s.toPod));
        const uncoveredDefPods = overloaded.filter(p => !coveredDefPods.has(p.pod));
        if (uncoveredDefPods.length === 0) return null;
        return (
          <Alert icon={<IconAlertTriangle size={14} />} color="orange" variant="light" style={{ borderRadius: 8 }}>
            <Text size="xs" fw={600} mb={4}>
              {uncoveredDefPods.length} overloaded POD{uncoveredDefPods.length > 1 ? 's' : ''} with no available rebalancing partner:
            </Text>
            <Text size="xs" c="dimmed">
              {uncoveredDefPods.map(p => `${p.pod} (${formatGapFte(p.avgFte)} avg/mo)`).join(' · ')}
              {' '}— no other POD has sufficient surplus during the same months. Consider hiring or scope reduction.
            </Text>
          </Alert>
        );
      })()}
    </Stack>
  );
}

function SuggestionCard({
  suggestion: s,
  dark,
  onDismiss,
  onAct,
}: {
  suggestion: RebalanceSuggestion;
  dark: boolean;
  onDismiss: () => void;
  onAct: () => void;
}) {
  const monthStr = s.months.length <= 3
    ? s.months.join(' → ')
    : `${s.months[0]} → ${s.months[s.months.length - 1]} (${s.months.length} months)`;

  return (
    <Card withBorder padding="lg" style={{
      borderLeft: `3px solid ${AQUA}`,
      background: dark ? 'rgba(45,204,211,0.04)' : '#f0fffe',
    }}>
      <Group justify="space-between" align="flex-start">
        <Stack gap="sm" style={{ flex: 1 }}>
          {/* Flow */}
          <Group gap="xs" wrap="wrap">
            <Badge color="green" variant="filled" size="sm">{s.fromPod}</Badge>
            <Text size="xs" c="dimmed" fw={600}>{formatGapFte(s.fromAvgFte)} surplus</Text>
            <Text size="sm" fw={700} c={AQUA}>→</Text>
            <Badge color="red" variant="filled" size="sm">{s.toPod}</Badge>
            <Text size="xs" c="dimmed" fw={600}>{formatGapFte(-s.toAvgFte)} deficit</Text>
          </Group>

          {/* Detail */}
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.03em' }}>Suggestion</Text>
              <Text fw={700} size="sm">Move ~{s.suggestedFte} FTE for {s.months.length} month{s.months.length > 1 ? 's' : ''}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.03em' }}>Window</Text>
              <Text size="sm">{monthStr}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.03em' }}>Relief</Text>
              <Text size="sm" fw={600} c="green">
                ~{formatGapFte(Math.min(s.suggestedFte, s.toAvgFte))} of deficit covered
              </Text>
            </div>
          </Group>

          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
            Use Temporary Overrides to action this. This suggestion is based on aggregate FTE capacity —
            role compatibility should be verified before moving people.
          </Text>

          <Group gap="xs" mt={4}>
            <Button size="xs" variant="light" color="teal" onClick={onAct}>
              Create Override
            </Button>
          </Group>
        </Stack>

        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onDismiss} title="Dismiss">
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Card>
  );
}

// ── Tab 4: Concurrency Risk ───────────────────────────────────────────────────
const POD_COLORS_CONC = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'];

function ConcurrencyRiskTab({ data, gapData, monthLabels, currentMonthIndex, dark }: {
  data: { podId: number; podName: string; monthIndex: number; activeProjectCount: number; riskLevel: string }[];
  gapData: { gaps: { podName: string; monthIndex: number; demandHours: number }[] } | null | undefined;
  monthLabels: Record<number, string>;
  currentMonthIndex: number;
  dark: boolean;
}) {
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';

  const allPodRows = useMemo(() => {
    const podMap = new Map<string, Map<number, { count: number; riskLevel: string }>>();
    data.forEach(d => {
      if (!podMap.has(d.podName)) podMap.set(d.podName, new Map());
      podMap.get(d.podName)!.set(d.monthIndex, { count: d.activeProjectCount, riskLevel: d.riskLevel });
    });
    return Array.from(podMap.entries()).map(([name, monthData]) => ({ name, monthData }));
  }, [data]);

  const podRows = useMemo(() =>
    selectedPods.length > 0 ? allPodRows.filter(r => selectedPods.includes(r.name)) : allPodRows,
    [allPodRows, selectedPods]);

  const allPodNames = useMemo(() =>
    Array.from(new Set(data.map(d => d.podName))).sort(), [data]);

  const activePods = selectedPods.length > 0 ? allPodNames.filter(p => selectedPods.includes(p)) : allPodNames;

  const stats = useMemo(() => ({
    overloaded: data.filter(d => d.riskLevel === 'HIGH').length,
    tight: data.filter(d => d.riskLevel === 'MEDIUM').length,
    peakConcurrent: Math.max(0, ...data.map(d => d.activeProjectCount)),
  }), [data]);

  const demandChartData = useMemo(() => {
    if (!gapData?.gaps) return [];
    return months.map(m => {
      const row: Record<string, number | string> = { month: monthLabels[m] ?? `M${m}` };
      activePods.forEach(pod => {
        const g = gapData.gaps.find(g => g.podName === pod && g.monthIndex === m);
        row[pod] = Math.round(g?.demandHours ?? 0);
      });
      return row;
    });
  }, [gapData, activePods, monthLabels]);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Group gap="xs"><IconAlertTriangle size={18} color="#fa5252" /><Text size="sm" c="dimmed">High Risk POD-Months</Text></Group>
          <Text fw={700} size="xl" c="red">{stats.overloaded}</Text>
        </Card>
        <Card withBorder padding="md">
          <Group gap="xs"><IconAlertTriangle size={18} color="#fd7e14" /><Text size="sm" c="dimmed">Medium Risk POD-Months</Text></Group>
          <Text fw={700} size="xl" c="orange">{stats.tight}</Text>
        </Card>
        <Card withBorder padding="md">
          <Group gap="xs"><IconTrendingUp size={18} color="#339af0" /><Text size="sm" c="dimmed">Peak Concurrent Projects</Text></Group>
          <Text fw={700} size="xl">{stats.peakConcurrent}</Text>
        </Card>
      </SimpleGrid>

      <Group gap="md">
        <MultiSelect
          label="Filter PODs" placeholder={selectedPods.length === 0 ? 'All PODs' : undefined}
          data={allPodNames} value={selectedPods} onChange={setSelectedPods}
          clearable searchable style={{ minWidth: 260, maxWidth: 500 }} size="sm"
        />
        <Text size="sm" c="dimmed" mt="lg">{podRows.length} of {allPodRows.length} PODs shown</Text>
      </Group>

      <Card withBorder padding="md">
        <Text fw={600} mb={4}>Concurrency Grid — Active Projects per POD / Month</Text>
        <Text size="xs" c="dimmed" mb="sm">Each cell = # active projects — colour = risk level</Text>
        <ScrollArea>
          <Table fz="xs" withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 140 }}>POD</Table.Th>
                <MonthHeader monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {podRows.map(row => (
                <Table.Tr key={row.name}>
                  <Table.Td fw={500}>{row.name}</Table.Td>
                  {months.map(m => {
                    const cell = row.monthData.get(m);
                    const count = cell?.count ?? 0;
                    const riskLevel = cell?.riskLevel ?? '';
                    return (
                      <Table.Td key={m} style={{
                        textAlign: 'center',
                        ...(m < currentMonthIndex
                          ? { opacity: 0.5, backgroundColor: pastBg }
                          : { backgroundColor: count > 0 ? getConcurrencyColorByLevel(riskLevel, dark) : undefined }),
                      }}>
                        {count > 0 ? (
                          <Tooltip label={`${count} projects — Risk: ${riskLevel}`}>
                            <Text size="xs" fw={600}>{count} proj<br /><Text span size="xs" c="dimmed">{riskLevel}</Text></Text>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Card withBorder padding="md">
        <Text fw={600} mb={4}>Peak Demand by POD — Stacked Monthly</Text>
        <Text size="xs" c="dimmed" mb="sm">Total demand hours per month, stacked by POD</Text>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={demandChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={10} />
            <YAxis fontSize={10} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <RTooltip formatter={(value: number) => formatHours(value)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activePods.map((pod, i) => (
              <Bar key={pod} dataKey={pod} stackId="s" fill={POD_COLORS_CONC[i % POD_COLORS_CONC.length] + 'cc'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Stack>
  );
}
