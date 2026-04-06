import { useState, useMemo } from 'react';
import {
  Box,
  Title,
  Text,
  Group,
  Badge,
  Select,
  Button,
  Paper,
  Tooltip,
  Avatar,
  Stack,
  ActionIcon,
  SimpleGrid,
  Card,
  Divider,
  Progress,
  ScrollArea,
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconCalendarPlus,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconDownload,
  IconLayoutGrid,
  IconList,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { EmptyState } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

interface Resource {
  id: number | string;
  name: string;
  role: string;
  podAssignment?: { podName: string; capacityFte?: number } | null;
  pod?: string;
  avatar?: string;       // legacy field (unused by API)
  avatarUrl?: string | null; // Jira avatar URL from ResourceResponse
}

interface Project {
  id: number | string;
  name: string;
  label?: string;
}

interface Booking {
  id: string;
  resourceId: string;
  projectId?: string;
  projectLabel: string;
  startDate: string;
  endDate: string;
  allocationPct: number;
  bookingType: 'PROJECT' | 'TRAINING' | 'LEAVE' | 'OTHER';
  notes?: string;
}

interface CreateBookingPayload {
  resourceId: string;
  projectId?: string;
  projectLabel: string;
  startDate: string;
  endDate: string;
  allocationPct: number;
  bookingType: 'PROJECT' | 'TRAINING' | 'LEAVE' | 'OTHER';
  notes?: string;
}

// Generate weeks around a date
function getWeeks(centerDate: Date, count = 12) {
  const weeks: { label: string; start: Date; end: Date }[] = [];
  const start = new Date(centerDate);
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < count; i++) {
    const s = new Date(start);
    s.setDate(s.getDate() + i * 7);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    weeks.push({
      label: s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: s,
      end: e,
    });
  }
  return weeks;
}

const BOOKING_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  { bg: '#ffedd5', border: '#f97316', text: '#c2410c' },
];

