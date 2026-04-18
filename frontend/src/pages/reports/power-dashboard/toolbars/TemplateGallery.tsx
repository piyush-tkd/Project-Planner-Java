import _React, { useState } from 'react';
import { Box, Text, Card, SimpleGrid, Group, Badge, Button, Stack, Loader } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../../api/client';
import { useTemplates } from '../state/hooks';

function TemplateGallery({ dark, onCreated }: { dark: boolean; onCreated: (id: number, name: string) => void }) {
  const { data: templates = [], isLoading } = useTemplates();
  const qc = useQueryClient();
  const [creating, setCreating] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: (templateId: number) =>
      apiClient.post(`/power-dashboard/templates/${templateId}/create`, { name: templates.find(t => t.id === templateId)?.name }),
    onSuccess: (res, _templateId) => {
      qc.invalidateQueries({ queryKey: ['power-dashboards'] });
      onCreated(res.data.id, res.data.name);
      notifications.show({ title: 'Dashboard created!', message: `${res.data.name} — ${res.data.widget_count} widgets ready`, color: 'teal' });
    },
    onSettled: () => setCreating(null),
  });

  if (isLoading) return <Stack align="center" py="xl"><Loader size="sm" /></Stack>;

  return (
    <Box>
      <Text size="xs" c="dimmed" mb={12}>Start from a pre-built template — all widgets are pre-configured and ready to use.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {templates.map(t => (
          <Card key={t.id} p="md" withBorder style={{
            cursor: 'pointer',
            backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
            border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
            <Stack gap={6}>
              <Group justify="space-between">
                <Group gap={8}>
                  <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                  <Text fw={700} size="sm">{t.name}</Text>
                </Group>
                <Badge size="xs" variant="light">{t.category}</Badge>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2}>{t.description}</Text>
              <Group justify="space-between" align="center" mt={4}>
                <Badge size="xs" variant="dot" color="teal">{t.widget_count} widgets</Badge>
                <Button size="xs" loading={creating === t.id}
                  onClick={() => { setCreating(t.id); create.mutate(t.id); }}>
                  Use Template
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}

export { TemplateGallery };
