import { useState } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Badge, Button,
  Table, ActionIcon, Tooltip, SimpleGrid, Box, Loader, Switch,
  Tabs, ThemeIcon, Progress, ScrollArea, Modal, Image,
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
import { DEEP_BLUE, AQUA, FONT_FAMILY, AQUA_TINTS, DEEP_BLUE_TINTS } from '../../brandTokens';

export default function NlpOptimizerPage() {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<NlpLearnerStats | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('low-confidence');

  const runLearner = useRunNlpLearner();
  const { data: lowConfLogs, isLoading: loadingLowConf } = useNlpLowConfidenceLogs();
  const { data: negRatedLogs, isLoading: loadingNeg } = useNlpNegativeRatedLogs();
  const { data: patterns, isLoading: loadingPatterns } = useNlpLearnedPatterns();
  const { data: runHistory, isLoading: loadingHistory } = useNlpLearnerRunHistory();
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
    <Container size="xl" py="md">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
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
            <StatCard label="Unknown" value={displayStats.unknownQueries} icon={<IconAlertTriangle size={18} />} color="#e67700"
              onClick={() => setActiveTab('low-confidence')} tooltip="View low confidence logs" />
            <StatCard label="Low Confidence" value={displayStats.lowConfidenceQueries} icon={<IconTrendingUp size={18} />} color="#c92a2a"
              onClick={() => setActiveTab('low-confidence')} tooltip="View low confidence logs" />
            <StatCard label="New Patterns" value={displayStats.newPatternsGenerated} icon={<IconSparkles size={18} />} color={AQUA}
              onClick={() => setActiveTab('patterns')} tooltip="View learned patterns" />
            <StatCard label="Active Patterns" value={displayStats.activePatterns} icon={<IconBrain size={18} />} color={DEEP_BLUE}
              onClick={() => setActiveTab('patterns')} tooltip="View learned patterns" />
            <StatCard label="Positive Ratings" value={displayStats.positiveRatings} icon={<IconCheck size={18} />} color="#2b8a3e"
              onClick={() => setActiveTab('run-history')} tooltip="View run history" />
            <StatCard label="Negative Ratings" value={displayStats.negativeRatings} icon={<IconThumbDown size={18} />} color="#c92a2a"
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
          <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>No Data Yet</Text>
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Click "Run Learner" to analyze query logs and generate insights
          </Text>
        </Paper>
      )}

      {/* ── Intent Distribution ── */}
      {displayStats && displayStats.intentDistribution && Object.keys(displayStats.intentDistribution).length > 0 && (
        <Paper shadow="xs" radius="md" p="md" mb="lg" withBorder>
          <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
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
          <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Average Confidence by Strategy
          </Text>
          <Group gap="lg">
            {Object.entries(displayStats.strategyAvgConfidence).map(([strategy, avg]) => (
              <Paper key={strategy} p="sm" radius="md" withBorder style={{ flex: 1, minWidth: 140 }}>
                <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{strategy}</Text>
                <Text size="lg" fw={700} style={{ color: avg >= 0.75 ? '#2b8a3e' : '#e67700', fontFamily: FONT_FAMILY }}>
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
        </Tabs.List>

        {/* ── Low Confidence Logs ── */}
        <Tabs.Panel value="low-confidence">
          <Paper shadow="xs" radius="md" withBorder>
            <ScrollArea h={480}>
              {loadingLowConf ? (
                <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
              ) : !lowConfLogs || lowConfLogs.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>No low-confidence queries found.</Text>
                </Box>
              ) : (
                <Table striped highlightOnHover withTableBorder>
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
                <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
              ) : !negRatedLogs || negRatedLogs.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>No negatively-rated queries found.</Text>
                </Box>
              ) : (
                <Table striped highlightOnHover withTableBorder>
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
                <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
              ) : !patterns || patterns.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    No learned patterns yet. Click "Run Learner" to mine patterns from query logs.
                  </Text>
                </Box>
              ) : (
                <Table striped highlightOnHover withTableBorder>
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
                <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
              ) : !runHistory || runHistory.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    No learner runs recorded yet. Click "Run Learner" to start.
                  </Text>
                </Box>
              ) : (
                <Table striped highlightOnHover withTableBorder>
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
      </Tabs>

      {/* ── Screenshot Preview Modal ── */}
      <Modal
        opened={screenshotModal !== null}
        onClose={() => setScreenshotModal(null)}
        title="Feedback Screenshot"
        size="lg"
        centered
        styles={{ title: { fontFamily: FONT_FAMILY, fontWeight: 600, color: DEEP_BLUE } }}
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
