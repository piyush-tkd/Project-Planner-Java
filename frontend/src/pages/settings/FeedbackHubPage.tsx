import { useState } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Badge, Button,
  Table, ActionIcon, Tooltip, Tabs, Box, Loader, ScrollArea,
  Modal, Image, Textarea, Select, SimpleGrid, ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconMessageReport, IconBug, IconBulb, IconTrendingUp, IconDots,
  IconCheck, IconClock, IconPlayerPlay, IconX, IconTrash,
  IconPhoto, IconExternalLink,
} from '@tabler/icons-react';
import {
  useAllFeedback, useUpdateFeedback, useDeleteFeedback, UserFeedback,
} from '../../api/feedback';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  BUG:         { icon: <IconBug size={14} />,         color: 'red',    label: 'Bug' },
  SUGGESTION:  { icon: <IconBulb size={14} />,        color: 'blue',   label: 'Suggestion' },
  IMPROVEMENT: { icon: <IconTrendingUp size={14} />,  color: 'teal',   label: 'Improvement' },
  OTHER:       { icon: <IconDots size={14} />,        color: 'gray',   label: 'Other' },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  NEW:         { icon: <IconMessageReport size={14} />, color: 'blue',   label: 'New' },
  IN_PROGRESS: { icon: <IconPlayerPlay size={14} />,    color: 'orange', label: 'In Progress' },
  DONE:        { icon: <IconCheck size={14} />,         color: 'teal',   label: 'Done' },
  DISMISSED:   { icon: <IconX size={14} />,             color: 'gray',   label: 'Dismissed' },
};

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  LOW:      { color: 'gray' },
  MEDIUM:   { color: 'blue' },
  HIGH:     { color: 'orange' },
  CRITICAL: { color: 'red' },
};

