/**
 * AiImpactPage — Engineering Intelligence › AI Impact tab
 *
 * Shows how AI tooling (Copilot, etc.) is affecting team velocity,
 * PR review cycle time, cost-per-story-point, and adoption rate.
 *
 * Data source: GET /api/reports/ai-impact/summary  (KPI cards)
 *              GET /api/reports/ai-impact/trend?type=<metric>  (charts)
 *              GET /api/reports/ai-impact/pods  (pod list for selectors)
 */
import { useState, useEffect } from 'react';
import {
  Stack, SimpleGrid, Paper, Title, Text, Group, ThemeIcon,
  SegmentedControl, Select, Center, Loader, Badge,
} from '@mantine/core';
import {
  IconBrain, IconTrendingUp, IconCurrencyDollar,
  IconClock, IconChartBar, IconRobot,
} from '@tabler/icons-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import apiClient from '../../api/client';
import ChartCard from '../../components/common/ChartCard';
import { EmptyState } from '../../components/ui';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Colour palette for up to 6 PODs ──────────────────────────────────────────
const POD_COLORS = ['#12b886', '#339af0', '#f59f00', '#fa5252', '#7950f2', '#fd7e14'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface AiSummary {
  avgAiPrRatioPct:      number;
  velocityLiftPct:      number;
  costSavingsPct:       number;
  reviewCycleDaysSaved: number;
}

type TrendRow = Record<string, string | number>;

// ── Small KPI card ────────────────────────────────────────────────────────────
interface KpiProps {
  icon:    React.ReactNode;
  label:   string;
  value:   string;
  sub?:    string;
  color:   string;
}

function KpiCard({ icon, label, value, sub, color }: KpiProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="md" align="flex-start">
        <ThemeIcon variant="light" color={color} size={40} radius="md">
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xs" c="dimmed" fw={500} style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
          <Text size="xl" fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, lineHeight: 1.2 }}>
            {value}
          </Text>
          {sub && <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{sub}</Text>}
        </div>
      </Group>
    </Paper>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AiImpactPage() {
  const dark = useDarkMode();

  const [summary,      setSummary]      = useState<AiSummary | null>(null);
  const [pods,         setPods]         = useState<string[]>([]);
  const [velTrend,     setVelTrend]     = useState<TrendRow[]>([]);
  const [ratioTrend,   setRatioTrend]   = useState<TrendRow[]>([]);
  const [costTrend,    setCostTrend]    = useState<TrendRow[]>([]);
  const [reviewTrend,  setReviewTrend]  = useState<TrendRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [chartType,    setChartType]    = useState<'velocity' | 'ratio' | 'cost' | 'review'>('velocity');

  useEffect(() => {
    const base = '/reports/ai-impact';
    Promise.all([
      apiClient.get<AiSummary>(`${base}/summary`),
      apiClient.get<string[]>(`${base}/pods`),
      apiClient.get<TrendRow[]>(`${base}/trend?type=velocity_delta`),
      apiClient.get<TrendRow[]>(`${base}/trend?type=ai_pr_ratio`),
      apiClient.get<TrendRow[]>(`${base}/trend?type=cost_per_point`),
      apiClient.get<TrendRow[]>(`${base}/trend?type=review_cycle_days`),
    ])
      .then(([s, p, vel, ratio, cost, review]) => {
        setSummary(s.data);
        setPods(p.data);
        setVelTrend(vel.data);
        setRatioTrend(ratio.data);
        setCostTrend(cost.data);
        setReviewTrend(review.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Center h={300}><Loader color="teal" /></Center>;
  }

  if (!summary && pods.length === 0) {
    return (
      <EmptyState
        icon={<IconRobot size={48} />}
        title="No AI impact data yet"
        description="Once Copilot or AI tooling is adopted by PODs, metrics will appear here automatically."
      />
    );
  }

  // Active trend data based on selected chart
  const trendMap: Record<string, { data: TrendRow[]; label: string; unit: string }> = {
    velocity: { data: velTrend,    label: 'Story Points / Sprint',  unit: 'pts'  },
    ratio:    { data: ratioTrend,  label: 'AI-Assisted PR Ratio',   unit: '%'    },
    cost:     { data: costTrend,   label: 'Cost per Story Point',   unit: '$'    },
    review:   { data: reviewTrend, label: 'PR Review Cycle',        unit: 'days' },
  };
  const { data: activeTrend, label: axisLabel, unit } = trendMap[chartType];

  // Format ratio as % in tooltip
  const formatValue = (v: number) =>
    chartType === 'ratio' ? `${Math.round(v * 100)}%`
    : chartType === 'cost' ? `$${Math.round(v)}`
    : chartType === 'review' ? `${v}d`
    : `${v} pts`;

  const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const axisColor = dark ? '#868e96' : '#adb5bd';

  return (
    <Stack gap="lg">

      {/* Header */}
      <Group align="center" gap="sm">
        <ThemeIcon variant="light" color="teal" size={36} radius="md">
          <IconBrain size={20} />
        </ThemeIcon>
        <div>
          <Title order={4} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>AI Impact Measurement</Title>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Tracks how AI tooling adoption is improving velocity, quality, and cost across PODs
          </Text>
        </div>
        <Badge variant="light" color="teal" ml="auto">Live</Badge>
      </Group>

      {/* KPI Cards */}
      {summary && (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <KpiCard
            icon={<IconRobot size={20} />}
            label="AI-Assisted PRs"
            value={`${summary.avgAiPrRatioPct}%`}
            sub="of all pull requests (latest period)"
            color="teal"
          />
          <KpiCard
            icon={<IconTrendingUp size={20} />}
            label="Velocity Lift"
            value={`+${summary.velocityLiftPct}%`}
            sub="story points vs pre-AI baseline"
            color="blue"
          />
          <KpiCard
            icon={<IconCurrencyDollar size={20} />}
            label="Cost Savings"
            value={`${summary.costSavingsPct}%`}
            sub="reduction in cost per story point"
            color="green"
          />
          <KpiCard
            icon={<IconClock size={20} />}
            label="Review Speed"
            value={`-${summary.reviewCycleDaysSaved}d`}
            sub="average review cycle reduction"
            color="violet"
          />
        </SimpleGrid>
      )}

      {/* Chart selector */}
      <Group>
        <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Metric:</Text>
        <SegmentedControl
          size="xs"
          value={chartType}
          onChange={v => setChartType(v as typeof chartType)}
          data={[
            { value: 'velocity', label: 'Velocity'     },
            { value: 'ratio',    label: 'AI PR Ratio'  },
            { value: 'cost',     label: 'Cost/Point'   },
            { value: 'review',   label: 'Review Cycle' },
          ]}
        />
      </Group>

      {/* Trend chart */}
      <ChartCard
        title={`${axisLabel} — Trend by POD`}
        minHeight={320}
      >
        {activeTrend.length === 0 ? (
          <Center h={280}>
            <Text c="dimmed" size="sm">No data for this metric yet</Text>
          </Center>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activeTrend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }}
                     tickFormatter={v => chartType === 'ratio' ? `${Math.round(v * 100)}%`
                       : chartType === 'cost' ? `$${v}`
                       : String(v)} />
              <RechartsTooltip
                formatter={(v: number) => [formatValue(v), '']}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {pods.map((pod, i) => (
                <Line
                  key={pod}
                  type="monotone"
                  dataKey={pod}
                  stroke={POD_COLORS[i % POD_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Velocity bar chart: AI vs baseline side-by-side */}
      {chartType === 'velocity' && velTrend.length > 0 && pods.length > 0 && (
        <ChartCard title="Velocity: AI-Assisted vs Baseline (latest POD)" minHeight={260}>
          {(() => {
            // Build comparison data for the first pod with baseline data
            const compPod = pods[0];
            const compData = velTrend
              .filter(r => r[compPod] !== undefined)
              .map(r => ({
                period:   r.period as string,
                AI:       Number(r[compPod]),
                Baseline: Number(r[`${compPod}_baseline`] ?? r[compPod]),
              }));
            return (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={compData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: axisColor }} />
                  <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                  <RechartsTooltip
                    formatter={(v: number) => [`${v} pts`, '']}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="AI"       fill={AQUA}     radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Baseline" fill="#adb5bd"  radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </ChartCard>
      )}

    </Stack>
  );
}
