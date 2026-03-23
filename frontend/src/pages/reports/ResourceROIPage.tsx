import { useState, useMemo } from 'react';
import {
  Title, Text, Paper, Group, Stack, Badge, Table, NumberInput,
  ActionIcon, Tooltip, Loader, Center, Alert, Tabs, ThemeIcon,
  SimpleGrid, Card, Divider, Button, TextInput,
} from '@mantine/core';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  IconCoin, IconAlertCircle, IconPencil, IconCheck, IconX,
  IconSearch, IconInfoCircle, IconChartBar, IconUsers,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useResources, useCostRates, useUpdateActualRate } from '../../api/resources';
import { ResourceResponse } from '../../types/resource';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function roleBadgeColor(role: string) {
  const map: Record<string, string> = {
    ENGINEER: 'blue', SENIOR_ENGINEER: 'indigo', LEAD_ENGINEER: 'violet',
    PRINCIPAL: 'grape', MANAGER: 'teal', DIRECTOR: 'cyan', ARCHITECT: 'orange',
    QA: 'green', DEVOPS: 'lime', DATA_SCIENTIST: 'yellow', PRODUCT_MANAGER: 'pink',
  };
  return map[role] ?? 'gray';
}

// ── RateRow ─────────────────────────────────────────────────────────────────

interface RateRowProps {
  resource: ResourceResponse;
  defaultRate: number | null;
}

