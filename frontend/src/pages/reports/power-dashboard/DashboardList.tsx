import _React, { useState } from 'react';
import { Stack, Group, Button, Tabs, Card, SimpleGrid, Title, Text, Loader, ActionIcon, Badge, Modal, TextInput, Textarea, Box } from '@mantine/core';
import { IconPlus, IconTrash, IconLayoutGrid } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../api/client';
import { useDashboards } from './state/hooks';
import { Dashboard } from './state/types';
import { TemplateGallery } from './toolbars/TemplateGallery';
import { AQUA, DEEP_BLUE } from '../../../brandTokens';

function DashboardList({ dark, onOpen }: {
  dark: boolean; onOpen: (d: Dashboard) => void;
}) {
  const qc = useQueryClient();
  const { data: dashboards = [], isLoading } = useDashboards();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const createDashboard = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      apiClient.post('/power-dashboard/dashboards', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['power-dashboards'] });
      notifications.show({ title: 'Dashboard created', message: res.data.name, color: 'green' });
      setCreateOpen(false); setNewName(''); setNewDesc('');
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/power-dashboard/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['power-dashboards'] }),
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c={dark ? AQUA : DEEP_BLUE} fw={700}>Power Dashboard</Title>
          <Text size="sm" c="dimmed">
            Build any report — any field, any metric, any filter. No restrictions.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Dashboard
        </Button>
      </Group>

      <Tabs defaultValue="dashboards" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="dashboards">My Dashboards ({dashboards.length})</Tabs.Tab>
          <Tabs.Tab value="templates">📋 Templates</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates" pt="md">
          <TemplateGallery dark={dark} onCreated={(id, name) => {
            const d = { id, name, is_public: false } as Dashboard;
            onOpen(d);
          }} />
        </Tabs.Panel>
        <Tabs.Panel value="dashboards" pt="md">
          {isLoading ? (
            <Stack align="center" py="xl"><Loader /></Stack>
          ) : dashboards.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <IconLayoutGrid size={48} opacity={0.3} />
                <Text size="lg" fw={600} c="dimmed">No dashboards yet</Text>
                <Text size="sm" c="dimmed" ta="center" maw={400}>
                  Create your first Power Dashboard. Query across issues, worklogs, sprints, and transitions with any combination of filters.
                </Text>
                <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
                  Create your first dashboard
                </Button>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {dashboards.map(d => (
                <Card key={d.id} p={0} style={{
                  cursor: 'pointer',
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#fff',
                  border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
                  borderRadius: 12,
                  boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = dark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'; }}
                  onClick={() => onOpen(d)}>
                  <Box style={{ height: 4, background: `linear-gradient(90deg, ${AQUA}, ${DEEP_BLUE})`, borderRadius: '12px 12px 0 0' }} />
                  <Box p="md">
                    <Group justify="space-between" wrap="nowrap" mb={8}>
                      <Text fw={700} size="md" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, letterSpacing: '-0.02em' }}>
                        {d.name}
                      </Text>
                      <ActionIcon size="sm" variant="subtle" color="red"
                        onClick={e => { e.stopPropagation(); deleteDashboard.mutate(d.id); }}
      aria-label="Delete"
    >
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Group>
                    {d.description
                      ? <Text size="xs" c="dimmed" lineClamp={2} mb={10}>{d.description}</Text>
                      : <Text size="xs" c="dimmed" fs="italic" mb={10}>No description</Text>}
                    <Group gap={6} justify="space-between">
                      <Group gap={4}>
                        <Badge size="sm" variant="filled" color="blue" radius="sm">
                          {d.widget_count ?? 0} widgets
                        </Badge>
                        {d.created_by && <Badge size="sm" variant="light" color="gray" radius="sm">{d.created_by}</Badge>}
                      </Group>
                      {d.tags && (
                        <Group gap={4}>
                          {d.tags.split(',').slice(0, 2).map(t => (
                            <Badge key={t} size="xs" variant="dot" color="teal">{t.trim()}</Badge>
                          ))}
                        </Group>
                      )}
                    </Group>
                  </Box>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Dashboard" size="sm">
        <Stack gap="sm">
          <TextInput label="Dashboard name" placeholder="e.g. Q2 Velocity" value={newName}
            onChange={e => setNewName(e.target.value)} />
          <Textarea label="Description (optional)" placeholder="What does this dashboard track?" value={newDesc}
            onChange={e => setNewDesc(e.target.value)} rows={3} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createDashboard.isPending}
              onClick={() => createDashboard.mutate({ name: newName, description: newDesc })}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default DashboardList;
