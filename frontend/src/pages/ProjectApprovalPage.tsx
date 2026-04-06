/**
 * ProjectApprovalPage — reviewer queue for all pending project approvals.
 *
 * Shows the full pending queue with approve/reject actions.
 * Linked from the Workspace sidebar group.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Group, Button, Paper, Badge, Table,
  Textarea, Modal, ActionIcon, Tooltip, Alert, Skeleton,
  ThemeIcon, Tabs, SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck, IconX, IconAlertCircle, IconTarget,
  IconClock, IconHistory, IconUser,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import {
  usePendingApprovals,
  useReviewApproval,
  ProjectApproval,
} from '../api/projectApprovals';
import { useProjects } from '../api/projects';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'yellow', APPROVED: 'teal', REJECTED: 'red', WITHDRAWN: 'gray',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectApprovalPage() {
  const isDark = useDarkMode();
  const navigate = useNavigate();
  const { data: pending = [], isLoading, refetch } = usePendingApprovals();
  const { data: projects = [] } = useProjects();
  const reviewMutation = useReviewApproval();

  const [reviewTarget, setReviewTarget] = useState<ProjectApproval | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewComment, setReviewComment] = useState('');

  const projectName = (id: number) =>
    projects.find(p => p.id === id)?.name ?? `Project #${id}`;

  const cardBg = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef';

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
      refetch();
    } catch {
      notifications.show({ title: 'Error', message: 'Review action failed.', color: 'red' });
    }
  }

  return (
    <Stack gap="lg" className="page-enter">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Approval Queue
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Review and action pending project approval requests.
          </Text>
        </div>
        <Badge size="lg" color="yellow" variant="light">
          {pending.length} pending
        </Badge>
      </Group>

      {isLoading && <Stack gap="sm">{[1,2,3].map(i => <Skeleton key={i} height={80} radius="md" />)}</Stack>}

      {!isLoading && pending.length === 0 && (
        <Paper withBorder radius="lg" p="xl" ta="center"
          style={{ background: cardBg, borderColor }}>
          <ThemeIcon size={56} radius="xl" variant="light" color="teal" mx="auto" mb="md">
            <IconCheck size={28} />
          </ThemeIcon>
          <Title order={4} mb={4} style={{ fontFamily: FONT_FAMILY }}>All clear!</Title>
          <Text size="sm" c="dimmed" mb="lg">No pending approvals at this time.</Text>
          <Group justify="center" gap="sm" mb="md">
            <Button
              variant="filled"
              color="teal"
              size="sm"
              style={{ fontFamily: FONT_FAMILY }}
              onClick={() => navigate('/settings/org')}
            >
              Configure Approval Rules
            </Button>
            <Button
              variant="light"
              color="teal"
              size="sm"
              style={{ fontFamily: FONT_FAMILY }}
              component="a"
              href="https://docs.portfolioplanner.io/approvals"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn About Approvals
            </Button>
          </Group>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            💡 Tip: Set up auto-approve rules for changes under 5% budget variance
          </Text>
        </Paper>
      )}

      {!isLoading && pending.length > 0 && (
        <Stack gap="sm">
          {pending.map(a => (
            <Paper
              key={a.id}
              withBorder
              radius="md"
              p="md"
              style={{ background: cardBg, borderColor }}
            >
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon size={24} radius="sm" variant="light" color="yellow">
                      <IconTarget size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                      {projectName(a.projectId)}
                    </Text>
                    <Badge size="xs" color={STATUS_COLOR[a.status]} variant="light">
                      {a.status}
                    </Badge>
                  </Group>
                  <Group gap="lg">
                    <Group gap={4}>
                      <IconUser size={12} color="gray" />
                      <Text size="xs" c="dimmed">Requested by <strong>{a.requestedBy}</strong></Text>
                    </Group>
                    <Group gap={4}>
                      <IconClock size={12} color="gray" />
                      <Text size="xs" c="dimmed">{relTime(a.requestedAt)}</Text>
                    </Group>
                  </Group>
                  {a.requestNote && (
                    <Text size="xs" c="dimmed" mt={6} style={{ fontStyle: 'italic' }}>
                      "{a.requestNote}"
                    </Text>
                  )}
                </div>
                <Group gap="xs">
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
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Review modal */}
      <Modal
        opened={!!reviewTarget}
        onClose={() => { setReviewTarget(null); setReviewComment(''); }}
        title={
          <Group gap="xs">
            {reviewAction === 'APPROVE'
              ? <IconCheck size={18} color="#2DCCD3" />
              : <IconX size={18} color="#fa5252" />}
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
    </Stack>
  );
}