function RateRow({ resource, defaultRate }: RateRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<number | string>(resource.actualRate ?? '');
  const updateRate = useUpdateActualRate();

  const effectiveRate = resource.actualRate ?? defaultRate;

  async function save() {
    const value = draft === '' ? null : Number(draft);
    await updateRate.mutateAsync({ id: resource.id, actualRate: value });
    notifications.show({ title: 'Rate saved', message: `${resource.name} rate updated.`, color: 'teal' });
    setEditing(false);
  }

  function cancel() {
    setDraft(resource.actualRate ?? '');
    setEditing(false);
  }

  return (
    <Table.Tr>
      <Table.Td>
        <Text fw={500} size="sm">{resource.name}</Text>
        {resource.podAssignment && (
          <Text size="xs" c="dimmed">{resource.podAssignment.podName}</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge size="sm" color={roleBadgeColor(resource.role)} variant="light">
          {resource.role.replace(/_/g, ' ')}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{resource.location.replace(/_/g, ' ')}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {defaultRate != null ? fmt(defaultRate) + '/hr' : '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        {editing ? (
          <Group gap={4} wrap="nowrap">
            <NumberInput
              size="xs"
              value={draft}
              onChange={setDraft}
              min={0}
              max={9999}
              decimalScale={2}
              prefix="$"
              placeholder="0.00"
              style={{ width: 100 }}
              autoFocus
            />
            <ActionIcon size="sm" color="teal" onClick={save} loading={updateRate.isPending}>
              <IconCheck size={14} />
            </ActionIcon>
            <ActionIcon size="sm" color="gray" onClick={cancel}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={resource.actualRate != null ? 600 : 400} c={resource.actualRate != null ? AQUA : 'dimmed'}>
              {resource.actualRate != null ? fmt(resource.actualRate) + '/hr' : 'Using default'}
            </Text>
            <Tooltip label="Edit individual rate">
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setEditing(true)}>
                <IconPencil size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={600} c={DEEP_BLUE}>
          {effectiveRate != null ? fmt(effectiveRate) + '/hr' : '—'}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ResourceROIPage() {
  const [search, setSearch] = useState('');
  const { data: resources, isLoading: loadingRes, error: errRes } = useResources();
  const { data: costRates, isLoading: loadingRates }              = useCostRates();

  // Build a lookup: role+location → hourlyRate
  const defaultRateMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cr of costRates ?? []) {
      map[`${cr.role}|${cr.location}`] = cr.hourlyRate;
    }
    return map;
  }, [costRates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (resources ?? []).filter(r =>
      r.active && (
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (r.podAssignment?.podName ?? '').toLowerCase().includes(q)
      )
    );
  }, [resources, search]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const active = (resources ?? []).filter(r => r.active);
    const withRate   = active.filter(r => r.actualRate != null);
    const withDefault = active.filter(r => r.actualRate == null && defaultRateMap[`${r.role}|${r.location}`] != null);
    const noRate      = active.filter(r => r.actualRate == null && defaultRateMap[`${r.role}|${r.location}`] == null);

    // Estimated monthly cost: assume 160 hrs/month per FTE (capacity 1.0)
    const totalMonthly = active.reduce((sum, r) => {
      const fte  = r.podAssignment?.capacityFte ?? 1;
      const rate = r.actualRate ?? defaultRateMap[`${r.role}|${r.location}`] ?? 0;
      return sum + rate * 160 * fte;
    }, 0);

    return { total: active.length, withRate: withRate.length, withDefault: withDefault.length, noRate: noRate.length, totalMonthly };
  }, [resources, defaultRateMap]);

  if (loadingRes || loadingRates) return <LoadingSpinner variant="chart" message="Loading resource ROI..." />;
  if (errRes) return <Alert color="red" icon={<IconAlertCircle />}>Failed to load resources.</Alert>;

  return (
    <Stack gap="lg" className="page-enter stagger-children">
      <Group justify="space-between" wrap="nowrap" className="slide-in-left">
        <div>
          <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 700 }}>
            Resource ROI
          </Title>
          <Text size="sm" c="dimmed">
            Set individual hourly rates per resource. When Jira worklogs are synced, actual cost and ROI will be calculated automatically.
          </Text>
        </div>
      </Group>

      {/* KPI cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" className="stagger-grid">
        <Card withBorder radius="md" p="md">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" color="blue" variant="light">
              <IconUsers size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Active Resources</Text>
              <Text size="xl" fw={700} c={DEEP_BLUE}>{kpis.total}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" color="teal" variant="light">
              <IconCoin size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Individual Rates Set</Text>
              <Text size="xl" fw={700} c={AQUA}>{kpis.withRate}</Text>
              <Text size="xs" c="dimmed">of {kpis.total} resources</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" color="orange" variant="light">
              <IconAlertCircle size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>No Rate Configured</Text>
              <Text size="xl" fw={700} c={kpis.noRate > 0 ? 'orange' : 'gray'}>{kpis.noRate}</Text>
              <Text size="xs" c="dimmed">resources need a rate</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" color="violet" variant="light">
              <IconChartBar size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Est. Monthly Cost</Text>
              <Text size="xl" fw={700} c={DEEP_BLUE}>{fmt(kpis.totalMonthly)}</Text>
              <Text size="xs" c="dimmed">at 160 hrs/FTE/month</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      <Tabs defaultValue="rates" variant="outline">
        <Tabs.List>
          <Tabs.Tab value="rates" leftSection={<IconCoin size={15} />}>Rate Settings</Tabs.Tab>
          <Tabs.Tab value="info" leftSection={<IconInfoCircle size={15} />}>ROI Setup Guide</Tabs.Tab>
        </Tabs.List>

        {/* ── Rate Settings tab ─────────────────────────────── */}
        <Tabs.Panel value="rates" pt="md">
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600} size="sm" c={DEEP_BLUE}>Resource Hourly Rates</Text>
              <TextInput
                size="xs"
                placeholder="Search resources…"
                leftSection={<IconSearch size={13} />}
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>

            <Alert color="blue" variant="light" mb="md" icon={<IconInfoCircle size={15} />}>
              <Text size="xs">
                <strong>Individual rate</strong> overrides the role+location default for that specific person.
                Leave blank to use the default rate from the Cost Rates table.
              </Text>
            </Alert>

            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Resource</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th>Default Rate</Table.Th>
                  <Table.Th>Individual Rate</Table.Th>
                  <Table.Th>Effective Rate</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Center py="xl"><Text c="dimmed" size="sm">No resources found.</Text></Center>
                    </Table.Td>
                  </Table.Tr>
                ) : filtered.map(r => (
                  <RateRow
                    key={r.id}
                    resource={r}
                    defaultRate={defaultRateMap[`${r.role}|${r.location}`] ?? null}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* ── ROI Setup Guide tab ──────────────────────────── */}
        <Tabs.Panel value="info" pt="md">
          <Paper withBorder radius="md" p="xl">
            <Stack gap="lg">
              <div>
                <Title order={4} c={DEEP_BLUE} mb="xs">How Resource ROI Works</Title>
                <Text size="sm" c="dimmed">
                  Once individual rates are configured and Jira worklogs are synced, the system calculates:
                </Text>
              </div>

              <SimpleGrid cols={3} spacing="md">
                {[
                  {
                    step: '1', color: 'blue', title: 'Set Rates',
                    body: 'Set an individual hourly rate per resource above, or configure role+location defaults in the Reference Data settings.',
                  },
                  {
                    step: '2', color: 'teal', title: 'Sync Jira Hours',
                    body: 'Connect Jira and sync worklogs. Hours logged against stories, bugs, tasks, and incidents are pulled per resource.',
                  },
                  {
                    step: '3', color: 'violet', title: 'View ROI',
                    body: 'Actual cost = hours logged × hourly rate. Compare to estimated cost from capacity planning to see ROI per resource.',
                  },
                ].map(({ step, color, title, body }) => (
                  <Card key={step} withBorder radius="md" p="md">
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size={28} radius="xl" color={color} fw={700}>{step}</ThemeIcon>
                      <Text fw={600} size="sm">{title}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">{body}</Text>
                  </Card>
                ))}
              </SimpleGrid>

              <Divider />

              <div>
                <Text fw={600} size="sm" mb="xs">ROI Formula</Text>
                <Paper withBorder p="md" radius="md" style={{ background: '#F8FAFB', fontFamily: 'monospace' }}>
                  <Stack gap={6}>
                    <Text size="sm"><strong>Actual Cost</strong> = Hours Logged (Jira) × Effective Hourly Rate</Text>
                    <Text size="sm"><strong>Planned Cost</strong> = Planned Hours (Capacity Plan) × Effective Hourly Rate</Text>
                    <Text size="sm"><strong>Cost Variance</strong> = Actual Cost − Planned Cost</Text>
                    <Text size="sm"><strong>Utilization ROI</strong> = Actual Hours / (FTE × 160 hrs/month)</Text>
                  </Stack>
                </Paper>
              </div>

              <Alert color="teal" variant="light" icon={<IconInfoCircle size={15} />}>
                <Text size="sm">
                  <strong>Tip:</strong> Go to <strong>Integrations → Jira Actuals</strong> to sync worklog hours from Jira. Once synced, return here to see per-resource actual cost breakdowns.
                </Text>
              </Alert>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
