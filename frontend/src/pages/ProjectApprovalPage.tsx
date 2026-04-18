/**
 * ProjectApprovalPage — REVIEWER queue for pending project approvals.
 *
 * This page is for reviewers. Project owners submit approvals from the
 * Approval tab inside the Project Detail page.
 *
 * Tabs:
 *   • Pending  — table of PENDING requests with Approve / Reject actions
 *   • History  — all approvals (all statuses, newest first)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PPPageLayout } from '../components/pp';
import {
  Title, Text, Stack, Group, Button, Paper, Badge,
  Textarea, Modal, ActionIcon, Tooltip, Alert, Skeleton,
  ThemeIcon, SimpleGrid, Divider, Tabs,
  Table, ScrollArea, Anchor, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck, IconX, IconTarget, IconRefresh,
  IconClock, IconUser, IconInfoCircle, IconAlertCircle,
  IconListCheck, IconShield, IconBolt, IconArrowRight,
  IconHistory, IconExternalLink,
} from '@tabler/icons-react';
import { AQUA, COLOR_ERROR, FONT_FAMILY, GRAY_100} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import {
  usePendingApprovals,
  useAllApprovals,
  useReviewApproval,
  describeProposedChange,
  ProjectApproval,
} from '../api/projectApprovals';
import { useProjects } from '../api/projects';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'yellow', APPROVED: 'teal', REJECTED: 'red', WITHDRAWN: 'gray',
};

const SLA_DAYS: number = 2; // flag approvals pending longer than this

function pendingDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectApprovalPage() {
  const isDark = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: loadingPending, refetch: refetchPending } = usePendingApprovals();
  const { data: allApprovals = [], isLoading: loadingAll, refetch: refetchAll } = useAllApprovals();
  const { data: projects = [] } = useProjects();

  const reviewMutation = useReviewApproval();

  const [activeTab, setActiveTab] = useState<string | null>('pending');
  const [reviewTarget, setReviewTarget] = useState<ProjectApproval | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewComment, setReviewComment] = useState('');
  const [learnModalOpen, setLearnModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);

  // Inline update mutation for approval records
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: any }) => {
      const res = await apiClient.put(`/approvals/${id}`, { [field]: value });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-history'] });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update approval',
      });
    },
  });

  const projectName = (id: number) =>
    projects.find(p => p.id === id)?.name ?? `Project #${id}`;

  const cardBg = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  function handleRefresh() {
    refetchPending();
    refetchAll();
  }

  async function submitReview() {
    if (!reviewTarget) return;
    try {
      await reviewMutation.mutateAsync({
        id: reviewTarget.id,
        action: reviewAction,
        reviewComment: reviewComment || undefined,
      });
      notifications.show({
        title: reviewAction === 'APPROVE' ? 'Approved' : 'Rejected',
        message: `${projectName(reviewTarget.projectId)} has been ${reviewAction === 'APPROVE' ? 'approved' : 'rejected'}.`,
        color: reviewAction === 'APPROVE' ? 'teal' : 'red',
        icon: reviewAction === 'APPROVE' ? <IconCheck size={16} /> : <IconX size={16} />,
      });
      setReviewTarget(null);
      setReviewComment('');
      handleRefresh();
    } catch {
      notifications.show({ title: 'Error', message: 'Review action failed.', color: 'red' });
    }
  }

  const isLoading = loadingPending || loadingAll;

  return (
    <PPPageLayout
      title="Approval Queue"
      subtitle="Review and action pending project approval requests."
      animate
      actions={
        <Group gap="xs">
          <Badge size="lg" color="yellow" variant="light">
            {pending.length} pending
          </Badge>
          <Tooltip label="Refresh queue">
            <ActionIcon variant="light" color="blue" size="lg" onClick={handleRefresh}
      aria-label="Refresh"
    >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Button
            variant="light"
            color="gray"
            leftSection={<IconInfoCircle size={14} />}
            onClick={() => setLearnModalOpen(true)}
          >
            How approvals work
          </Button>
        </Group>
      }
    >

      {/* Submitter tip — always visible */}
      <Alert
        color="blue"
        variant="light"
        radius="md"
        icon={<IconTarget size={16} />}
        title="Want to submit a project for approval?"
      >
        <Text size="sm">
          Open the project you want approved, then click the{' '}
          <strong>Approval tab</strong> inside the project detail page.
          You'll find a "Request Approval" button there.{' '}
          <Anchor
            size="sm"
            fw={600}
            onClick={() => navigate('/projects')}
            style={{ cursor: 'pointer' }}
          >
            Go to Projects <IconExternalLink size={11} style={{ verticalAlign: 'middle' }} />
          </Anchor>
        </Text>
      </Alert>

      {isLoading && (
        <Stack gap="sm">
          {[1, 2, 3].map(i => <Skeleton key={i} height={48} radius="md" />)}
        </Stack>
      )}

      {!isLoading && (
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="pending" leftSection={<IconClock size={14} />}>
              Pending
              {pending.length > 0 && (
                <Badge size="xs" color="yellow" variant="filled" ml={6}>
                  {pending.length}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              History
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Pending tab ──────────────────────────────────────────────────── */}
          <Tabs.Panel value="pending">
            {pending.length === 0 ? (
              <Paper withBorder radius="lg" p="xl" ta="center"
                style={{ background: cardBg, borderColor }}>
                <ThemeIcon size={56} radius="xl" variant="light" color="teal" mx="auto" mb="md">
                  <IconCheck size={28} />
                </ThemeIcon>
                <Title order={4} mb={4} style={{ fontFamily: FONT_FAMILY }}>All clear!</Title>
                <Text size="sm" c="dimmed" mb="lg">No pending approvals at this time.</Text>
                <Button
                  variant="filled"
                  color="teal"
                  size="sm"
                  style={{ fontFamily: FONT_FAMILY }}
                  onClick={() => navigate('/settings/org?tab=approvals')}
                >
                  Configure Approval Rules
                </Button>
              </Paper>
            ) : (
              <>
                {pending.some(a => pendingDays(a.requestedAt) >= SLA_DAYS) && (
                  <Alert
                    color="orange"
                    variant="light"
                    radius="md"
                    icon={<IconAlertCircle size={16} />}
                    mb="sm"
                    title={`${pending.filter(a => pendingDays(a.requestedAt) >= SLA_DAYS).length} approval${pending.filter(a => pendingDays(a.requestedAt) >= SLA_DAYS).length !== 1 ? 's' : ''} overdue`}
                  >
                    <Text size="sm">
                      {pending.filter(a => pendingDays(a.requestedAt) >= SLA_DAYS).length === 1
                        ? 'One request has been waiting'
                        : 'Some requests have been waiting'}{' '}
                      more than {SLA_DAYS} day{SLA_DAYS !== 1 ? 's' : ''} for review. Please action them below.
                    </Text>
                  </Alert>
                )}
              <Paper withBorder radius="md" style={{ background: cardBg, borderColor, overflow: 'hidden' }}>
                <ScrollArea>
                  <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={640}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Project</Table.Th>
                        <Table.Th>What's changing</Table.Th>
                        <Table.Th>Requested By</Table.Th>
                        <Table.Th>Submitted</Table.Th>
                        <Table.Th>Note</Table.Th>
                        <Table.Th ta="right">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pending.map(a => (
                        <Table.Tr key={a.id}>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <ThemeIcon size={22} radius="sm" variant="light" color="yellow">
                                <IconTarget size={13} />
                              </ThemeIcon>
                              <Anchor
                                size="sm"
                                fw={600}
                                style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                                onClick={() => navigate(`/projects/${a.projectId}`)}
                              >
                                {projectName(a.projectId)}
                              </Anchor>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            {describeProposedChange(a.proposedChange) ? (
                              <Badge size="sm" color="blue" variant="light">
                                {describeProposedChange(a.proposedChange)}
                              </Badge>
                            ) : (
                              <Text size="xs" c="dimmed">Manual request</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              <IconUser size={13} color="gray" />
                              <Text size="sm">{a.requestedBy === 'system' ? 'Auto-triggered' : a.requestedBy}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              <IconClock size={13} color="gray" />
                              <Text size="sm" c="dimmed">{relTime(a.requestedAt)}</Text>
                              {pendingDays(a.requestedAt) >= SLA_DAYS && (
                                <Badge size="xs" color="orange" variant="filled">
                                  {pendingDays(a.requestedAt)}d overdue
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            {a.requestNote && a.requestedBy !== 'system' ? (
                              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }} lineClamp={2}>
                                "{a.requestNote}"
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                              <Button
                                size="xs"
                                color="red"
                                variant="light"
                                leftSection={<IconX size={13} />}
                                onClick={() => { setReviewTarget(a); setReviewAction('REJECT'); }}
                              >
                                Reject
                              </Button>
                              <Button
                                size="xs"
                                color="teal"
                                leftSection={<IconCheck size={13} />}
                                onClick={() => { setReviewTarget(a); setReviewAction('APPROVE'); }}
                              >
                                Approve
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
              </>
            )}
          </Tabs.Panel>

          {/* ── History tab ──────────────────────────────────────────────────── */}
          <Tabs.Panel value="history">
            {allApprovals.length === 0 ? (
              <Paper withBorder radius="lg" p="xl" ta="center"
                style={{ background: cardBg, borderColor }}>
                <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="sm">
                  <IconHistory size={22} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">No approval history yet.</Text>
              </Paper>
            ) : (
              <Paper withBorder radius="md" style={{ background: cardBg, borderColor, overflow: 'hidden' }}>
                <ScrollArea>
                  <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={700}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Project</Table.Th>
                        <Table.Th>What changed</Table.Th>
                        <Table.Th>Decision</Table.Th>
                        <Table.Th>Requested By</Table.Th>
                        <Table.Th>Submitted</Table.Th>
                        <Table.Th>Reviewed By</Table.Th>
                        <Table.Th>Comment</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {allApprovals.map(a => (
                        <Table.Tr key={a.id}>
                          <Table.Td>
                            <Anchor
                              size="sm"
                              fw={600}
                              style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                              onClick={() => navigate(`/projects/${a.projectId}`)}
                            >
                              {projectName(a.projectId)}
                            </Anchor>
                          </Table.Td>
                          <Table.Td>
                            {describeProposedChange(a.proposedChange) ? (
                              <Badge size="xs" color="blue" variant="light">
                                {describeProposedChange(a.proposedChange)}
                              </Badge>
                            ) : (
                              <Text size="xs" c="dimmed">Manual</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <Badge size="sm" color={STATUS_COLOR[a.status]} variant="light">
                                {a.status}
                              </Badge>
                              {a.reviewedAt && (
                                <Text size="xs" c="dimmed">{relTime(a.reviewedAt)}</Text>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{a.requestedBy === 'system' ? 'Auto-triggered' : a.requestedBy}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">{relTime(a.requestedAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{a.reviewedBy ?? '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            {editingCell?.id === a.id && editingCell?.field === 'reviewComment' ? (
                              <TextInput
                                autoFocus
                                defaultValue={a.reviewComment || ''}
                                size="xs"
                                placeholder="Add comment..."
                                onBlur={(e) => {
                                  inlineUpdateMutation.mutate({ id: a.id, field: 'reviewComment', value: e.currentTarget.value });
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingCell(null);
                                  if (e.key === 'Enter') {
                                    inlineUpdateMutation.mutate({ id: a.id, field: 'reviewComment', value: e.currentTarget.value });
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            ) : (
                              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', cursor: 'text' }} lineClamp={2}
                                onClick={() => setEditingCell({ id: a.id, field: 'reviewComment' })}>
                                {a.reviewComment ? `"${a.reviewComment}"` : '—'}
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            )}
          </Tabs.Panel>
        </Tabs>
      )}

      {/* ── Review modal ──────────────────────────────────────────────────── */}
      <Modal
        opened={!!reviewTarget}
        onClose={() => { setReviewTarget(null); setReviewComment(''); }}
        title={
          <Group gap="xs">
            {reviewAction === 'APPROVE'
              ? <IconCheck size={18} color={AQUA} />
              : <IconX size={18} color={COLOR_ERROR} />}
            <Text fw={600}>{reviewAction === 'APPROVE' ? 'Approve' : 'Reject'} approval request</Text>
          </Group>
        }
      >
        {reviewTarget && (
          <Stack gap="md">
            <Alert color={reviewAction === 'APPROVE' ? 'teal' : 'red'} variant="light" radius="sm">
              <Text size="sm">
                You are about to <strong>{reviewAction.toLowerCase()}</strong> the approval
                request for <strong>{projectName(reviewTarget.projectId)}</strong>.
              </Text>
            </Alert>
            <Textarea
              label="Comment (optional)"
              placeholder="Add a note for the requester..."
              value={reviewComment}
              onChange={e => setReviewComment(e.currentTarget.value)}
              minRows={3}
              autosize
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" color="gray" onClick={() => { setReviewTarget(null); setReviewComment(''); }}>
                Cancel
              </Button>
              <Button
                color={reviewAction === 'APPROVE' ? 'teal' : 'red'}
                leftSection={reviewAction === 'APPROVE' ? <IconCheck size={14} /> : <IconX size={14} />}
                onClick={submitReview}
                loading={reviewMutation.isPending}
              >
                Confirm {reviewAction === 'APPROVE' ? 'Approval' : 'Rejection'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ── How approvals work modal ──────────────────────────────────────── */}
      <Modal
        opened={learnModalOpen}
        onClose={() => setLearnModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="teal" variant="light">
              <IconListCheck size={16} />
            </ThemeIcon>
            <Text fw={700} size="md" style={{ fontFamily: FONT_FAMILY }}>
              How Approvals Work
            </Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The approval workflow gates key project changes behind a human review step.
          </Text>

          <Divider label="Workflow" labelPosition="left" />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {[
              { icon: <IconBolt size={18} />, color: 'blue', step: '1. Submit', detail: 'A project owner opens the project → Approval tab → clicks "Request Approval" with an optional note.' },
              { icon: <IconUser size={18} />, color: 'orange', step: '2. Review', detail: 'Reviewers see the request here in this queue. They click Approve or Reject with an optional comment.' },
              { icon: <IconShield size={18} />, color: 'teal', step: '3. Decision', detail: 'The decision is recorded with reviewer name and timestamp. The project owner can see the outcome in the Approval tab.' },
            ].map(({ icon, color, step, detail }) => (
              <Paper key={step} withBorder radius="md" p="sm">
                <ThemeIcon size={32} radius="md" color={color} variant="light" mb={8}>
                  {icon}
                </ThemeIcon>
                <Text fw={600} size="sm" mb={4} style={{ fontFamily: FONT_FAMILY }}>{step}</Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{detail}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          <Alert color="teal" variant="light" icon={<IconInfoCircle size={14} />}>
            Configure which changes require approval and auto-approve thresholds in{' '}
            <Anchor fw={600} onClick={() => { setLearnModalOpen(false); navigate('/settings/org?tab=approvals'); }} style={{ cursor: 'pointer' }}>
              Settings → Approvals
            </Anchor>.
          </Alert>

          <Group justify="flex-end">
            <Button
              variant="light" color="teal"
              rightSection={<IconArrowRight size={13} />}
              onClick={() => { setLearnModalOpen(false); navigate('/settings/org?tab=approvals'); }}
            >
              Configure Approval Rules
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setLearnModalOpen(false)}>Close</Button>
          </Group>
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
