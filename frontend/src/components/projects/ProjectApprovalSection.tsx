/**
 * ProjectApprovalSection — embedded in ProjectDetailPage Approval tab.
 *
 * Shows the current pending approval (if any) and approval history.
 * Allows the PM to submit a new approval request or withdraw a pending one.
 */
import { useState } from 'react';
import {
  Stack, Group, Text, Button, Paper, Badge, Textarea,
  Modal, Alert, Timeline, ThemeIcon, Divider, Skeleton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck, IconX, IconTarget, IconClock, IconUser,
  IconHistory, IconPlus, IconAlertCircle,
} from '@tabler/icons-react';
import { FONT_FAMILY, AQUA } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  useProjectApprovals,
  useSubmitApproval,
  useWithdrawApproval,
  ProjectApproval,
} from '../../api/projectApprovals';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'yellow', APPROVED: 'teal', REJECTED: 'red', WITHDRAWN: 'gray',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <IconClock size={14} />,
  APPROVED: <IconCheck size={14} />,
  REJECTED: <IconX size={14} />,
  WITHDRAWN: <IconX size={14} />,
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectApprovalSection({ projectId }: { projectId: number }) {
  const isDark = useDarkMode();
  const { data: approvals = [], isLoading } = useProjectApprovals(projectId);
  const submitMutation   = useSubmitApproval(projectId);
  const withdrawMutation = useWithdrawApproval(projectId);

  const [submitOpen, setSubmitOpen]   = useState(false);
  const [requestNote, setRequestNote] = useState('');

  const pending = approvals.find(a => a.status === 'PENDING');
  const history = approvals.filter(a => a.status !== 'PENDING');

  const cardBg      = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef';

  async function handleSubmit() {
    try {
      await submitMutation.mutateAsync(requestNote);
      notifications.show({ title: 'Submitted', message: 'Approval request submitted.', color: 'teal', icon: <IconCheck size={16} /> });
      setSubmitOpen(false);
      setRequestNote('');
    } catch (err: any) {
      const msg = err?.response?.status === 409
        ? 'A pending approval already exists.'
        : 'Submit failed. Please try again.';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    }
  }

  async function handleWithdraw(id: number) {
    try {
      await withdrawMutation.mutateAsync(id);
      notifications.show({ title: 'Withdrawn', message: 'Approval request withdrawn.', color: 'blue' });
    } catch {
      notifications.show({ title: 'Error', message: 'Withdraw failed.', color: 'red' });
    }
  }

  if (isLoading) {
    return <Stack gap="sm">{[1,2].map(i => <Skeleton key={i} height={60} radius="md" />)}</Stack>;
  }

  return (
    <Stack gap="md">
      {/* Active pending approval */}
      {pending ? (
        <Paper withBorder radius="md" p="md" style={{ background: isDark ? 'rgba(252,196,25,0.08)' : '#fffbe6', borderColor: isDark ? 'rgba(252,196,25,0.3)' : '#ffe066' }}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Group gap="xs" mb={4}>
                <ThemeIcon size={22} radius="sm" variant="light" color="yellow">
                  <IconTarget size={13} />
                </ThemeIcon>
                <Badge color="yellow" variant="filled" size="sm">PENDING APPROVAL</Badge>
              </Group>
              <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                Submitted by <strong>{pending.requestedBy}</strong> · {relTime(pending.requestedAt)}
              </Text>
              {pending.requestNote && (
                <Text size="xs" c="dimmed" mt={4} style={{ fontStyle: 'italic' }}>"{pending.requestNote}"</Text>
              )}
            </div>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconX size={12} />}
              onClick={() => handleWithdraw(pending.id)}
              loading={withdrawMutation.isPending}
            >
              Withdraw
            </Button>
          </Group>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md" style={{ background: cardBg, borderColor }}>
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>No active approval request</Text>
              <Text size="xs" c="dimmed" mt={2}>Submit this project for stage-gate sign-off.</Text>
            </div>
            <Button
              size="sm"
              color="teal"
              leftSection={<IconPlus size={14} />}
              onClick={() => setSubmitOpen(true)}
            >
              Request Approval
            </Button>
          </Group>
        </Paper>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <Divider label="Approval history" labelPosition="left" />
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {history.map(a => (
              <Timeline.Item
                key={a.id}
                bullet={
                  <ThemeIcon size={22} radius="xl" color={STATUS_COLOR[a.status]} variant="filled">
                    {STATUS_ICON[a.status]}
                  </ThemeIcon>
                }
                title={
                  <Group gap="xs">
                    <Badge size="xs" color={STATUS_COLOR[a.status]} variant="light">{a.status}</Badge>
                    <Text size="xs" c="dimmed">{relTime(a.requestedAt)}</Text>
                  </Group>
                }
              >
                <Text size="xs" mt={4} style={{ fontFamily: FONT_FAMILY }}>
                  Requested by <strong>{a.requestedBy}</strong>
                  {a.reviewedBy && <> · Reviewed by <strong>{a.reviewedBy}</strong></>}
                </Text>
                {a.reviewComment && (
                  <Text size="xs" c="dimmed" mt={2} style={{ fontStyle: 'italic' }}>"{a.reviewComment}"</Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </>
      )}

      {/* Submit modal */}
      <Modal
        opened={submitOpen}
        onClose={() => { setSubmitOpen(false); setRequestNote(''); }}
        title="Request project approval"
        size="md"
      >
        <Stack gap="md">
          <Alert color="teal" variant="light" icon={<IconTarget size={16} />}>
            This will submit the project for review. Reviewers will see it in the approval queue.
          </Alert>
          <Textarea
            label="Note for reviewers (optional)"
            placeholder="Describe what you need approved and any context..."
            value={requestNote}
            onChange={e => setRequestNote(e.currentTarget.value)}
            minRows={3}
            autosize
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" onClick={() => { setSubmitOpen(false); setRequestNote(''); }}>
              Cancel
            </Button>
            <Button
              color="teal"
              leftSection={<IconCheck size={14} />}
              onClick={handleSubmit}
              loading={submitMutation.isPending}
            >
              Submit for approval
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
