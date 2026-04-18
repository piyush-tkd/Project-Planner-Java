import { useState, useMemo } from 'react';
import {
  Title, Text, Stack, Group, Select, Tabs, Tooltip, Button, Box,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChartBar, IconCloudDownload, IconRefresh,
  IconBug, IconTrendingUp, IconTarget, IconLayoutDashboard, IconSettings2,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../api/client';
import { useAvatarMap } from './state/hooks';
import { TabType, ProjectOption } from './state/types';
import { fmtDate } from './utils';
import { OverviewTab } from './components/OverviewTab';
import { QualityTab } from './components/QualityTab';
import { DeliveryTab } from './components/DeliveryTab';
import { ProductivityTab } from './components/ProductivityTab';
import { OperationsTab } from './components/OperationsTab';

export default function EngineeringAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const avatars = useAvatarMap();
  const qc = useQueryClient();

  // Backfill status — polled every 60s
  const { data: backfillStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['eng-analytics', 'backfill-status'],
    queryFn: () => apiClient.get('/engineering-analytics/backfill-status').then(r => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const backfill = useMutation({
    mutationFn: () => apiClient.post('/engineering-analytics/backfill-transitions?maxIssues=10000').then(r => r.data),
    onSuccess: (data) => {
      import('@mantine/notifications').then(({ notifications }) =>
        notifications.show({
          color: data.status === 'COMPLETE' ? 'teal' : 'blue',
          title: data.status === 'COMPLETE' ? 'Already up to date' : 'Backfill started',
          message: data.message,
          autoClose: 8000,
        })
      );
      setTimeout(() => refetchStatus(), 5000);
    },
  });

  const syncJira = useMutation({
    mutationFn: () => apiClient.post('/jira-sync/run').then(r => r.data),
    onSuccess: () => {
      // Invalidate all sprint/pod data so the dashboard reloads with fresh sprints
      qc.invalidateQueries({ queryKey: ['jira', 'pods'] });
      qc.invalidateQueries({ queryKey: ['jira'] });
      qc.invalidateQueries({ queryKey: ['eng-analytics'] });
      import('@mantine/notifications').then(({ notifications }) =>
        notifications.show({
          color: 'teal',
          title: 'Jira sync complete',
          message: 'Sprint and issue data refreshed from Jira.',
          autoClose: 6000,
        })
      );
    },
    onError: () => {
      import('@mantine/notifications').then(({ notifications }) =>
        notifications.show({
          color: 'red',
          title: 'Sync failed',
          message: 'Could not sync from Jira. Check your Jira configuration.',
          autoClose: 6000,
        })
      );
    },
  });

  const { data: projects, isLoading: projLoading } = useQuery({
    queryKey: ['eng-analytics', 'projects'],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/projects');
      return res.data?.projects || [];
    },
  });

  const projectOptions: ProjectOption[] = useMemo(() => {
    const opts = (projects || []).map((p: string) => ({ value: p, label: p }));
    return [{ value: '', label: 'All Projects' }, ...opts];
  }, [projects]);

  return (
    <Stack gap="lg" p="lg">
      <div>
        <Group gap="sm">
          <ThemeIcon size={40} radius="md" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }}>
            <IconChartBar size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">Engineering Analytics</Title>
            <Text size="sm" c="dimmed">Overview · Quality · Delivery · Team · Operations</Text>
          </div>
        </Group>
      </div>

      <Group gap="md" align="flex-end">
        <Select
          label="Project Filter"
          placeholder={projLoading ? 'Loading...' : 'All Projects'}
          searchable
          clearable
          data={projectOptions.filter(o => o.value !== '')}
          value={projectKey ?? null}
          onChange={(val) => setProjectKey(val)}
          w={200}
          disabled={projLoading}
          nothingFoundMessage={projLoading ? 'Loading projects…' : 'No projects found'}
        />
        <Select
          label="Lookback Period"
          data={[
            { value: '30', label: '30 days' },
            { value: '60', label: '60 days' },
            { value: '90', label: '90 days' },
            { value: '180', label: '180 days' },
          ]}
          value={String(days)}
          onChange={(val) => setDays(parseInt(val || '90', 10))}
          w={150}
        />
        <Tooltip label="Sync latest sprint and issue data from Jira. Run this first if the dashboard shows no data." withArrow multiline w={280}>
          <Button
            variant="light"
            color="teal"
            size="sm"
            loading={syncJira.isPending}
            onClick={() => syncJira.mutate()}
            leftSection={<IconRefresh size={14} />}
          >
            Sync Jira
          </Button>
        </Tooltip>
        <Tooltip label="Backfill transition history from Jira for all historical sprint issues. Required for Flow Efficiency, Queue Time, and other transition-based metrics. Runs in background (~5 min)." withArrow multiline w={320}>
          <Button
            variant="light"
            color="violet"
            size="sm"
            loading={backfill.isPending}
            onClick={() => backfill.mutate()}
            leftSection={<IconCloudDownload size={14} />}
          >
            Backfill History
          </Button>
        </Tooltip>

        {backfillStatus && (
          <Box style={{ fontSize: 11, lineHeight: 1.4 }}>
            <Text size="xs" c={backfillStatus.is_complete ? 'green' : 'orange'} fw={600}>
              {backfillStatus.is_complete ? '✓ Transitions synced' : `⚡ ${backfillStatus.coverage_pct}% synced`}
            </Text>
            <Text size="xs" c="dimmed">
              {backfillStatus.issues_with_transitions}/{backfillStatus.total_sprint_issues} issues
              {backfillStatus.last_synced_at && ` · Last: ${fmtDate(backfillStatus.last_synced_at)}`}
            </Text>
            {!backfillStatus.is_complete && backfillStatus.issues_pending > 0 && (
              <Text size="xs" c="orange">{backfillStatus.issues_pending} still pending</Text>
            )}
          </Box>
        )}
      </Group>

      <Tabs value={activeTab} onChange={(tab) => setActiveTab(tab as TabType)} variant="outline" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconLayoutDashboard size={14} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="quality" leftSection={<IconBug size={14} />}>Quality</Tabs.Tab>
          <Tabs.Tab value="delivery" leftSection={<IconTarget size={14} />}>Delivery</Tabs.Tab>
          <Tabs.Tab value="team" leftSection={<IconTrendingUp size={14} />}>Team</Tabs.Tab>
          <Tabs.Tab value="operations" leftSection={<IconSettings2 size={14} />}>Operations</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <OverviewTab projectKey={projectKey} days={days} />
        </Tabs.Panel>
        <Tabs.Panel value="quality" pt="lg">
          <QualityTab projectKey={projectKey} days={days} avatars={avatars} />
        </Tabs.Panel>
        <Tabs.Panel value="delivery" pt="lg">
          <DeliveryTab projectKey={projectKey} avatars={avatars} />
        </Tabs.Panel>
        <Tabs.Panel value="team" pt="lg">
          <ProductivityTab projectKey={projectKey} avatars={avatars} />
        </Tabs.Panel>
        <Tabs.Panel value="operations" pt="lg">
          <OperationsTab projectKey={projectKey} days={days} avatars={avatars} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
