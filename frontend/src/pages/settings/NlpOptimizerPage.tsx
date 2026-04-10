import { useState } from 'react';
import {
 Container, Title, Text, Paper, Group, Stack, Badge, Button,
 Table, ActionIcon, Tooltip, SimpleGrid, Box, Skeleton, Loader, Switch,
 Tabs, ThemeIcon, Progress, ScrollArea, Modal, Image, Alert,
 useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
 IconBrain, IconPlayerPlay, IconTrash, IconToggleLeft,
 IconChartBar, IconAlertTriangle, IconThumbDown, IconCheck,
 IconTrendingUp, IconDatabase, IconSparkles, IconRefresh,
 IconHistory, IconArrowUpRight, IconArrowDownRight, IconMinus,
 IconRobot, IconPhoto, IconKey, IconClock,
} from '@tabler/icons-react';
import {
 useRunNlpLearner, useNlpLowConfidenceLogs, useNlpNegativeRatedLogs,
 useNlpLearnedPatterns, useToggleNlpPattern, useDeleteNlpPattern,
 useNlpFeedback, useNlpLearnerRunHistory, NlpLearnerStats, NlpLearnerRunHistory,
} from '../../api/nlp';
import { useQueryClient } from '@tanstack/react-query';
import { AQUA, AQUA_TINTS, COLOR_ERROR_DEEP, COLOR_ORANGE_DARK, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY, GRAY_200} from '../../brandTokens';

