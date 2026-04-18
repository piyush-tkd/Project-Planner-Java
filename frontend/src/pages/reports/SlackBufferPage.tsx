// @ts-expect-error -- unused
import React, { useMemo, useState } from 'react';
import {
 Box,
 Group,
 Modal,
 MultiSelect,
 ScrollArea,
 SegmentedControl,
 Stack,
 Text,
 Title,
 Badge,
 SimpleGrid,
 Paper,
 useComputedColorScheme
} from '@mantine/core';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatGapHours, formatGapFte } from '../../utils/formatting';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { AQUA, COLOR_ERROR_DEEP, COLOR_GREEN_DARK, COLOR_GREEN_LIGHT, COLOR_ORANGE_DARK, COLOR_SUCCESS, DEEP_BLUE, GRAY_100, SURFACE_ERROR, SURFACE_SUBTLE, SURFACE_SUCCESS, SURFACE_WARNING, TEXT_DIM} from '../../brandTokens';

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

// @ts-expect-error -- unused
interface CapacityGapData {
 gaps: PodMonthGap[];
}

// Color thresholds (in hours, assuming 160h per month full capacity)
const getGapColors = (
 gapHours: number,
 isDark = false,
): { bg: string; text: string } => {
 if (isDark) {
 if (gapHours > 160) {
 return { bg: 'rgba(47, 158, 68, 0.35)', text: '#69db7c' }; // Strong green — clearly darker
 }
 if (gapHours > 0) {
 return { bg: 'rgba(64, 192, 87, 0.12)', text: COLOR_GREEN_LIGHT }; // Light green — clearly lighter
 }
 if (Math.abs(gapHours) <= 8) {
 return { bg: 'rgba(255, 255, 255, 0.04)', text: 'rgba(255,255,255,0.5)' };
 }
 if (gapHours < 0 && gapHours > -160) {
 return { bg: 'rgba(230, 119, 0, 0.20)', text: '#ffc078' };
 }
 return { bg: 'rgba(201, 42, 42, 0.30)', text: '#ff8787' };
 }
 if (gapHours > 160) {
 return { bg: SURFACE_SUCCESS, text: COLOR_GREEN_DARK }; // Comfortable surplus
 }
 if (gapHours > 0) {
 return { bg: '#ebfbee', text: COLOR_SUCCESS }; // Slight surplus
 }
 if (Math.abs(gapHours) <= 8) {
 return { bg: SURFACE_SUBTLE, text: TEXT_DIM }; // Balanced
 }
 if (gapHours < 0 && gapHours > -160) {
 return { bg: SURFACE_WARNING, text: COLOR_ORANGE_DARK }; // Slight deficit
 }
 return { bg: SURFACE_ERROR, text: COLOR_ERROR_DEEP }; // Significant deficit
};

