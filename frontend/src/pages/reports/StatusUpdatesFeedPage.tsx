import { useState } from 'react';
import {
  Title, Text, Stack, Group, Badge, Card, Select, Skeleton, Center,
  Button, Modal, Textarea, ActionIcon, Tooltip, SimpleGrid, ThemeIcon,
} from '@mantine/core';
import {
  IconCircle, IconPlus, IconTrash, IconRefresh, IconAlertTriangle,
  IconCircleCheck, IconCircleX, IconDownload,
} from '@tabler/icons-react';
import { downloadCsv } from '../../utils/csv';
import { exportToPdf } from '../../utils/pdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

interface StatusUpdate {
  id: number; projectId: number; projectName: string;
  ragStatus: 'RED' | 'AMBER' | 'GREEN';
  summary: string; whatDone?: string; whatsNext?: string;
  blockers?: string; author?: string; createdAt: string;
}

interface Project { id: number; name: string; }

const RAG_COLORS: Record<string, string> = { RED: 'red', AMBER: 'orange', GREEN: 'teal' };
const RAG_ICONS: Record<string, React.ReactNode> = {
  RED:   <IconCircleX    size={14} />,
  AMBER: <IconAlertTriangle size={14} />,
  GREEN: <IconCircleCheck  size={14} />,
};