export default function NlpOptimizerPage() {
 const queryClient = useQueryClient();
 const { colorScheme } = useMantineColorScheme();
 const isDark = colorScheme === 'dark';
 const headingColor = isDark ? GRAY_200 : DEEP_BLUE;
 const [stats, setStats] = useState<NlpLearnerStats | null>(null);
 const [activeTab, setActiveTab] = useState<string | null>('low-confidence');

 const runLearner = useRunNlpLearner();
 const { data: lowConfLogs, isLoading: loadingLowConf, isError: errorLowConf } = useNlpLowConfidenceLogs();
 const { data: negRatedLogs, isLoading: loadingNeg, isError: errorNeg } = useNlpNegativeRatedLogs();
 const { data: patterns, isLoading: loadingPatterns, isError: errorPatterns } = useNlpLearnedPatterns();
 const { data: runHistory, isLoading: loadingHistory, isError: errorHistory } = useNlpLearnerRunHistory();
 const togglePattern = useToggleNlpPattern();
 const deletePattern = useDeleteNlpPattern();
 const submitFeedback = useNlpFeedback();
 const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

 // Derive display stats — prefer fresh learner result, fall back to most recent run history
 const latestRun = runHistory && runHistory.length > 0 ? runHistory[0] : null;
 const displayStats = stats
 ? {
 totalQueries: stats.totalQueries,
 unknownQueries: stats.unknownQueries,
 lowConfidenceQueries: stats.lowConfidenceQueries,
 positiveRatings: stats.positiveRatings,
 negativeRatings: stats.negativeRatings,
 activePatterns: stats.activePatterns,
 newPatternsGenerated: stats.newPatternsGenerated,
 strategyCount: Object.keys(stats.strategyAvgConfidence).length,
 intentDistribution: stats.intentDistribution,
 strategyAvgConfidence: stats.strategyAvgConfidence,
 lastRunAt: null as string | null,
 }
 : latestRun
 ? {
 totalQueries: latestRun.totalQueries,
 unknownQueries: latestRun.unknownQueries,
 lowConfidenceQueries: latestRun.lowConfidence,
 positiveRatings: latestRun.positiveRatings,
 negativeRatings: latestRun.negativeRatings,
 activePatterns: latestRun.activePatterns,
 newPatternsGenerated: latestRun.newPatterns,
 strategyCount: latestRun.strategyCount,
 intentDistribution: latestRun.intentDistribution ? JSON.parse(latestRun.intentDistribution) as Record<string, number> : null,
 strategyAvgConfidence: latestRun.strategyConfidence ? JSON.parse(latestRun.strategyConfidence) as Record<string, number> : null,
 lastRunAt: latestRun.runAt,
 }
 : null;

 const handleRunLearner = () => {
 runLearner.mutate(undefined, {
 onSuccess: (data) => {
 setStats(data);
 queryClient.invalidateQueries({ queryKey: ['nlp-patterns'] });
 queryClient.invalidateQueries({ queryKey: ['nlp-low-confidence'] });
 queryClient.invalidateQueries({ queryKey: ['nlp-negative-rated'] });
 queryClient.invalidateQueries({ queryKey: ['nlp-learner-history'] });
 notifications.show({
 title: 'Learner Complete',
 message: `Generated ${data.newPatternsGenerated} new patterns. ${data.activePatterns} total active.`,
 color: 'teal',
 icon: <IconCheck size={16} />,
 });
 },
 onError: (err) => {
 notifications.show({
 title: 'Learner Failed',
 message: err.message,
 color: 'red',
 });
 },
 });
 };

 const handleToggle = (id: number) => {
 togglePattern.mutate(id, {
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nlp-patterns'] }),
 });
 };

 const handleDelete = (id: number) => {
 deletePattern.mutate(id, {
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nlp-patterns'] }),
 });
 };

 const handleFeedback = (queryLogId: number, rating: number) => {
 submitFeedback.mutate({ queryLogId, rating }, {
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['nlp-low-confidence'] });
 queryClient.invalidateQueries({ queryKey: ['nlp-negative-rated'] });
 },
 });
 };

 return (
 <Container size="xl" py="md" className="page-enter stagger-children">
 <Group justify="space-between" align="flex-start" mb="lg" className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: headingColor, fontWeight: 700 }}>
 NLP Optimizer
 </Title>
 <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
 Analyze query logs, mine patterns, and improve the NLP engine
 </Text>
 <Badge
 size="sm"
 variant="light"
 color="teal"
 leftSection={<IconRobot size={12} />}
 mt={6}
 style={{ fontFamily: FONT_FAMILY }}
 >
 Auto-learning active &middot; runs every 6h
 </Badge>
 </div>
 <Button
 leftSection={runLearner.isPending ? <Loader size={16} color="white" /> : <IconPlayerPlay size={16} />}
 onClick={handleRunLearner}
 disabled={runLearner.isPending}
 size="md"
 style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}
 >
 {runLearner.isPending ? 'Running Analysis…' : 'Run Learner'}
 </Button>
 </Group>

 {/* ── Stats Cards ── */}
 {displayStats ? (
 <>
 {displayStats.lastRunAt && (
 <Text size="xs" c="dimmed" mb={6} style={{ fontFamily: FONT_FAMILY }}>
 Last run: {new Date(displayStats.lastRunAt).toLocaleString()}
 </Text>
 )}
 <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
 <StatCard label="Total Queries" value={displayStats.totalQueries} icon={<IconDatabase size={18} />} color={DEEP_BLUE}
 onClick={() => setActiveTab('run-history')} tooltip="View run history" />
 <StatCard label="Unknown" value={displayStats.unknownQueries} icon={<IconAlertTriangle size={18} />} color={COLOR_ORANGE_DARK}
 onClick={() => setActiveTab('low-confidence')} tooltip="View low confidence logs" />
 <StatCard label="Low Confidence" value={displayStats.lowConfidenceQueries} icon={<IconTrendingUp size={18} />} color={COLOR_ERROR_DEEP}
 onClick={() => setActiveTab('low-confidence')} tooltip="View low confidence logs" />
 <StatCard label="New Patterns" value={displayStats.newPatternsGenerated} icon={<IconSparkles size={18} />} color={AQUA}
 onClick={() => setActiveTab('patterns')} tooltip="View learned patterns" />
 <StatCard label="Active Patterns" value={displayStats.activePatterns} icon={<IconBrain size={18} />} color={DEEP_BLUE}
 onClick={() => setActiveTab('patterns')} tooltip="View learned patterns" />
 <StatCard label="Positive Ratings" value={displayStats.positiveRatings} icon={<IconCheck size={18} />} color="#2b8a3e"
 onClick={() => setActiveTab('run-history')} tooltip="View run history" />
 <StatCard label="Negative Ratings" value={displayStats.negativeRatings} icon={<IconThumbDown size={18} />} color={COLOR_ERROR_DEEP}
 onClick={() => setActiveTab('negative-rated')} tooltip="View negative feedback" />
 <StatCard
 label="Strategies"
 value={displayStats.strategyCount}
 icon={<IconChartBar size={18} />}
 color={AQUA}
 onClick={() => setActiveTab('run-history')} tooltip="View run history"
 />
 </SimpleGrid>
 </>
 ) : (
 <Paper shadow="xs" radius="md" p="lg" mb="lg" withBorder ta="center">
 <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="sm">
 <IconBrain size={24} />
 </ThemeIcon>
 <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: headingColor }}>No Data Yet</Text>
 <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
 Click "Run Learner" to analyze query logs and generate insights
 </Text>
 </Paper>
 )}

 {/* ── Intent Distribution ── */}
 {displayStats && displayStats.intentDistribution && Object.keys(displayStats.intentDistribution).length > 0 && (
 <Paper shadow="xs" radius="md" p="md" mb="lg" withBorder>
 <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY, color: headingColor }}>
 Intent Distribution
 </Text>
 <Stack gap={6}>
 {Object.entries(displayStats.intentDistribution)
 .sort(([, a], [, b]) => b - a)
 .map(([intent, count]) => {
 const pct = displayStats.totalQueries > 0 ? Math.round((count / displayStats.totalQueries) * 100) : 0;
 return (
 <Group key={intent} gap="sm" wrap="nowrap">
 <Text size="xs" w={120} style={{ fontFamily: FONT_FAMILY }}>{intent}</Text>
 <Progress value={pct} color={intent === 'UNKNOWN' ? 'orange' : AQUA} style={{ flex: 1 }} size="sm" radius="xl" />
 <Text size="xs" c="dimmed" w={60} ta="right">{count} ({pct}%)</Text>
 </Group>
 );
 })}
 </Stack>
 </Paper>
 )}

 {/* ── Strategy Avg Confidence ── */}
 {displayStats && displayStats.strategyAvgConfidence && Object.keys(displayStats.strategyAvgConfidence).length > 0 && (
 <Paper shadow="xs" radius="md" p="md" mb="lg" withBorder>
 <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY, color: headingColor }}>
 Average Confidence by Strategy
 </Text>
 <Group gap="lg">
 {Object.entries(displayStats.strategyAvgConfidence).map(([strategy, avg]) => (
 <Paper key={strategy} p="sm" radius="md" withBorder style={{ flex: 1, minWidth: 140 }}>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{strategy}</Text>
 <Text size="lg" fw={700} style={{ color: avg >= 0.75 ? '#2b8a3e' : COLOR_ORANGE_DARK, fontFamily: FONT_FAMILY }}>
 {Math.round(avg * 100)}%
 </Text>
 </Paper>
 ))}
 </Group>
 </Paper>
 )}

 {/* ── Tabs: Low Confidence | Negative Rated | Learned Patterns | Run History ── */}
 <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
 <Tabs.List mb="md">
 <Tabs.Tab value="low-confidence" leftSection={<IconAlertTriangle size={14} />}
 style={{ fontFamily: FONT_FAMILY }}>
 Low Confidence {lowConfLogs ? `(${lowConfLogs.length})` : ''}
 </Tabs.Tab>
 <Tabs.Tab value="negative-rated" leftSection={<IconThumbDown size={14} />}
 style={{ fontFamily: FONT_FAMILY }}>
 Negative Rated {negRatedLogs ? `(${negRatedLogs.length})` : ''}
 </Tabs.Tab>
 <Tabs.Tab value="patterns" leftSection={<IconBrain size={14} />}
 style={{ fontFamily: FONT_FAMILY }}>
 Learned Patterns {patterns ? `(${patterns.length})` : ''}
 </Tabs.Tab>
 <Tabs.Tab value="run-history" leftSection={<IconHistory size={14} />}
 style={{ fontFamily: FONT_FAMILY }}>
 Run History {runHistory ? `(${runHistory.length})` : ''}
 </Tabs.Tab>
 <Tabs.Tab value="analytics" leftSection={<IconChartBar size={14} />}
 style={{ fontFamily: FONT_FAMILY }}>
 Analytics
 </Tabs.Tab>
 </Tabs.List>

 {/* ── Low Confidence Logs ── */}
 <Tabs.Panel value="low-confidence">
 <Paper shadow="xs" radius="md" withBorder>
 <ScrollArea h={480}>
 {loadingLowConf ? (
 <Skeleton height={200} radius="sm" />
 ) : errorLowConf ? (
 <Box p="lg"><Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>Failed to load low-confidence logs. Refresh to try again.</Alert></Box>
 ) : !lowConfLogs || lowConfLogs.length === 0 ? (
 <Box p="xl" ta="center">
 <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>No low-confidence queries found.</Text>
 </Box>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Query</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Intent</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Confidence</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Strategy</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Rating</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Date</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {lowConfLogs.map((log) => (
 <Table.Tr key={log.id}>
 <Table.Td style={{ fontFamily: FONT_FAMILY, maxWidth: 300 }}>
 <Text size="sm" lineClamp={2}>{log.queryText}</Text>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={log.intent === 'UNKNOWN' ? 'orange' : 'blue'} variant="light"
 style={{ fontFamily: FONT_FAMILY }}>
 {log.intent ?? 'NULL'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="dot"
 color={(log.confidence ?? 0) >= 0.5 ? 'yellow' : 'red'}>
 {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : '—'}
 </Badge>
 </Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{log.resolvedBy ?? '—'}</Text></Table.Td>
 <Table.Td>
 {log.userRating != null ? (
 <Badge size="xs" color={log.userRating > 0 ? 'green' : 'red'} variant="filled">
 {log.userRating > 0 ? '👍' : '👎'}
 </Badge>
 ) : '—'}
 </Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</Text></Table.Td>
 <Table.Td>
 {log.userRating == null && (
 <Group gap={4}>
 <Tooltip label="Mark as good">
 <ActionIcon size="xs" variant="subtle" color="teal"
 onClick={() => handleFeedback(log.id, 1)}>
 <IconCheck size={12} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Mark as bad">
 <ActionIcon size="xs" variant="subtle" color="red"
 onClick={() => handleFeedback(log.id, -1)}>
 <IconThumbDown size={12} />
 </ActionIcon>
 </Tooltip>
 </Group>
 )}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 )}
 </ScrollArea>
 </Paper>
 </Tabs.Panel>

 {/* ── Negative Rated Logs ── */}
 <Tabs.Panel value="negative-rated">
 <Paper shadow="xs" radius="md" withBorder>
 <ScrollArea h={480}>
 {loadingNeg ? (
 <Skeleton height={200} radius="sm" />
 ) : errorNeg ? (
 <Box p="lg"><Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>Failed to load negatively-rated logs. Refresh to try again.</Alert></Box>
 ) : !negRatedLogs || negRatedLogs.length === 0 ? (
 <Box p="xl" ta="center">
 <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>No negatively-rated queries found.</Text>
 </Box>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Query</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>User Explanation</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Intent</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Confidence</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Strategy</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Screenshot</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Date</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {negRatedLogs.map((log) => (
 <Table.Tr key={log.id}>
 <Table.Td style={{ fontFamily: FONT_FAMILY, maxWidth: 280 }}>
 <Text size="sm" lineClamp={2}>{log.queryText}</Text>
 </Table.Td>
 <Table.Td style={{ fontFamily: FONT_FAMILY, maxWidth: 280 }}>
 {log.feedbackComment ? (
 <Text size="xs" c="red.6" lineClamp={3} style={{ fontStyle: 'italic' }}>
 {log.feedbackComment}
 </Text>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={log.intent === 'UNKNOWN' ? 'orange' : 'blue'} variant="light">
 {log.intent ?? 'NULL'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="dot"
 color={(log.confidence ?? 0) >= 0.75 ? 'green' : 'orange'}>
 {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : '—'}
 </Badge>
 </Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{log.resolvedBy ?? '—'}</Text></Table.Td>
 <Table.Td>
 {log.feedbackScreenshot ? (
 <Tooltip label="Click to view screenshot" position="left">
 <Box
 style={{ display: 'inline-block', cursor: 'pointer' }}
 onClick={() => {
 const src = log.feedbackScreenshot!.startsWith('data:')
 ? log.feedbackScreenshot!
 : `data:image/png;base64,${log.feedbackScreenshot}`;
 setScreenshotModal(src);
 }}
 >
 <img
 src={log.feedbackScreenshot.startsWith('data:') ? log.feedbackScreenshot : `data:image/png;base64,${log.feedbackScreenshot}`}
 alt="Feedback screenshot"
 style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #dee2e6' }}
 />
 </Box>
 </Tooltip>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</Text></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 )}
 </ScrollArea>
 </Paper>
 </Tabs.Panel>

 {/* ── Learned Patterns ── */}
 <Tabs.Panel value="patterns">
 <Paper shadow="xs" radius="md" withBorder>
 <ScrollArea h={480}>
 {loadingPatterns ? (
 <Skeleton height={200} radius="sm" />
 ) : errorPatterns ? (
 <Box p="lg"><Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>Failed to load learned patterns. Refresh to try again.</Alert></Box>
 ) : !patterns || patterns.length === 0 ? (
 <Box p="xl" ta="center">
 <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 No learned patterns yet. Click "Run Learner" to mine patterns from query logs.
 </Text>
 </Box>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Pattern</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Type</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Intent</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Confidence</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Source</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Keywords</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Seen</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Votes</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Last Matched</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Active</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {patterns.map((p) => (
 <Table.Tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
 <Table.Td style={{ fontFamily: FONT_FAMILY, maxWidth: 250 }}>
 <Text size="sm" lineClamp={2}>{p.queryPattern}</Text>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="light" color="gray">{p.patternType}</Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="light"
 color={p.resolvedIntent === 'UNKNOWN' ? 'orange' : 'blue'}>
 {p.resolvedIntent}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="dot"
 color={p.confidence >= 0.75 ? 'green' : 'orange'}>
 {Math.round(p.confidence * 100)}%
 </Badge>
 </Table.Td>
 <Table.Td>
 <Group gap={4}>
 <Badge size="xs" variant="outline"
 color={p.source === 'USER_FEEDBACK' ? 'teal' : p.source === 'MANUAL' ? 'blue' : 'gray'}>
 {p.source}
 </Badge>
 {p.corrective && (
 <Badge size="xs" variant="filled" color="red">corrective</Badge>
 )}
 </Group>
 </Table.Td>
 <Table.Td style={{ maxWidth: 160 }}>
 {p.keywords ? (
 <Text size="xs" c="dimmed" lineClamp={2} style={{ fontFamily: FONT_FAMILY }}>
 {p.keywords.split(',').map(k => k.trim()).join(', ')}
 </Text>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </Table.Td>
 <Table.Td><Text size="xs">{p.timesSeen}</Text></Table.Td>
 <Table.Td>
 <Group gap={4}>
 <Text size="xs" c="teal">+{p.positiveVotes}</Text>
 <Text size="xs" c="red">-{p.negativeVotes}</Text>
 </Group>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c="dimmed">
 {p.lastMatchedAt ? new Date(p.lastMatchedAt).toLocaleDateString() : 'Never'}
 </Text>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={p.active ? 'green' : 'gray'} variant="filled">
 {p.active ? 'Yes' : 'No'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Group gap={4}>
 <Tooltip label={p.active ? 'Deactivate' : 'Activate'}>
 <ActionIcon size="xs" variant="subtle" color="blue"
 onClick={() => handleToggle(p.id)}>
 <IconToggleLeft size={14} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Delete">
 <ActionIcon size="xs" variant="subtle" color="red"
 onClick={() => handleDelete(p.id)}>
 <IconTrash size={14} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 )}
 </ScrollArea>
 </Paper>
 </Tabs.Panel>

 {/* ── Run History ── */}
 <Tabs.Panel value="run-history">
 <Paper shadow="xs" radius="md" withBorder>
 <ScrollArea h={480}>
 {loadingHistory ? (
 <Skeleton height={200} radius="sm" />
 ) : errorHistory ? (
 <Box p="lg"><Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>Failed to load run history. Refresh to try again.</Alert></Box>
 ) : !runHistory || runHistory.length === 0 ? (
 <Box p="xl" ta="center">
 <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 No learner runs recorded yet. Click "Run Learner" to start.
 </Text>
 </Box>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>#</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Trigger</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Run Date</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Duration</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Total Queries</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Unknown</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Low Conf.</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Active Patterns</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>New Patterns</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Positive</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Negative</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Trend</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {runHistory.map((run, idx) => {
 const prev = idx < runHistory.length - 1 ? runHistory[idx + 1] : null;
 const unknownDelta = prev ? run.unknownQueries - prev.unknownQueries : 0;
 const patternDelta = prev ? run.activePatterns - prev.activePatterns : 0;

 return (
 <Table.Tr key={run.id}>
 <Table.Td><Text size="xs" c="dimmed">{runHistory.length - idx}</Text></Table.Td>
 <Table.Td>
 <Badge
 size="xs"
 variant="light"
 color={
 run.triggeredBy === 'SCHEDULED' ? 'teal'
 : run.triggeredBy === 'FEEDBACK' ? 'orange'
 : 'blue'
 }
 leftSection={
 run.triggeredBy === 'SCHEDULED' ? <IconClock size={10} />
 : run.triggeredBy === 'FEEDBACK' ? <IconThumbDown size={10} />
 : <IconPlayerPlay size={10} />
 }
 >
 {run.triggeredBy ?? 'MANUAL'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
 {run.runAt ? new Date(run.runAt).toLocaleString() : '—'}
 </Text>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c="dimmed">{run.durationMs != null ? `${run.durationMs}ms` : '—'}</Text>
 </Table.Td>
 <Table.Td><Text size="xs" fw={600}>{run.totalQueries}</Text></Table.Td>
 <Table.Td>
 <Group gap={4}>
 <Text size="xs" c={run.unknownQueries > 0 ? 'orange' : 'dimmed'}>{run.unknownQueries}</Text>
 {prev != null && <TrendBadge value={-unknownDelta} invertColors />}
 </Group>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c={run.lowConfidence > 0 ? 'orange' : 'dimmed'}>{run.lowConfidence}</Text>
 </Table.Td>
 <Table.Td>
 <Group gap={4}>
 <Text size="xs" fw={600} c={AQUA}>{run.activePatterns}</Text>
 {prev != null && <TrendBadge value={patternDelta} />}
 </Group>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="light" color={run.newPatterns > 0 ? 'teal' : 'gray'}>
 +{run.newPatterns}
 </Badge>
 </Table.Td>
 <Table.Td><Text size="xs" c="teal">{run.positiveRatings}</Text></Table.Td>
 <Table.Td><Text size="xs" c="red">{run.negativeRatings}</Text></Table.Td>
 <Table.Td>
 {prev != null ? (
 <RunTrendSummary current={run} previous={prev} />
 ) : (
 <Text size="xs" c="dimmed">Baseline</Text>
 )}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 )}
 </ScrollArea>
 </Paper>
 </Tabs.Panel>

 {/* ── Analytics Dashboard ── */}
 <Tabs.Panel value="analytics">
 <AnalyticsPanel
 displayStats={displayStats}
 runHistory={runHistory ?? []}
 lowConfLogs={lowConfLogs ?? []}
 negRatedLogs={negRatedLogs ?? []}
 isDark={isDark}
 />
 </Tabs.Panel>
 </Tabs>

 {/* ── Screenshot Preview Modal ── */}
 <Modal
 opened={screenshotModal !== null}
 onClose={() => setScreenshotModal(null)}
 title="Feedback Screenshot"
 size="lg"
 centered
 styles={{ title: { fontFamily: FONT_FAMILY, fontWeight: 600, color: headingColor } }}
 >
 {screenshotModal && (
 <Image
 src={screenshotModal}
 alt="Feedback screenshot"
 radius="md"
 fit="contain"
 style={{ maxHeight: '70vh' }}
 />
 )}
 </Modal>
 </Container>
 );
}

// ── Trend Badge ──

function TrendBadge({ value, invertColors }: { value: number; invertColors?: boolean }) {
 if (value === 0) return null;
 const isUp = value > 0;
 const color = invertColors
 ? (isUp ? 'teal' : 'red')
 : (isUp ? 'teal' : 'red');
 return (
 <Badge size="xs" variant="light" color={color} leftSection={
 isUp ? <IconArrowUpRight size={10} /> : <IconArrowDownRight size={10} />
 }>
 {isUp ? '+' : ''}{value}
 </Badge>
 );
}

// ── Run Trend Summary ──

function RunTrendSummary({ current, previous }: { current: NlpLearnerRunHistory; previous: NlpLearnerRunHistory }) {
 const totalDelta = current.totalQueries - previous.totalQueries;
 const unknownDelta = current.unknownQueries - previous.unknownQueries;
 const patternDelta = current.activePatterns - previous.activePatterns;

 // Overall trend: more patterns + fewer unknowns = improving
 const improving = patternDelta > 0 || unknownDelta < 0;
 const declining = patternDelta < 0 || unknownDelta > 0;

 if (improving && !declining) {
 return <Badge size="xs" variant="light" color="teal" leftSection={<IconArrowUpRight size={10} />}>Improving</Badge>;
 }
 if (declining && !improving) {
 return <Badge size="xs" variant="light" color="orange" leftSection={<IconArrowDownRight size={10} />}>Needs Attention</Badge>;
 }
 if (totalDelta === 0 && unknownDelta === 0 && patternDelta === 0) {
 return <Badge size="xs" variant="light" color="gray" leftSection={<IconMinus size={10} />}>No Change</Badge>;
 }
 return <Badge size="xs" variant="light" color="blue" leftSection={<IconMinus size={10} />}>Mixed</Badge>;
}

// ── Stat Card component ──

function StatCard({ label, value, icon, color, onClick, tooltip }: {
 label: string; value: number; icon: React.ReactNode; color: string;
 onClick?: () => void; tooltip?: string;
}) {
 const card = (
 <Paper
 shadow="xs" radius="md" p="md" withBorder
 style={{
 cursor: onClick ? 'pointer' : 'default',
 transition: 'transform 0.15s ease, box-shadow 0.15s ease',
 }}
 onClick={onClick}
 onMouseEnter={(e) => {
 if (onClick) {
 e.currentTarget.style.transform = 'translateY(-2px)';
 e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
 }
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.transform = '';
 e.currentTarget.style.boxShadow = '';
 }}
 >
 <Group gap="sm" align="flex-start">
 <ThemeIcon size={36} radius="md" variant="light" style={{ color, backgroundColor: `${color}15` }}>
 {icon}
 </ThemeIcon>
 <div>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
 <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color }}>{value}</Text>
 </div>
 </Group>
 </Paper>
 );

 return tooltip ? <Tooltip label={tooltip} position="bottom">{card}</Tooltip> : card;
}

// ── Analytics Panel ──

interface AnalyticsPanelProps {
 displayStats: {
 totalQueries: number; unknownQueries: number; lowConfidenceQueries: number;
 positiveRatings: number; negativeRatings: number; activePatterns: number;
 newPatternsGenerated: number; strategyCount: number;
 intentDistribution: Record<string, number> | null;
 strategyAvgConfidence: Record<string, number> | null;
 lastRunAt: string | null;
 } | null;
 runHistory: NlpLearnerRunHistory[];
 lowConfLogs: { id: number; queryText: string; confidence: number | null; resolvedBy: string | null }[];
 negRatedLogs: { id: number; queryText: string; confidence: number | null; resolvedBy: string | null }[];
 isDark: boolean;
}

function AnalyticsPanel({ displayStats, runHistory, lowConfLogs, negRatedLogs, isDark }: AnalyticsPanelProps) {
 const borderColor = isDark ? '#2C2C2C' : '#E9ECEF';

 // ── Strategy distribution from run history ──
 const strategyDistribution = (() => {
 if (!displayStats?.strategyAvgConfidence) return [];
 const entries = Object.entries(displayStats.strategyAvgConfidence);
 return entries.map(([strategy, avgConf]) => ({
 strategy,
 avgConf: Math.round(avgConf * 100),
 color: strategy === 'DETERMINISTIC' ? 'teal' : strategy === 'RULE_BASED' ? 'blue' : 'violet',
 }));
 })();

 // ── Intent distribution ──
 const intentEntries = (() => {
 if (!displayStats?.intentDistribution) return [];
 const total = Object.values(displayStats.intentDistribution).reduce((a, b) => a + b, 0) || 1;
 return Object.entries(displayStats.intentDistribution)
 .sort((a, b) => b[1] - a[1])
 .map(([intent, count]) => ({ intent, count, pct: Math.round((count / total) * 100) }));
 })();

 // ── Query volume trend (last 10 runs, oldest→newest) ──
 const volumeTrend = [...runHistory].reverse().slice(-10);

 // ── Top failure queries (merged low-conf + neg-rated, deduplicated) ──
 const failureQueryMap = new Map<string, { queryText: string; reason: string; conf: number }>();
 lowConfLogs.slice(0, 10).forEach(l => {
 if (!failureQueryMap.has(l.queryText)) {
 failureQueryMap.set(l.queryText, { queryText: l.queryText, reason: 'Low confidence', conf: l.confidence ?? 0 });
 }
 });
 negRatedLogs.slice(0, 10).forEach(l => {
 failureQueryMap.set(l.queryText, { queryText: l.queryText, reason: 'Negative rating', conf: l.confidence ?? 0 });
 });
 const topFailures = Array.from(failureQueryMap.values()).slice(0, 8);

 const maxVolume = Math.max(...volumeTrend.map(r => r.totalQueries), 1);

 return (
 <Stack gap="md">
 <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
 {/* Strategy Confidence */}
 <Paper shadow="xs" radius="md" withBorder p="md">
 <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY, color: AQUA }}>
 Strategy Avg. Confidence
 </Text>
 {strategyDistribution.length === 0 ? (
 <Text c="dimmed" size="xs">Run the learner to populate strategy metrics.</Text>
 ) : (
 <Stack gap="sm">
 {strategyDistribution.map(({ strategy, avgConf, color }) => (
 <Box key={strategy}>
 <Group justify="space-between" mb={4}>
 <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{strategy}</Text>
 <Badge size="xs" color={color} variant="light">{avgConf}%</Badge>
 </Group>
 <Progress value={avgConf} color={color} radius="sm" size="sm" />
 </Box>
 ))}
 </Stack>
 )}
 </Paper>

 {/* Intent Distribution */}
 <Paper shadow="xs" radius="md" withBorder p="md">
 <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY, color: AQUA }}>
 Intent Distribution
 </Text>
 {intentEntries.length === 0 ? (
 <Text c="dimmed" size="xs">Run the learner to populate intent metrics.</Text>
 ) : (
 <Stack gap="sm">
 {intentEntries.map(({ intent, count, pct }) => (
 <Box key={intent}>
 <Group justify="space-between" mb={4}>
 <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{intent}</Text>
 <Group gap={4}>
 <Text size="xs" c="dimmed">{count}</Text>
 <Badge size="xs" color="blue" variant="light">{pct}%</Badge>
 </Group>
 </Group>
 <Progress value={pct} color="blue" radius="sm" size="sm" />
 </Box>
 ))}
 </Stack>
 )}
 </Paper>
 </SimpleGrid>

 {/* Query Volume Trend */}
 <Paper shadow="xs" radius="md" withBorder p="md">
 <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY, color: AQUA }}>
 Query Volume — Last {volumeTrend.length} Runs
 </Text>
 {volumeTrend.length === 0 ? (
 <Text c="dimmed" size="xs">No run history yet. Click "Run Learner" to start.</Text>
 ) : (
 <Box style={{ overflowX: 'auto' }}>
 <Group gap={0} align="flex-end" style={{ minWidth: 320, height: 80 }}>
 {volumeTrend.map((run) => {
 const barPct = Math.max(8, Math.round((run.totalQueries / maxVolume) * 100));
 const unknownPct = run.totalQueries > 0
 ? Math.round((run.unknownQueries / run.totalQueries) * 100)
 : 0;
 return (
 <Tooltip
 key={run.id}
 label={`${new Date(run.runAt).toLocaleDateString()} · ${run.totalQueries} queries · ${run.unknownQueries} unknown`}
 position="top"
 fz="xs"
 >
 <Box
 style={{
 flex: 1,
 height: `${barPct}%`,
 minHeight: 8,
 background: unknownPct > 20
 ? `linear-gradient(to top, #FA5252 ${unknownPct}%, ${AQUA} ${unknownPct}%)`
 : AQUA,
 borderRadius: '4px 4px 0 0',
 margin: '0 2px',
 cursor: 'default',
 opacity: 0.85,
 transition: 'opacity 0.15s',
 }}
 onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
 onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; }}
 />
 </Tooltip>
 );
 })}
 </Group>
 <Box
 style={{ borderTop: `1px solid ${borderColor}`, marginTop: 4, paddingTop: 4 }}
 >
 <Group gap={0} style={{ minWidth: 320 }}>
 {volumeTrend.map((run) => (
 <Text key={run.id} size="xs" c="dimmed" ta="center"
 style={{ flex: 1, fontSize: 10, fontFamily: FONT_FAMILY }}>
 {new Date(run.runAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
 </Text>
 ))}
 </Group>
 </Box>
 </Box>
 )}
 </Paper>

 {/* Top Failure Queries */}
 <Paper shadow="xs" radius="md" withBorder p="md">
 <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY, color: AQUA }}>
 Top Failure Queries
 </Text>
 {topFailures.length === 0 ? (
 <Text c="dimmed" size="xs">No failure queries logged yet — great coverage!</Text>
 ) : (
 <Stack gap="xs">
 {topFailures.map((f, idx) => (
 <Group key={idx} gap="sm" align="flex-start" wrap="nowrap"
 style={{ padding: '6px 8px', borderRadius: 6,
 background: isDark ? '#1A1B1E' : '#F8F9FA',
 border: `1px solid ${borderColor}` }}>
 <Badge size="xs" color={f.reason === 'Negative rating' ? 'red' : 'orange'} variant="light">
 {f.reason}
 </Badge>
 <Text size="xs" style={{ fontFamily: FONT_FAMILY, flex: 1 }} lineClamp={2}>
 {f.queryText}
 </Text>
 {f.conf > 0 && (
 <Badge size="xs" color="gray" variant="light">{Math.round(f.conf * 100)}%</Badge>
 )}
 </Group>
 ))}
 </Stack>
 )}
 </Paper>
 </Stack>
 );
}