export default function ResourceBookingsPage() {
  const isDark = useDarkMode();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterPod, setFilterPod] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateBookingPayload>({
    resourceId: '',
    projectId: '',
    projectLabel: '',
    startDate: '',
    endDate: '',
    allocationPct: 100,
    bookingType: 'PROJECT',
    notes: '',
  });

  // Fetch resources
  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await apiClient.get('/resources');
      return res.data;
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  // Fetch bookings
  const weeks = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeeks(base, 10);
  }, [weekOffset]);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', weeks[0]?.start, weeks[weeks.length - 1]?.end],
    queryFn: async () => {
      if (!weeks.length) return [];
      const from = weeks[0]?.start.toISOString().split('T')[0];
      const to = weeks[weeks.length - 1]?.end.toISOString().split('T')[0];
      const res = await apiClient.get('/resource-bookings', {
        params: { from, to },
      });
      return res.data;
    },
    enabled: weeks.length > 0,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      const res = await apiClient.post('/resource-bookings', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Booking created successfully',
      });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to create booking',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/resource-bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Booking deleted successfully',
      });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to delete booking',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      resourceId: '',
      projectId: '',
      projectLabel: '',
      startDate: '',
      endDate: '',
      allocationPct: 100,
      bookingType: 'PROJECT',
      notes: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.resourceId || !formData.projectLabel || !formData.startDate || !formData.endDate) {
      notifications.show({
        color: 'yellow',
        title: 'Validation',
        message: 'Resource, project, start date, and end date are required',
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteMutation.mutate(id);
    }
  };

  const pods = useMemo(() => {
    const podSet = new Set<string>();
    resources.forEach((r: Resource) => {
      const podName = r.podAssignment?.podName ?? r.pod;
      if (podName) podSet.add(podName);
    });
    return Array.from(podSet).sort();
  }, [resources]);

  const filteredResources = useMemo(() => {
    return filterPod
      ? resources.filter((r: Resource) => (r.podAssignment?.podName ?? r.pod) === filterPod)
      : resources;
  }, [filterPod, resources]);

  // Compute utilization per resource (keyed by String(resourceId) for consistent lookup)
  const utilization = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b: Booking) => {
      const key = String(b.resourceId);
      if (!map[key]) map[key] = 0;
      map[key] = Math.min(100, map[key] + b.allocationPct);
    });
    return map;
  }, [bookings]);

  const CELL_W = 88;
  const ROW_H = 52;

  if (resourcesLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  if (resources.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers size={40} stroke={1.5} />}
        title="No resources to book"
        description="Add team members in the Resources section first, then return here to schedule and track their bookings."
      />
    );
  }

  return (
    <Box className="page-enter" style={{ padding: '0 0 32px' }}>
      {/* Header */}
      <Group justify="space-between" align="flex-start" mb="lg" p="md">
        <Box>
          <Title order={1} style={{ color: DEEP_BLUE, fontWeight: 800 }}>
            Resource Bookings
          </Title>
          <Text c="dimmed" size="sm" mt={2}>
            Visual timeline of resource allocation across projects and weeks
          </Text>
        </Box>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconDownload size={15} />}
            size="sm"
            color="teal"
          >
            Export
          </Button>
          <Button
            leftSection={<IconCalendarPlus size={15} />}
            size="sm"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
          >
            New Booking
          </Button>
        </Group>
      </Group>

      {/* Summary cards */}
      <SimpleGrid cols={4} spacing="md" mb="lg" p="md">
        {[
          { label: 'Total Resources', value: resources.length, color: DEEP_BLUE },
          {
            label: 'Fully Booked',
            value: resources.filter((r: Resource) => (utilization[String(r.id)] ?? 0) >= 90).length,
            color: '#ef4444',
          },
          {
            label: 'Under-Utilized',
            value: resources.filter((r: Resource) => (utilization[String(r.id)] ?? 0) < 50).length,
            color: '#f59e0b',
          },
          {
            label: 'Available Capacity',
            value: `${Math.round(
              resources.reduce((sum: number, r: Resource) => sum + (100 - (utilization[String(r.id)] ?? 0)), 0) /
                resources.length
            )}%`,
            color: '#16a34a',
          },
        ].map((stat) => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: '#94a3b8' }}>
              {stat.label}
            </Text>
            <Text size="xl" fw={800} mt={4} style={{ color: stat.color, fontSize: 28 }}>
              {stat.value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      {/* Controls */}
      <Paper withBorder radius="md" p="md" mb="lg" mx="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ActionIcon
              variant="subtle"
              onClick={() => setWeekOffset((o) => o - 1)}
              color="dark"
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text fw={600} size="sm" style={{ minWidth: 140, textAlign: 'center', color: DEEP_BLUE }}>
              {weeks[0]?.label} – {weeks[weeks.length - 1]?.label}
            </Text>
            <ActionIcon
              variant="subtle"
              onClick={() => setWeekOffset((o) => o + 1)}
              color="dark"
            >
              <IconChevronRight size={16} />
            </ActionIcon>
            <Button variant="subtle" size="xs" onClick={() => setWeekOffset(0)} color="teal">
              Today
            </Button>
          </Group>

          <Group gap="sm">
            <Select
              placeholder="All PODs"
              data={pods}
              value={filterPod}
              onChange={setFilterPod}
              clearable
              size="sm"
              leftSection={<IconFilter size={14} />}
              style={{ width: 180 }}
            />
            <ActionIcon.Group>
              <ActionIcon
                variant={viewMode === 'timeline' ? 'filled' : 'subtle'}
                color={viewMode === 'timeline' ? 'teal' : 'gray'}
                onClick={() => setViewMode('timeline')}
              >
                <IconList size={15} />
              </ActionIcon>
              <ActionIcon
                variant={viewMode === 'cards' ? 'filled' : 'subtle'}
                color={viewMode === 'cards' ? 'teal' : 'gray'}
                onClick={() => setViewMode('cards')}
              >
                <IconLayoutGrid size={15} />
              </ActionIcon>
            </ActionIcon.Group>
          </Group>
        </Group>
      </Paper>

      {bookingsLoading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <Paper withBorder radius="md" style={{ overflow: 'hidden', margin: '0 16px' }}>
          <ScrollArea type="auto">
            <Box style={{ minWidth: 200 + weeks.length * CELL_W }}>
              {/* Header row */}
              <Box
                style={{
                  display: 'flex',
                  background: DEEP_BLUE,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
              >
                <Box style={{ width: 200, flexShrink: 0, padding: '10px 16px' }}>
                  <Text size="xs" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.8px' }}>
                    Resource
                  </Text>
                </Box>
                {weeks.map((week, i) => (
                  <Box
                    key={i}
                    style={{
                      width: CELL_W,
                      flexShrink: 0,
                      padding: '10px 8px',
                      textAlign: 'center',
                      borderLeft: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text size="xs" fw={600} style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {week.label}
                    </Text>
                  </Box>
                ))}
              </Box>

              {/* Resource rows */}
              {filteredResources.map((resource: Resource, ri: number) => {
                const resourceBookings = bookings.filter((b: Booking) => String(b.resourceId) === String(resource.id));
                const util = utilization[String(resource.id)] ?? 0;
                return (
                  <Box
                    key={resource.id}
                    style={{
                      display: 'flex',
                      height: ROW_H,
                      borderBottom: '1px solid var(--mantine-color-default-border)',
                      background: ri % 2 === 0 ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)',
                      alignItems: 'center',
                    }}
                  >
                    {/* Resource info */}
                    <Box
                      style={{
                        width: 200,
                        flexShrink: 0,
                        padding: '0 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRight: '1px solid var(--mantine-color-default-border)',
                        height: '100%',
                      }}
                    >
                      <Avatar
                        size={28}
                        radius="xl"
                        src={resource.avatarUrl ?? resource.avatar ?? null}
                        color="teal"
                        style={{ background: AQUA, color: DEEP_BLUE, fontSize: 10, fontWeight: 700, flexShrink: 0 }}
                      >
                        {resource.name?.charAt(0)}
                      </Avatar>
                      <Box style={{ overflow: 'hidden' }}>
                        <Text
                          size="xs"
                          fw={600}
                          style={{
                            color: DEEP_BLUE,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {resource.name}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {resource.role}
                        </Text>
                      </Box>
                    </Box>

                    {/* Week cells with booking bars */}
                    <Box style={{ display: 'flex', flex: 1, height: '100%', position: 'relative' }}>
                      {/* Grid lines */}
                      {weeks.map((_, wi) => (
                        <Box
                          key={wi}
                          style={{
                            width: CELL_W,
                            flexShrink: 0,
                            borderLeft: '1px solid #f0f0f0',
                            height: '100%',
                          }}
                        />
                      ))}

                      {/* Booking bars */}
                      {resourceBookings.map((booking: Booking, bi: number) => {
                        const startDate = new Date(booking.startDate);
                        const endDate = new Date(booking.endDate);

                        let startW = -1;
                        let endW = -1;
                        for (let i = 0; i < weeks.length; i++) {
                          if (startW === -1 && startDate <= weeks[i].end) startW = i;
                          if (endDate >= weeks[i].start) endW = i + 1;
                        }

                        if (startW === -1 || endW <= 0) return null;
                        startW = Math.max(0, startW);
                        endW = Math.min(weeks.length, endW);

                        const col = BOOKING_COLORS[bi % BOOKING_COLORS.length];
                        return (
                          <Tooltip key={bi} label={`${booking.projectLabel} — ${booking.allocationPct}%`} withArrow>
                            <Box
                              className="booking-bar"
                              style={{
                                position: 'absolute',
                                left: startW * CELL_W + 4,
                                width: (endW - startW) * CELL_W - 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: col.bg,
                                border: `1px solid ${col.border}`,
                                color: col.text,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {(endW - startW) * CELL_W > 60 ? booking.projectLabel : ''}
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </ScrollArea>

          {/* Legend */}
          <Box style={{ padding: '10px 16px', borderTop: '1px solid #e7e9ec', background: '#fafbfc' }}>
            <Group gap="xl">
              <Text size="xs" c="dimmed">
                <span style={{ color: '#16a34a' }}>●</span> Available &nbsp;
                <span style={{ color: '#f59e0b' }}>●</span> Partially Booked &nbsp;
                <span style={{ color: '#ef4444' }}>●</span> Fully Booked
              </Text>
              <Text size="xs" c="dimmed">
                Showing {filteredResources.length} of {resources.length} resources across {weeks.length} weeks
              </Text>
            </Group>
          </Box>
        </Paper>
      ) : (
        /* Cards View */
        <SimpleGrid cols={3} spacing="md" p="md">
          {filteredResources.map((resource: Resource) => {
            const resourceBookings = bookings.filter((b: Booking) => String(b.resourceId) === String(resource.id));
            const util = Math.round(utilization[String(resource.id)] ?? 0);
            const utilColor = util >= 90 ? '#ef4444' : util >= 70 ? '#f59e0b' : '#16a34a';
            return (
              <Card
                key={resource.id}
                className="hover-glow"
                withBorder
                radius="md"
                p="md"
                style={{ borderTop: `3px solid ${utilColor}` }}
              >
                <Group justify="space-between" mb="sm">
                  <Group gap="sm">
                    <Avatar
                      size={36}
                      radius="xl"
                      src={resource.avatarUrl ?? resource.avatar ?? null}
                      color="teal"
                      style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
                    >
                      {resource.name?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Text size="sm" fw={700} style={{ color: DEEP_BLUE }}>
                        {resource.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {resource.role} {(resource.podAssignment?.podName ?? resource.pod) ? `· ${resource.podAssignment?.podName ?? resource.pod}` : ''}
                      </Text>
                    </Box>
                  </Group>
                  <Badge
                    size="sm"
                    style={{ background: `${utilColor}18`, color: utilColor, border: `1px solid ${utilColor}44` }}
                  >
                    {util}%
                  </Badge>
                </Group>
                <Progress
                  value={util}
                  size="sm"
                  radius="xl"
                  color={util >= 90 ? 'red' : util >= 70 ? 'yellow' : 'teal'}
                  mb="sm"
                />
                <Divider mb="sm" />
                <Stack gap={4}>
                  {resourceBookings.slice(0, 3).map((b: Booking, i: number) => {
                    const col = BOOKING_COLORS[i % BOOKING_COLORS.length];
                    return (
                      <Group key={b.id} justify="space-between">
                        <Group gap={6}>
                          <Box
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: col.border,
                              flexShrink: 0,
                            }}
                          />
                          <Text size="xs" style={{ color: DEEP_BLUE }}>
                            {b.projectLabel}
                          </Text>
                        </Group>
                        <Group gap={4}>
                          <Text size="xs" fw={600} c="dimmed">
                            {b.allocationPct}%
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(b.id)}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    );
                  })}
                  {resourceBookings.length === 0 && (
                    <Text size="xs" c="dimmed" ta="center">
                      No current bookings
                    </Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Booking"
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Resource"
            placeholder="Select a resource"
            required
            searchable
            data={resources.map((r: Resource) => ({
              value: String(r.id),
              label: `${r.name} (${r.role})`,
            }))}
            value={formData.resourceId}
            onChange={(val) => setFormData({ ...formData, resourceId: val || '' })}
          />
          <Select
            label="Project"
            placeholder="Select from existing projects"
            searchable
            clearable
            data={projects.map((p: Project) => ({
              value: String(p.id),
              label: p.name ?? p.label ?? String(p.id),
            }))}
            value={formData.projectId}
            onChange={(val) => {
              const found = projects.find((p: Project) => String(p.id) === val);
              setFormData({ ...formData, projectId: val || '', projectLabel: found ? (found.name ?? found.label ?? '') : formData.projectLabel });
            }}
          />
          <TextInput
            label="Project Label"
            placeholder="Project name or label"
            required
            value={formData.projectLabel}
            onChange={(e) => setFormData({ ...formData, projectLabel: e.currentTarget.value })}
          />
          <TextInput
            label="Start Date"
            placeholder="yyyy-MM-dd"
            type="date"
            required
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.currentTarget.value })}
          />
          <TextInput
            label="End Date"
            placeholder="yyyy-MM-dd"
            type="date"
            required
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.currentTarget.value })}
          />
          <NumberInput
            label="Allocation %"
            placeholder="1-100"
            min={1}
            max={100}
            value={formData.allocationPct}
            onChange={(val) => setFormData({ ...formData, allocationPct: Number(val) || 100 })}
          />
          <Select
            label="Booking Type"
            placeholder="Select type"
            data={[
              { value: 'PROJECT', label: 'Project' },
              { value: 'TRAINING', label: 'Training' },
              { value: 'LEAVE', label: 'Leave' },
              { value: 'OTHER', label: 'Other' },
            ]}
            value={formData.bookingType}
            onChange={(val) => setFormData({ ...formData, bookingType: (val as any) })}
          />
          <Textarea
            label="Notes"
            placeholder="Additional notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              style={{ background: AQUA, color: DEEP_BLUE }}
            >
              Create Booking
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
