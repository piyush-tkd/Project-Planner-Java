import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container, Text, Paper, Group, Stack, Badge, Box, SimpleGrid,
  Loader, Transition, ThemeIcon, Tooltip, useComputedColorScheme,
  Alert, Drawer, ScrollArea, Button, ActionIcon,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSparkles, IconChevronRight, IconHistory, IconX, IconExternalLink, IconInfoCircle,
} from '@tabler/icons-react';
import { PPPageLayout } from '../../components/pp';
import {
  useNlpQuery, useNlpCatalog, useNlpCatalogWarmup, useNlpInsights,
  directToolCall, useNlpHealth, useNlpSuggest, useNlpConversations,
  useToggleNlpPin, streamNlpQuery, NlpQueryResponse,
} from '../../api/nlp';
import { useAuth } from '../../auth/AuthContext';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS, FONT_FAMILY, BORDER_DEFAULT } from '../../brandTokens';

import { QUICK_ACTIONS, SSE_PHASE_MAP, MAX_RECENT_QUERIES } from './constants';
import { getSmartGreeting } from './utils';
import { useSessionMemory } from './state/hooks';
import { NLP_STYLES } from './styles';
import { ResultCardHeader, FeedbackRow, DebugTracePanel } from './components/CardComponents';
import { CardBody } from './components/CardBody';
import { HeroSection } from './components/HeroSection';
import { SearchInput } from './components/SearchInput';

const LOADING_STEPS = [
  { icon: <IconSparkles size={16} />, text: 'Understanding your question…', detail: 'Parsing intent & entities' },
  { icon: <IconSparkles size={16} />, text: 'Searching across all teams…', detail: 'Scanning resources, projects & pods' },
  { icon: <IconSparkles size={16} />, text: 'Analyzing matching data…', detail: 'Computing metrics & insights' },
  { icon: <IconSparkles size={16} />, text: 'Synthesizing answer…', detail: 'Building your response' },
  { icon: <IconSparkles size={16} />, text: 'Almost there…', detail: 'Finalizing results' },
];

