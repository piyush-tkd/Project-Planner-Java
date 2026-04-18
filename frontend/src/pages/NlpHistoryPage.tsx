import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Text, Paper, Group, Stack, Badge, ActionIcon,
  TextInput, Box, Tooltip, Divider, ScrollArea, Collapse, Skeleton,
  Button, Alert, ThemeIcon, Modal, SimpleGrid,
} from '@mantine/core';
import { useComputedColorScheme } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconHistory, IconSearch, IconPin, IconPinFilled, IconTrash,
  IconChevronDown, IconChevronRight, IconSparkles, IconArrowRight,
  IconMessageCircle, IconAlertCircle, IconMoodEmpty, IconBrain,
  IconRobot, IconUser, IconClock, IconMessages,
} from '@tabler/icons-react';
import { PPPageLayout } from '../components/pp';
import {
  useNlpConversations, useNlpConversation, useDeleteNlpConversation,
  useToggleNlpPin, useNlpConversationContext, NlpConversationSummary,
} from '../api/nlp';
import { useQueryClient } from '@tanstack/react-query';
import {
  AQUA, AQUA_HEX, AQUA_TINTS, DEEP_BLUE, DEEP_BLUE_HEX, FONT_FAMILY,
  BORDER_DEFAULT, TEXT_SECONDARY,
} from '../brandTokens';