export default function SlackBufferPage() {
 const computedColorScheme = useComputedColorScheme('light');
 const isDark = computedColorScheme === 'dark';
 const { data: capacityData, isLoading, isError } = useCapacityGap();
 const { monthLabels, currentMonthIndex } = useMonthLabels();

 const [selectedPods, setSelectedPods] = useState<string[]>([]);
 const [viewMode, setViewMode] = useState<'hours' | 'fte'>('hours');
 const [modalOpened, setModalOpened] = useState(false);
 const [selectedCell, setSelectedCell] = useState<PodMonthGap | null>(null);

 const gaps = capacityData?.gaps ?? [];

 // Extract unique PODs and months from data
 const { pods, months } = useMemo(() => {
 const podMap = new Map<number, string>();
 const monthSet = new Set<number>();

 gaps.forEach((gap) => {
 podMap.set(gap.podId, gap.podName);
 monthSet.add(gap.monthIndex);
 });

 const podList = Array.from(podMap.values()).sort();
 const monthList = Array.from(monthSet).sort((a, b) => a - b);

 return { pods: podList, months: monthList };
 }, [gaps]);

 // Filter data
 const filteredGaps = useMemo(() => {
 return gaps.filter((gap) => {
 const podMatch =
 selectedPods.length === 0 || selectedPods.includes(gap.podName);
 return podMatch;
 });
 }, [gaps, selectedPods]);

 // Build lookup map
 // @ts-expect-error -- unused
 const gapMap = useMemo(() => {
 const map = new Map<string, PodMonthGap>();
 filteredGaps.forEach((gap) => {
 const key = `${gap.podId}:${gap.monthIndex}`;
 map.set(key, gap);
 });
 return map;
 }, [filteredGaps]);

 // Calculate totals per month
 const monthTotals = useMemo(() => {
 const totals = new Map<number, { hours: number; fte: number }>();
 filteredGaps.forEach((gap) => {
 const current = totals.get(gap.monthIndex) || { hours: 0, fte: 0 };
 current.hours += gap.gapHours;
 current.fte += gap.gapFte;
 totals.set(gap.monthIndex, current);
 });
 return totals;
 }, [filteredGaps]);

 const podOptions = pods.map((p) => ({ value: p, label: p }));

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading slack & buffer..." />;
 if (isError) return <Text color="red">Failed to load capacity data</Text>;

 const handleCellClick = (gap: PodMonthGap) => {
 setSelectedCell(gap);
 setModalOpened(true);
 };

 const getDisplayValue = (gap: PodMonthGap): string => {
 if (viewMode === 'hours') {
 return formatGapHours(gap.gapHours);
 }
 return formatGapFte(gap.gapFte);
 };

 const getDisplaySecondary = (gap: PodMonthGap): string => {
 if (viewMode === 'hours') {
 return formatGapFte(gap.gapFte);
 }
 return formatGapHours(gap.gapHours);
 };

 const getGapValueForColor = (gap: PodMonthGap): number => {
 return viewMode === 'hours' ? gap.gapHours : gap.gapFte * 160;
 };

 return (
 <Stack gap="md" p="md" className="page-enter stagger-children">
 <div className="slide-in-left">
 <Title order={2} style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 700 }}>
 Slack &amp; Buffer
 </Title>
 <Text size="sm" c="dimmed" style={{ }}>
 Available capacity per POD per month — green = surplus, red = deficit
 </Text>
 </div>

 <Group gap="md" align="flex-end" wrap="wrap">
 <MultiSelect
 label="Filter PODs"
 placeholder="Select PODs..."
 data={podOptions}
 value={selectedPods}
 onChange={setSelectedPods}
 style={{ flex: '0 1 280px' }}
 styles={{ label: {color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE, fontWeight: 600 } }}
 />
 <SegmentedControl
 data={[
 { value: 'hours', label: 'Hours' },
 { value: 'fte', label: 'FTE' },
 ]}
 value={viewMode}
 onChange={(value) => setViewMode(value as 'hours' | 'fte')}
 styles={{
 root: {backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
 border: isDark ? '1px solid rgba(255,255,255,0.1)' : undefined
 },
 indicator: { background: AQUA },
 label: {
 fontWeight: 600,
 color: isDark ? 'rgba(255,255,255,0.8)' : undefined,
 '&[dataActive]': { color: 'white' }
 }}}
 />

 {/* Legend — inline to use whitespace on the right */}
 <Group gap="sm" ml="auto" style={{ flexShrink: 0 }}>
 {(isDark
 ? [
 { range: '>160h', color: 'rgba(47, 158, 68, 0.35)', text: '#69db7c' },
 { range: '0–160h', color: 'rgba(64, 192, 87, 0.12)', text: COLOR_GREEN_LIGHT },
 { range: '±0–8h', color: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.5)' },
 { range: '-160–0h', color: 'rgba(230, 119, 0, 0.20)', text: '#ffc078' },
 { range: '<-160h', color: 'rgba(201, 42, 42, 0.30)', text: '#ff8787' },
 ]
 : [
 { range: '>160h', color: SURFACE_SUCCESS, text: COLOR_GREEN_DARK },
 { range: '0–160h', color: '#ebfbee', text: COLOR_SUCCESS },
 { range: '±0–8h', color: SURFACE_SUBTLE, text: TEXT_DIM },
 { range: '-160–0h', color: SURFACE_WARNING, text: COLOR_ORANGE_DARK },
 { range: '<-160h', color: SURFACE_ERROR, text: COLOR_ERROR_DEEP },
 ]
 ).map((item) => (
 <Group key={item.range} gap={4} wrap="nowrap">
 <Box
 style={{
 width: 16,
 height: 16,
 backgroundColor: item.color,
 border: `1px solid ${item.text}`,
 borderRadius: 3,
 flexShrink: 0}}
 />
 <Text size="xs" style={{ whiteSpace: 'nowrap', color: isDark ? 'rgba(255,255,255,0.7)' : undefined }} c={isDark ? undefined : 'dimmed'}>{item.range}</Text>
 </Group>
 ))}
 </Group>
 </Group>

 <ScrollArea>
 <table
 style={{
 borderCollapse: 'collapse',
 fontSize: '13px',
 minWidth: '100%'}}
 >
 <thead>
 <tr>
 <th
 style={{
 backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE,
 color: isDark ? 'rgba(255,255,255,0.9)' : 'white',
 padding: '12px',
 textAlign: 'left',
 fontWeight: 600,
 minWidth: 120,
 position: 'sticky',
 left: 0,
 zIndex: 2,
 borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined}}
 >
 POD
 </th>
 {months.map((monthIdx) => {
 const isCurrentMonth = monthIdx === currentMonthIndex;
 return (
 <th
 key={monthIdx}
 style={{
 backgroundColor: isCurrentMonth
 ? (isDark ? 'rgba(45, 204, 211, 0.2)' : AQUA)
 : (isDark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE),
 color: isDark ? 'rgba(255,255,255,0.9)' : 'white',
 padding: '12px',
 textAlign: 'center',
 fontWeight: 600,
 minWidth: 90,
 borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined}}
 >
 <Stack gap={0}>
 <Text size="xs" fw={600} style={{ color: isCurrentMonth && isDark ? AQUA : undefined }}>
 {monthLabels[monthIdx] || `M${monthIdx}`}
 </Text>
 {isCurrentMonth && (
 <Badge size="xs" color={isDark ? AQUA : 'white'} c={isDark ? 'white' : AQUA} variant={isDark ? 'filled' : 'filled'}>
 Current
 </Badge>
 )}
 </Stack>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody>
 {pods.map((podName) => (
 <tr key={podName}>
 <td
 style={{
 backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DEEP_BLUE,
 color: isDark ? 'rgba(255,255,255,0.9)' : 'white',
 padding: '12px',
 fontWeight: 600,
 position: 'sticky',
 left: 0,
 zIndex: 1,
 borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined}}
 >
 {podName}
 </td>
 {months.map((monthIdx) => {
 const gap = filteredGaps.find(
 (g) => g.podName === podName && g.monthIndex === monthIdx
 );

 if (!gap) {
 return (
 <td
 key={monthIdx}
 style={{
 backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : SURFACE_SUBTLE,
 padding: '12px',
 textAlign: 'center',
 borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : GRAY_100}`,
 color: isDark ? 'rgba(255,255,255,0.3)' : undefined}}
 >
 —
 </td>
 );
 }

 const gapValue = getGapValueForColor(gap);
 const colors = getGapColors(gapValue, isDark);

 return (
 <td
 key={monthIdx}
 onClick={() => handleCellClick(gap)}
 style={{
 backgroundColor: colors.bg,
 padding: '12px',
 textAlign: 'center',
 borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : GRAY_100}`,
 cursor: 'pointer',
 transition: 'opacity 0.2s'}}
 onMouseEnter={(e) => {
 e.currentTarget.style.opacity = '0.8';
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.opacity = '1';
 }}
 >
 <Stack gap={2}>
 <Text
 fw={700}
 size="sm"
 c={colors.text}
 style={{ lineHeight: 1 }}
 >
 {getDisplayValue(gap)}
 </Text>
 <Text
 size="xs"
 c={colors.text}
 style={{ opacity: 0.7, lineHeight: 1 }}
 >
 {getDisplaySecondary(gap)}
 </Text>
 </Stack>
 </td>
 );
 })}
 </tr>
 ))}

 {/* Summary row */}
 <tr>
 <td
 style={{
 backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE,
 color: isDark ? 'rgba(255,255,255,0.9)' : 'white',
 padding: '12px',
 fontWeight: 600,
 position: 'sticky',
 left: 0,
 zIndex: 1,
 borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : undefined}}
 >
 Total
 </td>
 {months.map((monthIdx) => {
 const total = monthTotals.get(monthIdx) || {
 hours: 0,
 fte: 0
 };
 const gapValue = viewMode === 'hours' ? total.hours : total.fte * 160;
 const colors = getGapColors(gapValue, isDark);

 return (
 <td
 key={monthIdx}
 style={{
 backgroundColor: colors.bg,
 padding: '12px',
 textAlign: 'center',
 borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : GRAY_100}`,
 fontWeight: 600}}
 >
 <Stack gap={2}>
 <Text
 fw={700}
 size="sm"
 c={colors.text}
 style={{ lineHeight: 1 }}
 >
 {viewMode === 'hours'
 ? formatGapHours(total.hours)
 : formatGapFte(total.fte)}
 </Text>
 <Text
 size="xs"
 c={colors.text}
 style={{ opacity: 0.7, lineHeight: 1 }}
 >
 {viewMode === 'hours'
 ? formatGapFte(total.fte)
 : formatGapHours(total.hours)}
 </Text>
 </Stack>
 </td>
 );
 })}
 </tr>
 </tbody>
 </table>
 </ScrollArea>

 <Modal
 opened={modalOpened}
 onClose={() => setModalOpened(false)}
 title="Capacity Detail"
 size="sm"
 styles={{ title: {color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 700 } }}
 >
 {selectedCell && (
 <Stack gap="lg">
 <div>
 <Text fw={600} size="lg">
 {selectedCell.podName}
 </Text>
 <Text size="sm" c="dimmed">
 {selectedCell.monthLabel}
 </Text>
 </div>

 <SimpleGrid cols={2} spacing="md">
 <Paper p="md" radius="md" withBorder>
 <Stack gap="xs">
 <Text size="xs" fw={500} c="dimmed">
 Capacity
 </Text>
 <Text fw={700} size="lg">
 {formatGapHours(selectedCell.capacityHours)}
 </Text>
 <Text size="xs" c="dimmed">
 {formatGapFte(selectedCell.capacityHours / 160)}
 </Text>
 </Stack>
 </Paper>

 <Paper p="md" radius="md" withBorder>
 <Stack gap="xs">
 <Text size="xs" fw={500} c="dimmed">
 Demand
 </Text>
 <Text fw={700} size="lg">
 {formatGapHours(selectedCell.demandHours)}
 </Text>
 <Text size="xs" c="dimmed">
 {formatGapFte(selectedCell.demandHours / 160)}
 </Text>
 </Stack>
 </Paper>
 </SimpleGrid>

 <Paper
 p="md"
 radius="md"
 withBorder
 style={{
 backgroundColor: getGapColors(selectedCell.gapHours, isDark).bg}}
 >
 <Stack gap="xs">
 <Text size="xs" fw={500} c="dimmed">
 Gap (Available Capacity)
 </Text>
 <Group gap="lg">
 <div>
 <Text
 fw={700}
 size="xl"
 c={getGapColors(selectedCell.gapHours, isDark).text}
 >
 {formatGapHours(selectedCell.gapHours)}
 </Text>
 <Text size="xs" c="dimmed">
 Hours
 </Text>
 </div>
 <div>
 <Text
 fw={700}
 size="xl"
 c={getGapColors(selectedCell.gapHours, isDark).text}
 >
 {formatGapFte(selectedCell.gapFte)}
 </Text>
 <Text size="xs" c="dimmed">
 FTE
 </Text>
 </div>
 </Group>
 </Stack>
 </Paper>
 </Stack>
 )}
 </Modal>
 </Stack>
 );
}