export default function StatusUpdatesFeedPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterRag,     setFilterRag]     = useState<string | null>(null);
  const [postModal,     setPostModal]     = useState(false);
  const [form, setForm] = useState({
    projectId: '', ragStatus: 'GREEN', summary: '',
    whatDone: '', whatsNext: '', blockers: '', author: '',
  });

  const { data: feed = [], isLoading, refetch } = useQuery<StatusUpdate[]>({
    queryKey: ['status-feed', filterProject, filterRag],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterProject) params.projectId = filterProject;
      if (filterRag)     params.ragStatus  = filterRag;
      const res = await apiClient.get('/reports/status-updates/feed', { params });
      return res.data;
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: async () => { const res = await apiClient.get('/projects/all'); return res.data; },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/projects/${form.projectId}/status-updates`, {
        ragStatus: form.ragStatus, summary: form.summary,
        whatDone: form.whatDone, whatsNext: form.whatsNext,
        blockers: form.blockers, author: form.author,
      });
    },
    onSuccess: () => {
      notifications.show({ message: 'Status update posted', color: 'teal' });
      qc.invalidateQueries({ queryKey: ['status-feed'] });
      setPostModal(false);
      setForm({ projectId: '', ragStatus: 'GREEN', summary: '', whatDone: '', whatsNext: '', blockers: '', author: '' });
    },
    onError: () => notifications.show({ message: 'Failed to post update', color: 'red' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ projectId, updateId }: { projectId: number; updateId: number }) => {
      await apiClient.delete(`/projects/${projectId}/status-updates/${updateId}`);
    },
    onSuccess: () => {
      notifications.show({ message: 'Update deleted', color: 'gray' });
      qc.invalidateQueries({ queryKey: ['status-feed'] });
    },
  });

  // KPI counts
  const redCount   = feed.filter(u => u.ragStatus === 'RED').length;
  const amberCount = feed.filter(u => u.ragStatus === 'AMBER').length;
  const greenCount = feed.filter(u => u.ragStatus === 'GREEN').length;

  return (
    <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Project Status Feed
          </Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Cross-project RAG status updates
          </Text>
        </div>
        <Group gap="xs">
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => refetch()}>
            <IconRefresh size={16} />
          </ActionIcon>
          <Button
            variant="light"
            color="red"
            leftSection={<IconDownload size={14} />}
            onClick={() => exportToPdf('Status Updates Feed')}
          >
            Export PDF
          </Button>
          <Button
            variant="default"
            leftSection={<IconDownload size={14} />}
            onClick={() =>
              downloadCsv('status-updates-feed', feed as unknown as Record<string, unknown>[], [
                { key: 'projectName',  header: 'Project' },
                { key: 'ragStatus',    header: 'RAG Status' },
                { key: 'summary',      header: 'Summary' },
                { key: 'whatDone',     header: 'What Done' },
                { key: 'whatsNext',    header: "What's Next" },
                { key: 'blockers',     header: 'Blockers' },
                { key: 'author',       header: 'Author' },
                { key: 'createdAt',    header: 'Date', format: (r) => new Date(r.createdAt as string).toLocaleDateString() },
              ])
            }
          >
            Export CSV
          </Button>
          <Button leftSection={<IconPlus size={15} />} onClick={() => setPostModal(true)}>
            Post Update
          </Button>
        </Group>
      </Group>

      {/* KPI tiles */}
      <SimpleGrid cols={{ base: 3 }} spacing="sm">
        <Card withBorder radius="md" p="sm" style={{ textAlign: 'center' }}>
          <ThemeIcon size={32} color="teal" variant="light" mx="auto" mb={4}>
            <IconCircleCheck size={18} />
          </ThemeIcon>
          <Text size="xl" fw={700} c="teal" style={{ fontFamily: FONT_FAMILY }}>{greenCount}</Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Green</Text>
        </Card>
        <Card withBorder radius="md" p="sm" style={{ textAlign: 'center' }}>
          <ThemeIcon size={32} color="orange" variant="light" mx="auto" mb={4}>
            <IconAlertTriangle size={18} />
          </ThemeIcon>
          <Text size="xl" fw={700} c="orange" style={{ fontFamily: FONT_FAMILY }}>{amberCount}</Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Amber</Text>
        </Card>
        <Card withBorder radius="md" p="sm" style={{ textAlign: 'center' }}>
          <ThemeIcon size={32} color="red" variant="light" mx="auto" mb={4}>
            <IconCircleX size={18} />
          </ThemeIcon>
          <Text size="xl" fw={700} c="red" style={{ fontFamily: FONT_FAMILY }}>{redCount}</Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Red</Text>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Group gap="sm">
        <Select
          placeholder="All projects"
          data={projects.map(p => ({ value: String(p.id), label: p.name }))}
          value={filterProject}
          onChange={setFilterProject}
          clearable searchable
          style={{ minWidth: 220 }}
          styles={{ input: { fontFamily: FONT_FAMILY } }}
        />
        <Select
          placeholder="All statuses"
          data={[
            { value: 'GREEN', label: '🟢 Green' },
            { value: 'AMBER', label: '🟡 Amber' },
            { value: 'RED',   label: '🔴 Red' },
          ]}
          value={filterRag}
          onChange={setFilterRag}
          clearable
          style={{ minWidth: 160 }}
          styles={{ input: { fontFamily: FONT_FAMILY } }}
        />
      </Group>

      {/* Feed */}
      {isLoading ? (
        <Stack gap="xs">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>
      ) : feed.length === 0 ? (
        <Center h={200}>
          <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            No status updates found. Post the first one!
          </Text>
        </Center>
      ) : (
        <Stack gap="sm">
          {feed.map(u => (
            <Card key={u.id} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="flex-start">
                  <Badge
                    color={RAG_COLORS[u.ragStatus]} variant="filled" size="sm"
                    leftSection={RAG_ICONS[u.ragStatus]}
                  >
                    {u.ragStatus}
                  </Badge>
                  <div>
                    <Group gap="xs" mb={2}>
                      <Text
                        size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, cursor: 'pointer', color: DEEP_BLUE }}
                        onClick={() => navigate(`/projects/${u.projectId}`)}
                      >
                        {u.projectName}
                      </Text>
                      {u.author && (
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>by {u.author}</Text>
                      )}
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </Text>
                    </Group>
                    <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{u.summary}</Text>
                    {u.whatDone && (
                      <Text size="xs" mt={4} style={{ fontFamily: FONT_FAMILY }}>
                        <strong>Done:</strong> {u.whatDone}
                      </Text>
                    )}
                    {u.whatsNext && (
                      <Text size="xs" mt={2} style={{ fontFamily: FONT_FAMILY }}>
                        <strong>Next:</strong> {u.whatsNext}
                      </Text>
                    )}
                    {u.blockers && (
                      <Text size="xs" mt={2} c="red" style={{ fontFamily: FONT_FAMILY }}>
                        <strong>Blockers:</strong> {u.blockers}
                      </Text>
                    )}
                  </div>
                </Group>
                <Tooltip label="Delete update">
                  <ActionIcon
                    variant="subtle" color="red" size="sm"
                    onClick={() => deleteMutation.mutate({ projectId: u.projectId, updateId: u.id })}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Post Update Modal */}
      <Modal opened={postModal} onClose={() => setPostModal(false)} title="Post Status Update" size="md">
        <Stack gap="sm">
          <Select
            label="Project"
            data={projects.map(p => ({ value: String(p.id), label: p.name }))}
            value={form.projectId || null}
            onChange={v => setForm(f => ({ ...f, projectId: v ?? '' }))}
            required searchable
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Select
            label="RAG Status"
            data={[
              { value: 'GREEN', label: '🟢 Green — on track' },
              { value: 'AMBER', label: '🟡 Amber — some concerns' },
              { value: 'RED',   label: '🔴 Red — needs attention' },
            ]}
            value={form.ragStatus}
            onChange={v => setForm(f => ({ ...f, ragStatus: v ?? 'GREEN' }))}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Textarea
            label="Summary *"
            placeholder="Overall status summary…"
            value={form.summary}
            onChange={e => setForm(f => ({ ...f, summary: e.currentTarget.value }))}
            required autosize minRows={2}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Textarea
            label="What was done"
            placeholder="Key accomplishments this period…"
            value={form.whatDone}
            onChange={e => setForm(f => ({ ...f, whatDone: e.currentTarget.value }))}
            autosize minRows={2}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Textarea
            label="What's next"
            placeholder="Planned for next period…"
            value={form.whatsNext}
            onChange={e => setForm(f => ({ ...f, whatsNext: e.currentTarget.value }))}
            autosize minRows={2}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Textarea
            label="Blockers"
            placeholder="Any blockers or risks…"
            value={form.blockers}
            onChange={e => setForm(f => ({ ...f, blockers: e.currentTarget.value }))}
            autosize minRows={1}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setPostModal(false)}>Cancel</Button>
            <Button
              onClick={() => postMutation.mutate()}
              loading={postMutation.isPending}
              disabled={!form.projectId || !form.summary}
            >
              Post Update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