// ── helpers ───────────────────────────────────────────────────────────────────
function relativeTime(isoStr?: string | null): string {
  if (!isoStr) return 'No messages';
  const d = new Date(isoStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function absoluteTime(isoStr?: string | null): string {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NlpHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDark = useComputedColorScheme('light') === 'dark';

  const [search, setSearch]       = useState('');
  const [debouncedSearch]         = useDebouncedValue(search, 250);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NlpConversationSummary | null>(null);

  const { data: conversations, isLoading, isError } = useNlpConversations();
  const { data: expandedConv, isLoading: loadingMessages } = useNlpConversation(expandedId);
  const togglePin = useToggleNlpPin();
  const deleteConv = useDeleteNlpConversation();

  // ── Filter & sort ─────────────────────────────────────────────────────────
  const q = debouncedSearch.trim().toLowerCase();
  const filtered = useMemo(() =>
    (conversations ?? [])
      .filter(c => !q || c.title.toLowerCase().includes(q))
      .filter(c => c.messageCount > 0), // hide empty "New Chat" placeholders
    [conversations, q, debouncedSearch]
  );
  const pinned   = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  // ── KPI totals ────────────────────────────────────────────────────────────
  const totalConvs = (conversations ?? []).filter(c => c.messageCount > 0).length;
  const totalPinned = (conversations ?? []).filter(c => c.pinned).length;
  const totalMsgs = (conversations ?? []).reduce((acc, c) => acc + c.messageCount, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTogglePin = (conv: NlpConversationSummary) => {
    togglePin.mutate(conv.id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nlp-conversations'] }),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteConv.mutate(deleteTarget.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['nlp-conversations'] });
        if (expandedId === deleteTarget.id) setExpandedId(null);
        notifications.show({ message: 'Conversation deleted', color: 'teal', icon: <IconTrash size={14} /> });
        setDeleteTarget(null);
      },
      onError: () => {
        notifications.show({ message: 'Failed to delete', color: 'red' });
        setDeleteTarget(null);
      },
    });
  };

  // ── surface tokens ────────────────────────────────────────────────────────
  const surfaceBg   = isDark ? '#1a1d27' : '#ffffff';
  const surfaceAlt  = isDark ? '#232733' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : BORDER_DEFAULT;
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : DEEP_BLUE;
  const textSecond  = isDark ? 'rgba(255,255,255,0.55)' : TEXT_SECONDARY;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PPPageLayout
      title="AI Conversation History"
      subtitle="Browse, search, and resume your past Ask AI conversations"
      animate
      actions={
        <Button
          leftSection={<IconSparkles size={15} />}
          onClick={() => navigate('/nlp')}
          variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
          size="sm"
        >
          New Conversation
        </Button>
      }
    >
      <Container size="lg">
        <Stack gap="xl">

          {/* ── KPI row ──────────────────────────────────────────────────── */}
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
            {[
              { label: 'Conversations', value: totalConvs, icon: IconMessages,      color: AQUA },
              { label: 'Pinned',        value: totalPinned, icon: IconPinFilled,    color: '#fab005' },
              { label: 'Total Messages',value: totalMsgs,   icon: IconMessageCircle,color: '#4dabf7' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Paper
                key={label}
                p="lg"
                radius="md"
                style={{
                  background: surfaceBg,
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <ThemeIcon
                  size={44}
                  radius="md"
                  style={{ background: `${color}18`, color, flexShrink: 0 }}
                >
                  <Icon size={20} />
                </ThemeIcon>
                <Box>
                  <Text style={{ fontSize: 26, fontWeight: 700, color, fontFamily: FONT_FAMILY, lineHeight: 1 }}>
                    {value}
                  </Text>
                  <Text size="xs" style={{ color: textSecond, fontFamily: FONT_FAMILY, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>
                    {label}
                  </Text>
                </Box>
              </Paper>
            ))}
          </SimpleGrid>

          {/* ── Search ───────────────────────────────────────────────────── */}
          <TextInput
            placeholder="Search conversations by title or topic…"
            leftSection={<IconSearch size={16} color={textSecond} />}
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            radius="md"
            size="md"
            styles={{
              input: {
                background: surfaceBg,
                border: `1px solid ${borderColor}`,
                color: textPrimary,
                fontSize: 14,
              },
            }}
          />

          {/* ── Loading ──────────────────────────────────────────────────── */}
          {isLoading && (
            <Stack gap="xs" py="sm">{[1,2,3,4,5].map(i => <Skeleton key={i} height={56} radius="sm" />)}</Stack>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {isError && (
            <Alert color="orange" icon={<IconAlertCircle size={16} />} radius="md">
              Could not load conversation history. Check your connection and refresh.
            </Alert>
          )}

          {/* ── Empty state (no conversations at all) ────────────────────── */}
          {!isLoading && !isError && totalConvs === 0 && (
            <Paper
              p="xl"
              radius="lg"
              ta="center"
              style={{ background: surfaceAlt, border: `1px dashed ${borderColor}`, padding: '56px 24px' }}
            >
              <Box
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `${AQUA}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <IconBrain size={36} color={AQUA} />
              </Box>
              <Text fw={700} size="xl" mb={8} style={{ fontFamily: FONT_FAMILY, color: textPrimary }}>
                No conversations yet
              </Text>
              <Text size="sm" mb="xl" style={{ color: textSecond, fontFamily: FONT_FAMILY, maxWidth: 360, margin: '0 auto 24px' }}>
                Ask a question on the Ask AI page and your conversation history will appear here. You can pin, search, and resume past conversations.
              </Text>
              <Button
                leftSection={<IconSparkles size={16} />}
                onClick={() => navigate('/nlp')}
                variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              >
                Start your first conversation
              </Button>
            </Paper>
          )}

          {/* ── No search results ────────────────────────────────────────── */}
          {!isLoading && !isError && totalConvs > 0 && filtered.length === 0 && (
            <Box ta="center" py="xl">
              <ThemeIcon size={48} radius="xl" style={{ background: `${AQUA}18`, color: AQUA, margin: '0 auto 12px' }}>
                <IconMoodEmpty size={24} />
              </ThemeIcon>
              <Text fw={600} size="md" style={{ color: textPrimary, fontFamily: FONT_FAMILY }}>
                No matches for "{search}"
              </Text>
              <Text size="sm" mt={4} style={{ color: textSecond, fontFamily: FONT_FAMILY }}>
                Try a different search term
              </Text>
            </Box>
          )}

          {/* ── Pinned section ───────────────────────────────────────────── */}
          {pinned.length > 0 && (
            <Stack gap="sm">
              <Group gap={8}>
                <IconPinFilled size={13} color="#fab005" />
                <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, color: '#fab005' }}>
                  Pinned · {pinned.length}
                </Text>
              </Group>
              {pinned.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  isExpanded={expandedId === conv.id}
                  expandedDetail={expandedId === conv.id ? expandedConv : undefined}
                  loadingMessages={expandedId === conv.id && loadingMessages}
                  onToggleExpand={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                  onTogglePin={() => handleTogglePin(conv)}
                  onDelete={() => setDeleteTarget(conv)}
                  isDark={isDark}
                  surfaceBg={surfaceBg}
                  borderColor={borderColor}
                  textPrimary={textPrimary}
                  textSecond={textSecond}
                />
              ))}
            </Stack>
          )}

          {/* ── Recent section ───────────────────────────────────────────── */}
          {unpinned.length > 0 && (
            <Stack gap="sm">
              {pinned.length > 0 && (
                <Group gap={8} mt={4}>
                  <IconHistory size={13} color={textSecond} />
                  <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, color: textSecond }}>
                    Recent · {unpinned.length}
                  </Text>
                </Group>
              )}
              {unpinned.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  isExpanded={expandedId === conv.id}
                  expandedDetail={expandedId === conv.id ? expandedConv : undefined}
                  loadingMessages={expandedId === conv.id && loadingMessages}
                  onToggleExpand={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                  onTogglePin={() => handleTogglePin(conv)}
                  onDelete={() => setDeleteTarget(conv)}
                  isDark={isDark}
                  surfaceBg={surfaceBg}
                  borderColor={borderColor}
                  textPrimary={textPrimary}
                  textSecond={textSecond}
                />
              ))}
            </Stack>
          )}

        </Stack>
      </Container>

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete conversation?"
        size="sm"
        centered
        styles={{ title: { fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 16 } }}
      >
        <Text size="sm" mb="xl" style={{ fontFamily: FONT_FAMILY, lineHeight: 1.6 }}>
          <strong>"{deleteTarget?.title}"</strong> will be permanently deleted. This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="red" loading={deleteConv.isPending} onClick={handleDelete}
            leftSection={<IconTrash size={14} />}>
            Delete
          </Button>
        </Group>
      </Modal>
    </PPPageLayout>
  );
}

// ── Conversation Card ─────────────────────────────────────────────────────────

import type { NlpConversationDetail } from '../api/nlp';

function ConversationCard({
  conv, isExpanded, expandedDetail, loadingMessages,
  onToggleExpand, onTogglePin, onDelete,
  isDark, surfaceBg, borderColor, textPrimary, textSecond,
}: {
  conv: NlpConversationSummary;
  isExpanded: boolean;
  expandedDetail?: NlpConversationDetail;
  loadingMessages: boolean;
  onToggleExpand: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  isDark: boolean;
  surfaceBg: string;
  borderColor: string;
  textPrimary: string;
  textSecond: string;
}) {
  const navigate = useNavigate();
  const { data: contextJson } = useNlpConversationContext(conv.id);

  const handleResume = () => {
    navigate('/nlp', {
      state: { initialQuery: conv.title, resumeContext: contextJson },
    });
  };

  const accentColor = conv.pinned ? '#fab005' : AQUA;

  return (
    <Paper
      radius="md"
      style={{
        background: surfaceBg,
        border: `1px solid ${isExpanded ? accentColor : borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isExpanded
          ? `0 4px 20px ${accentColor}18`
          : isDark ? 'none' : '0 1px 4px rgba(12,35,64,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <Group
        px="md"
        py="md"
        gap="md"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggleExpand}
        wrap="nowrap"
      >
        {/* Avatar icon */}
        <Box
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${accentColor}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconBrain size={20} color={accentColor} />
        </Box>

        {/* Title + meta */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            fw={600}
            lineClamp={1}
            style={{
              fontSize: 14,
              color: textPrimary,
              marginBottom: 4,
            }}
          >
            {conv.title || 'Untitled conversation'}
          </Text>
          <Group gap={10} wrap="nowrap">
            <Group gap={4} style={{ flexShrink: 0 }}>
              <IconClock size={11} color={textSecond} />
              <Text size="xs" style={{ color: textSecond, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
                <Tooltip label={absoluteTime(conv.lastMessageAt)} withArrow>
                  <span>{relativeTime(conv.lastMessageAt)}</span>
                </Tooltip>
              </Text>
            </Group>
            <Text size="xs" style={{ color: textSecond }}>·</Text>
            <Group gap={4} style={{ flexShrink: 0 }}>
              <IconMessageCircle size={11} color={textSecond} />
              <Text size="xs" style={{ color: textSecond, fontFamily: FONT_FAMILY }}>
                {conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}
              </Text>
            </Group>
            {conv.pinned && (
              <>
                <Text size="xs" style={{ color: textSecond }}>·</Text>
                <Badge
                  size="xs"
                  radius="sm"
                  style={{ background: '#fab00520', color: '#fab005', border: '1px solid #fab00540', fontFamily: FONT_FAMILY }}
                  leftSection={<IconPinFilled size={8} />}
                >
                  Pinned
                </Badge>
              </>
            )}
          </Group>
        </Box>

        {/* Actions */}
        <Group gap={4} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <Tooltip label={conv.pinned ? 'Unpin' : 'Pin conversation'} withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onTogglePin}
              style={{ color: conv.pinned ? '#fab005' : textSecond }}
              aria-label="Pin"
            >
              {conv.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Resume in Ask AI" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={handleResume}
              style={{ color: AQUA }}
              aria-label="Go forward"
            >
              <IconArrowRight size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete conversation" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onDelete}
              color="red"
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="subtle" size="sm" style={{ color: textSecond }}
      aria-label="Expand"
    >
            {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {/* ── Expanded message thread ──────────────────────────────────────── */}
      <Collapse in={isExpanded}>
        <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : BORDER_DEFAULT }} />
        <Box px="md" py="sm" style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(248,250,252,0.8)' }}>
          <Group justify="space-between" mb="sm">
            <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: '0.07em', color: textSecond, fontFamily: FONT_FAMILY }}>
              Conversation thread
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconSparkles size={12} />}
              onClick={e => { e.stopPropagation(); handleResume(); }}
              style={{ color: AQUA, background: `${AQUA}15` }}
            >
              Resume
            </Button>
          </Group>
          <ScrollArea.Autosize mah={340}>
            {loadingMessages ? (
              <Stack gap="xs" py="xs">{[1,2,3].map(i => <Skeleton key={i} height={40} radius="sm" />)}</Stack>
            ) : !expandedDetail || expandedDetail.messages.length === 0 ? (
              <Text size="sm" ta="center" py="md" style={{ color: textSecond, fontFamily: FONT_FAMILY }}>
                No messages in this conversation.
              </Text>
            ) : (
              <Stack gap="xs" pb="xs">
                {expandedDetail.messages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <Box
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: isUser ? 'row-reverse' : 'row',
                        gap: 10,
                        alignItems: 'flex-end',
                      }}
                    >
                      {/* Avatar */}
                      <Box
                        style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: isUser ? `${DEEP_BLUE}` : `${AQUA}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isUser
                          ? <IconUser size={14} color="rgba(255,255,255,0.9)" />
                          : <IconRobot size={14} color={AQUA} />
                        }
                      </Box>

                      {/* Bubble */}
                      <Box style={{ maxWidth: '76%' }}>
                        <Box
                          style={{
                            padding: '9px 14px',
                            borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: isUser
                              ? DEEP_BLUE
                              : isDark ? 'rgba(45,204,211,0.12)' : AQUA_TINTS[10],
                            border: isUser
                              ? 'none'
                              : `1px solid ${isDark ? 'rgba(45,204,211,0.2)' : AQUA_TINTS[30]}`,
                          }}
                        >
                          <Text
                            size="sm"
                            style={{
                              color: isUser ? 'rgba(255,255,255,0.95)' : textPrimary,
                              lineHeight: 1.55,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {msg.content}
                          </Text>
                        </Box>
                        {msg.createdAt && (
                          <Text
                            size="xs"
                            mt={3}
                            style={{
                              color: textSecond,
                              textAlign: isUser ? 'right' : 'left',
                              paddingLeft: isUser ? 0 : 4,
                              paddingRight: isUser ? 4 : 0,
                            }}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </Box>
      </Collapse>
    </Paper>
  );
}