export default function FeedbackHubPage() {
  const { data: feedbacks, isLoading } = useAllFeedback();
  const updateFeedback = useUpdateFeedback();
  const deleteFeedback = useDeleteFeedback();
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [detailModal, setDetailModal] = useState<UserFeedback | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');

  const openDetail = (fb: UserFeedback) => {
    setDetailModal(fb);
    setEditNotes(fb.adminNotes ?? '');
    setEditStatus(fb.status);
    setEditPriority(fb.priority);
  };

  const handleSave = () => {
    if (!detailModal) return;
    updateFeedback.mutate(
      { id: detailModal.id, data: { status: editStatus, priority: editPriority, adminNotes: editNotes } },
      {
        onSuccess: () => {
          notifications.show({ title: 'Updated', message: 'Feedback updated', color: 'teal', icon: <IconCheck size={16} /> });
          setDetailModal(null);
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteFeedback.mutate(id, {
      onSuccess: () => {
        notifications.show({ title: 'Deleted', message: 'Feedback removed', color: 'gray' });
        setDetailModal(null);
      },
    });
  };

  // Filter by tab
  const filtered = feedbacks?.filter(fb => {
    if (activeTab === 'all') return true;
    if (activeTab === 'new') return fb.status === 'NEW';
    if (activeTab === 'in-progress') return fb.status === 'IN_PROGRESS';
    if (activeTab === 'done') return fb.status === 'DONE' || fb.status === 'DISMISSED';
    return true;
  }) ?? [];

  // Summary counts
  const counts = {
    all: feedbacks?.length ?? 0,
    new: feedbacks?.filter(f => f.status === 'NEW').length ?? 0,
    inProgress: feedbacks?.filter(f => f.status === 'IN_PROGRESS').length ?? 0,
    done: feedbacks?.filter(f => f.status === 'DONE' || f.status === 'DISMISSED').length ?? 0,
    bugs: feedbacks?.filter(f => f.category === 'BUG').length ?? 0,
    suggestions: feedbacks?.filter(f => f.category === 'SUGGESTION').length ?? 0,
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Feedback Hub
          </Title>
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Tech debt, bugs, and improvement requests from users
          </Text>
        </div>
      </Group>

      {/* ── Summary Cards ── */}
      <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} mb="lg">
        <SummaryCard label="Total" value={counts.all} color={DEEP_BLUE} icon={<IconMessageReport size={18} />} />
        <SummaryCard label="New" value={counts.new} color="#1c7ed6" icon={<IconMessageReport size={18} />} />
        <SummaryCard label="In Progress" value={counts.inProgress} color="#e67700" icon={<IconPlayerPlay size={18} />} />
        <SummaryCard label="Resolved" value={counts.done} color="#2b8a3e" icon={<IconCheck size={18} />} />
        <SummaryCard label="Bugs" value={counts.bugs} color="#c92a2a" icon={<IconBug size={18} />} />
        <SummaryCard label="Suggestions" value={counts.suggestions} color={AQUA} icon={<IconBulb size={18} />} />
      </SimpleGrid>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="all" style={{ fontFamily: FONT_FAMILY }}>All ({counts.all})</Tabs.Tab>
          <Tabs.Tab value="new" leftSection={<IconMessageReport size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            New ({counts.new})
          </Tabs.Tab>
          <Tabs.Tab value="in-progress" leftSection={<IconPlayerPlay size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            In Progress ({counts.inProgress})
          </Tabs.Tab>
          <Tabs.Tab value="done" leftSection={<IconCheck size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            Resolved ({counts.done})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={activeTab ?? 'all'}>
          <Paper shadow="xs" radius="md" withBorder>
            <ScrollArea h={560}>
              {isLoading ? (
                <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
              ) : filtered.length === 0 ? (
                <Box p="xl" ta="center">
                  <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="sm">
                    <IconMessageReport size={24} />
                  </ThemeIcon>
                  <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>No feedback items found.</Text>
                </Box>
              ) : (
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Category</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Feedback</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Page</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Screenshot</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>By</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Priority</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Date</Table.Th>
                      <Table.Th style={{ fontFamily: FONT_FAMILY }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((fb) => {
                      const cat = CATEGORY_CONFIG[fb.category] ?? CATEGORY_CONFIG.OTHER;
                      const st = STATUS_CONFIG[fb.status] ?? STATUS_CONFIG.NEW;
                      const pri = PRIORITY_CONFIG[fb.priority] ?? PRIORITY_CONFIG.MEDIUM;
                      return (
                        <Table.Tr key={fb.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(fb)}>
                          <Table.Td>
                            <Badge size="xs" variant="light" color={cat.color} leftSection={cat.icon}>
                              {cat.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ maxWidth: 300 }}>
                            <Text size="sm" lineClamp={2} style={{ fontFamily: FONT_FAMILY }}>{fb.message}</Text>
                          </Table.Td>
                          <Table.Td>
                            {fb.pageUrl ? (
                              <Badge size="xs" variant="outline" color="gray">{fb.pageUrl}</Badge>
                            ) : '—'}
                          </Table.Td>
                          <Table.Td>
                            {fb.screenshot ? (
                              <IconPhoto size={16} color={AQUA} />
                            ) : (
                              <Text size="xs" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{fb.submittedBy ?? '—'}</Text></Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="filled" color={pri.color}>{fb.priority}</Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color={st.color} leftSection={st.icon}>
                              {st.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Delete">
                              <ActionIcon
                                size="xs" variant="subtle" color="red"
                                onClick={(e) => { e.stopPropagation(); handleDelete(fb.id); }}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
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

      {/* ── Detail / Edit Modal ── */}
      <Modal
        opened={detailModal !== null}
        onClose={() => setDetailModal(null)}
        title={
          <Group gap={8}>
            <IconMessageReport size={20} color={DEEP_BLUE} />
            <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Feedback Detail</Text>
          </Group>
        }
        size="lg"
        centered
      >
        {detailModal && (
          <Stack gap="md">
            <Group gap="sm">
              <Badge variant="light" color={CATEGORY_CONFIG[detailModal.category]?.color ?? 'gray'}>
                {CATEGORY_CONFIG[detailModal.category]?.label ?? detailModal.category}
              </Badge>
              <Badge variant="outline" color="gray" size="sm">
                {detailModal.pageUrl ?? 'Unknown page'}
              </Badge>
              <Text size="xs" c="dimmed">by {detailModal.submittedBy} on {new Date(detailModal.createdAt).toLocaleString()}</Text>
            </Group>

            <Paper withBorder p="sm" radius="md" style={{ backgroundColor: '#f8f9fa' }}>
              <Text size="sm" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'pre-wrap' }}>
                {detailModal.message}
              </Text>
            </Paper>

            {detailModal.screenshot && (
              <div>
                <Text size="sm" fw={500} mb={4} style={{ fontFamily: FONT_FAMILY }}>Screenshot</Text>
                <Image
                  src={detailModal.screenshot.startsWith('data:') ? detailModal.screenshot : `data:image/png;base64,${detailModal.screenshot}`}
                  alt="Feedback screenshot"
                  radius="md"
                  fit="contain"
                  mah={360}
                />
              </div>
            )}

            <Group grow>
              <Select
                label="Status"
                data={[
                  { value: 'NEW', label: 'New' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'DONE', label: 'Done' },
                  { value: 'DISMISSED', label: 'Dismissed' },
                ]}
                value={editStatus}
                onChange={(v) => setEditStatus(v ?? 'NEW')}
                styles={{ label: { fontFamily: FONT_FAMILY } }}
              />
              <Select
                label="Priority"
                data={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical' },
                ]}
                value={editPriority}
                onChange={(v) => setEditPriority(v ?? 'MEDIUM')}
                styles={{ label: { fontFamily: FONT_FAMILY } }}
              />
            </Group>

            <Textarea
              label="Admin Notes"
              placeholder="Add notes about resolution, workarounds, or next steps..."
              minRows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.currentTarget.value)}
              styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
            />

            <Group justify="flex-end">
              <Button
                variant="subtle" color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => handleDelete(detailModal.id)}
                style={{ fontFamily: FONT_FAMILY }}
              >
                Delete
              </Button>
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={handleSave}
                loading={updateFeedback.isPending}
                style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}

// ── Summary Card ──

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Paper shadow="xs" radius="md" p="md" withBorder>
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
}