export default function NlpLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayLabel } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const greeting = useMemo(() => getSmartGreeting(displayLabel), [displayLabel]);

  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [result, setResult] = useState<NlpQueryResponse | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const recognitionRef = useRef<any>(null);
  const handleSubmitRef = useRef<((q?: string) => void) | null>(null);
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sseAbortRef = useRef<(() => void) | null>(null);

  const { sessionMemoryRef, buildSessionContext, addToSessionMemory } = useSessionMemory();
  const nlpQuery = useNlpQuery();
  const { data: catalog } = useNlpCatalog();
  const { data: insightCards } = useNlpInsights();
  const { data: nlpHealth } = useNlpHealth();
  const { data: conversations } = useNlpConversations();
  const togglePin = useToggleNlpPin();
  const { data: nlpSuggestData } = useNlpSuggest(debouncedQuery);

  const isNlpDegraded = nlpHealth != null && nlpHealth.tier !== 'FULL';
  const nlpTierLabel = nlpHealth?.tier === 'DB_ONLY'
    ? 'Rule-based only (Ollama offline)'
    : nlpHealth?.tier === 'REGEX_ONLY'
    ? 'Regex-only (Ollama + pgvector offline)'
    : null;

  const isLoading = nlpQuery.isPending || isStreaming;

  useNlpCatalogWarmup();

  useEffect(() => {
    const state = location.state as any;
    if (state?.resumeContext) {
      try {
        const contextArray = JSON.parse(state.resumeContext);
        if (Array.isArray(contextArray)) sessionMemoryRef.current = contextArray;
      } catch (e) {
        console.warn('Failed to parse resume context:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (nlpQuery.isPending && !isStreaming) {
      setLoadingPhase(0);
      const stepDelays = [2500, 3000, 3500, 4000];
      let cumulative = 0;
      const timers: ReturnType<typeof setTimeout>[] = [];
      stepDelays.forEach((delay, idx) => {
        cumulative += delay;
        timers.push(setTimeout(() => setLoadingPhase(idx + 1), cumulative));
      });
      loadingTimersRef.current = timers;
    } else if (!nlpQuery.isPending && !isStreaming) {
      loadingTimersRef.current.forEach(t => clearTimeout(t));
      loadingTimersRef.current = [];
      setLoadingPhase(0);
    }
    return () => { loadingTimersRef.current.forEach(t => clearTimeout(t)); };
  }, [nlpQuery.isPending, isStreaming]);

  const autocompleteData = useMemo(() => {
    if (!catalog) return [];
    const items: string[] = [];
    catalog.projects?.forEach((p) => items.push(`Tell me about ${p}`));
    catalog.resources?.forEach((r) => items.push(`Who is ${r}`));
    catalog.pods?.forEach((p) => items.push(`${p} pod details`));
    catalog.sprints?.slice(0, 5).forEach((s) => items.push(`${s} allocations`));
    catalog.releases?.slice(0, 3).forEach((r) => items.push(`${r} release`));
    items.push('Show capacity gaps', 'Which pods are over capacity?',
      'Show utilization heatmap', 'Create a new project',
      'Show all developers', 'India team details', 'Show active projects');
    return items;
  }, [catalog]);

  const serverSuggestSet = useMemo(
    () => new Set<string>(nlpSuggestData ?? []),
    [nlpSuggestData]
  );

  const mergedAutocompleteData = useMemo(() => {
    const server = nlpSuggestData ?? [];
    const filtered = autocompleteData.filter(item => !serverSuggestSet.has(item));
    return [...new Set([...server, ...filtered])];
  }, [nlpSuggestData, autocompleteData, serverSuggestSet]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addToRecentLocal = useCallback((text: string) => {
    setRecentQueries((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== text.toLowerCase());
      return [text, ...filtered].slice(0, MAX_RECENT_QUERIES);
    });
  }, []);

  const handleSubmit = useCallback((q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setShowResult(false);
    addToRecentLocal(text);

    const sessionContext = buildSessionContext();
    if (sseAbortRef.current) { sseAbortRef.current(); sseAbortRef.current = null; }

    setIsStreaming(true);
    setLoadingPhase(0);

    const abort = streamNlpQuery(text, {
      onPhase: (phase) => {
        const idx = SSE_PHASE_MAP[phase.phase];
        if (idx !== undefined) setLoadingPhase(idx);
      },
      onResult: (res) => {
        setIsStreaming(false);
        setResult(res);
        setShowResult(true);
        addToSessionMemory(text, res);
        if (res.intent === 'NAVIGATE' && res.confidence >= 0.9 && res.response?.route) {
          setTimeout(() => navigate(res.response.route!), 600);
        }
      },
      onError: () => {
        setIsStreaming(false);
        nlpQuery.mutate({ query: text, sessionContext }, {
          onSuccess: (res) => {
            setResult(res);
            setShowResult(true);
            addToSessionMemory(text, res);
            if (res.intent === 'NAVIGATE' && res.confidence >= 0.9 && res.response?.route) {
              setTimeout(() => navigate(res.response.route!), 600);
            }
          },
          onError: () => {
            setResult({
              intent: 'ERROR',
              confidence: 0,
              response: { summary: 'Sorry, something went wrong. Please try again or rephrase your question.' },
            } as any);
            setShowResult(true);
          },
        });
      },
    }, sessionContext);
    sseAbortRef.current = abort;
  }, [query, nlpQuery, navigate, addToRecentLocal, buildSessionContext, addToSessionMemory]);

  handleSubmitRef.current = handleSubmit;

  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notifications.show({ title: 'Not supported', message: 'Voice input is not supported in this browser.', color: 'orange' });
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setShowResult(false);
      setTimeout(() => handleSubmitRef.current?.(transcript), 100);
    };
    recognition.start();
  }, [isListening]);

  const handleNavigate = (route: string) => {
    navigate(route, { state: { fromNlp: true } });
  };

  const handleNavigateWithToast = useCallback((route: string, entityName?: string) => {
    if (entityName) {
      notifications.show({
        title: 'Navigating',
        message: `Opening ${entityName}…`,
        color: 'teal',
        autoClose: 1500,
        withCloseButton: false,
      });
    }
    navigate(route, { state: { fromNlp: true } });
  }, [navigate]);

  const handleFormPrefill = (route: string, formData: Record<string, unknown>) => {
    navigate(route, { state: { prefill: formData, fromNlp: true } });
  };

  const handleQuickAction = (q: string) => {
    setQuery(q);
    handleSubmit(q);
  };

  return (
    <PPPageLayout title="Ask AI" subtitle="Natural language queries across your portfolio data" animate>
      <Container size="md" pt={8} pb={32} style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
        <HeroSection greeting={greeting} isDark={isDark} />

        {isNlpDegraded && nlpTierLabel && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="yellow"
            radius="lg"
            mb="sm"
            style={{ fontFamily: FONT_FAMILY }}
            title="AI running in limited mode"
          >
            <span>{nlpTierLabel}. Complex questions may not be answered.</span>
          </Alert>
        )}

        {insightCards && insightCards.length > 0 && !showResult && !isLoading && (
          <SimpleGrid cols={{ base: 1, xs: 2, sm: Math.min(insightCards.length, 4) }} spacing={8} mt={0} mb={12}>
            {insightCards.map((card) => (
              <Paper
                key={card.id}
                px={12}
                py={10}
                radius="md"
                withBorder
                className="nlp-insight-card"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderColor: isDark ? 'rgba(45,204,211,0.15)' : 'rgba(12,35,64,0.10)',
                  borderLeft: `3px solid ${AQUA}`,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  background: isDark ? 'rgba(45,204,211,0.03)' : '#ffffff',
                  boxShadow: isDark ? 'none' : '0 1px 4px rgba(12,35,64,0.06)',
                }}
                onClick={async () => {
                  setQuery(card.query);
                  if (card.toolName) {
                    setIsStreaming(true);
                    setShowResult(false);
                    setLoadingPhase(0);
                    try {
                      const res = await directToolCall(card.toolName, card.toolParams ?? {});
                      setResult(res);
                      setShowResult(true);
                      setIsStreaming(false);
                      addToSessionMemory(card.query, res);
                    } catch {
                      setIsStreaming(false);
                      handleSubmit(card.query);
                    }
                  } else {
                    handleSubmit(card.query);
                  }
                }}
              >
                <Group gap={8} wrap="nowrap" align="center" style={{ position: 'relative', zIndex: 1 }}>
                  <ThemeIcon size={24} radius="sm" variant="light" color={card.color} style={{ flexShrink: 0 }}>
                    <IconSparkles size={14} />
                  </ThemeIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={4} wrap="nowrap" justify="space-between" align="center">
                      <Text size="xs" fw={600} lineClamp={1} style={{ color: isDark ? '#e9ecef' : DEEP_BLUE, fontSize: 12 }}>
                        {card.title}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1} lh={1.3} mt={1} style={{ fontSize: 11, color: isDark ? '#6b7280' : '#6D7B8C' }}>
                      {card.description}
                    </Text>
                  </Box>
                  <IconChevronRight size={14} style={{ flexShrink: 0, color: AQUA, opacity: 0.6 }} />
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {conversations && conversations.length > 0 && (
          <Group justify="flex-end" mb={6}>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconHistory size={12} />}
              rightSection={
                <Badge size="xs" circle color="teal" variant="filled" style={{ minWidth: 16, fontSize: 9, padding: 0 }}>
                  {conversations.length}
                </Badge>
              }
              onClick={() => setHistoryOpen(true)}
              style={{
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                fontSize: 12,
                color: isDark ? '#9ca3af' : '#6D7B8C',
                padding: '4px 8px',
                height: 'auto',
              }}
            >
              Conversation history
            </Button>
          </Group>
        )}

        <SearchInput
          inputRef={inputRef}
          query={query}
          setQuery={setQuery}
          isDark={isDark}
          inputFocused={inputFocused}
          setInputFocused={setInputFocused}
          isLoading={isLoading}
          isListening={isListening}
          mergedAutocompleteData={mergedAutocompleteData}
          showResult={showResult}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          onOptionSubmit={(val) => { setQuery(val); setTimeout(() => handleSubmit(val), 50); }}
          onStartVoice={startVoiceInput}
          onSubmit={() => handleSubmit()}
        />

        <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {isLoading && 'Processing your query…'}
          {showResult && result && `Result: ${result.response.message ?? 'Query processed'}`}
        </div>

        {isLoading && !showResult && (
          <Paper shadow="sm" radius="lg" mb="lg" withBorder style={{ overflow: 'hidden' }}>
            <Box style={{ height: 4, background: isDark ? 'var(--mantine-color-dark-5)' : '#f0f1f3', overflow: 'hidden', position: 'relative' }}>
              <Box className="nlp-progress-bar" style={{ height: '100%', width: `${Math.min(((loadingPhase + 1) / LOADING_STEPS.length) * 100, 95)}%`, background: `linear-gradient(90deg, ${AQUA}, ${DEEP_BLUE}, ${AQUA})`, transition: 'width 1s ease-out', boxShadow: `0 0 12px ${AQUA}60`, position: 'relative' }}>
                <Box className="nlp-progress-shimmer" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(90deg, transparent, ${AQUA}40, transparent)`, animation: 'nlp-shimmer 2s infinite' }} />
              </Box>
            </Box>
            <Box px="md" py="md">
              <Group gap="sm" mb="md" wrap="nowrap">
                <ThemeIcon
                  size={36}
                  variant="light"
                  radius="xl"
                  className="nlp-thinking-icon"
                  style={{ backgroundColor: `${AQUA}15`, color: AQUA, boxShadow: `0 0 16px ${AQUA}40` }}
                >
                  {LOADING_STEPS[Math.min(loadingPhase, LOADING_STEPS.length - 1)].icon}
                </ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#e9ecef' : DEEP_BLUE }}>
                    {LOADING_STEPS[Math.min(loadingPhase, LOADING_STEPS.length - 1)].text}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    {LOADING_STEPS[Math.min(loadingPhase, LOADING_STEPS.length - 1)].detail}
                  </Text>
                </Stack>
                <Loader size={18} color={AQUA} type="dots" />
              </Group>
            </Box>
          </Paper>
        )}

        <Transition mounted={showResult && result != null} transition="slide-up" duration={250}>
          {(styles) => (
            <Paper
              style={{
                ...styles,
                overflow: 'hidden',
              }}
              shadow="sm"
              radius="lg"
              mb="lg"
              withBorder
            >
              {result && (
                <Stack gap={0}>
                  <ResultCardHeader result={result} isDark={isDark} />
                  <Box px="md" py="sm">
                    <CardBody result={result} onNavigate={handleNavigate} onNavigateWithToast={handleNavigateWithToast} onFormPrefill={handleFormPrefill} isDark={isDark} />
                  </Box>
                  {result.debug && localStorage.getItem('nlp_debug') === '1' && (
                    <DebugTracePanel result={result} isDark={isDark} />
                  )}
                  {result.queryLogId != null && (
                    <FeedbackRow queryLogId={result.queryLogId} isDark={isDark} />
                  )}
                </Stack>
              )}
            </Paper>
          )}
        </Transition>

        {nlpQuery.isError && (
          <Paper p="md" mb="lg" radius="lg" withBorder style={{ borderColor: 'var(--mantine-color-red-4)', borderLeft: `4px solid var(--mantine-color-red-5)` }}>
            <Group gap="sm" justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={32} variant="light" color="red" radius="md">
                  <IconX size={18} />
                </ThemeIcon>
                <div>
                  <Text c="red" size="sm" fw={500}>
                    {nlpQuery.error?.message?.includes('timed out')
                      ? 'The query took too long. The system may be warming up — please try again.'
                      : 'Something went wrong processing your query.'}
                  </Text>
                </div>
              </Group>
              <Button
                variant="light"
                color="red"
                size="xs"
                onClick={() => handleSubmit()}
                loading={isLoading}
              >
                Retry
              </Button>
            </Group>
          </Paper>
        )}

        {!showResult && (
          <>
            <Box>
              <Text size="xs" fw={700} tt="uppercase" mb={8} style={{
                letterSpacing: '0.08em',
                fontFamily: FONT_FAMILY,
                color: isDark ? '#6b7280' : '#6D7B8C',
              }}>
                Quick Actions
              </Text>
              <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }} spacing={8}>
                {QUICK_ACTIONS.map((action) => (
                  <Tooltip key={action.label} label={action.query.endsWith(' ') ? `Type & complete: "${action.query.trim()}…"` : `Ask: "${action.query}"`} position="bottom" withArrow openDelay={400} multiline maw={260}>
                    <Paper
                      px={10}
                      py={9}
                      radius="md"
                      withBorder
                      className="quick-action-btn"
                      style={{
                        cursor: 'pointer',
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,35,64,0.10)',
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(12,35,64,0.06)',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => handleQuickAction(action.query)}
                    >
                      <Group gap={8} wrap="nowrap" align="center">
                        <ThemeIcon
                          size={26}
                          variant="light"
                          color="teal"
                          radius="sm"
                          style={{ flexShrink: 0 }}
                        >
                          {action.icon}
                        </ThemeIcon>
                        <Text size="xs" fw={500} lineClamp={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#e9ecef' : DEEP_BLUE, fontSize: 12 }}>
                          {action.label}
                        </Text>
                      </Group>
                    </Paper>
                  </Tooltip>
                ))}
              </SimpleGrid>
            </Box>

            {recentQueries.length > 0 && (
              <Box mt="md">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.06em' }}>
                  <Group gap={6}>
                    <IconHistory size={12} />
                    Recent
                  </Group>
                </Text>
                <Group gap="xs">
                  {recentQueries.map((q) => (
                    <Tooltip key={q} label={`Re-run: "${q}"`} position="bottom" withArrow openDelay={400}>
                      <Badge
                        variant="light"
                        size="lg"
                        style={{
                          cursor: 'pointer',
                          textTransform: 'none',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10],
                          color: isDark ? undefined : DEEP_BLUE,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 500,
                          transition: 'all 150ms ease',
                        }}
                        className="nlp-recent-badge"
                        onClick={() => handleQuickAction(q)}
                      >
                        {q}
                      </Badge>
                    </Tooltip>
                  ))}
                </Group>
              </Box>
            )}
          </>
        )}

        {showResult && result && result.suggestions && result.suggestions.length > 0 && (
          <Box mt="md">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.06em' }}>
              Try also
            </Text>
            <Group gap="xs">
              {result.suggestions.map((s) => (
                <Tooltip key={s} label={`Ask: "${s}"`} position="bottom" withArrow openDelay={400}>
                  <Badge
                    variant="outline"
                    size="lg"
                    style={{ cursor: 'pointer', textTransform: 'none', borderColor: AQUA, color: AQUA, transition: 'all 150ms ease' }}
                    className="nlp-suggestion-badge"
                    onClick={() => handleQuickAction(s)}
                  >
                    {s}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          </Box>
        )}

        <style>{NLP_STYLES}</style>
      </Container>

      <Drawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={
          <Group gap="xs">
            <IconHistory size={16} color={AQUA} />
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Conversation History</Text>
          </Group>
        }
        position="right"
        size={380}
        styles={{
          header: { borderBottom: `1px solid ${BORDER_DEFAULT}` },
          title: { fontFamily: FONT_FAMILY },
        }}
      >
        <Stack gap="xs" py="xs">
          {!conversations || conversations.length === 0 ? (
            <Box ta="center" py="xl">
              <Text c="dimmed" size="sm">No conversations yet.</Text>
            </Box>
          ) : (
            <ScrollArea.Autosize mah="calc(100vh - 120px)">
              <Stack gap="xs">
                {[...(conversations ?? [])].sort((a, b) => {
                  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                  return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
                }).map(conv => (
                  <Paper
                    key={conv.id}
                    p="sm"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setQuery(conv.title);
                      setHistoryOpen(false);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon size={28} radius="sm" variant="light" style={{ backgroundColor: AQUA, color: AQUA, flexShrink: 0 }}>
                        <IconSparkles size={14} />
                      </ThemeIcon>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" fw={600} lineClamp={1} style={{ fontFamily: FONT_FAMILY }}>{conv.title || 'Untitled'}</Text>
                        <Group gap={4}>
                          <Text size="xs" c="dimmed">
                            {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : '—'}
                          </Text>
                          <Badge size="xs" variant="light" color="gray" radius="sm">{conv.messageCount} msg</Badge>
                        </Group>
                      </Box>
                      <Group gap={2} onClick={e => e.stopPropagation()}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color={conv.pinned ? 'teal' : 'gray'}
                          onClick={() => togglePin.mutate(conv.id)}
                          aria-label="Open in new tab"
                        >
                          {conv.pinned ? <IconExternalLink size={11} /> : <IconExternalLink size={11} />}
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Drawer>
    </PPPageLayout>
  );
}
