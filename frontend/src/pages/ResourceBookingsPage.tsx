import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Badge,
  Select,
  MultiSelect,
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
  Skeleton,
  Alert,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
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
  IconAlertTriangle,
} from '@tabler/icons-react';
import { EmptyState } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';
import apiClient from '../api/client';
import { AQUA, COLOR_BLUE, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_GREEN_STRONG, COLOR_ORANGE_ALT, COLOR_VIOLET_ALT, COLOR_WARNING, DEEP_BLUE, SURFACE_AMBER, SURFACE_BLUE_LIGHT, SURFACE_ORANGE, SURFACE_VIOLET, TEXT_SUBTLE} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useInlineEdit } from '../hooks/useInlineEdit';
import {
  InlineTextCell,
  InlineNumberCell,
  InlineSelectCell,
  InlineDateCell,
} from '../components/common/InlineCell';

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
  { bg: SURFACE_BLUE_LIGHT, border: COLOR_BLUE, text: '#1d4ed8' },
  { bg: '#dcfce7', border: COLOR_GREEN, text: '#15803d' },
  { bg: SURFACE_AMBER, border: COLOR_WARNING, text: '#b45309' },
  { bg: SURFACE_VIOLET, border: COLOR_VIOLET_ALT, text: '#6d28d9' },
  { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  { bg: SURFACE_ORANGE, border: COLOR_ORANGE_ALT, text: '#c2410c' },
];

export default function ResourceBookingsPage() {
  // @ts-expect-error -- unused
  const isDark = useDarkMode();
  const queryClient = useQueryClient();
  const { startEdit, stopEdit, isEditing } = useInlineEdit();
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterPod, setFilterPod] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');
  const [modalOpen, setModalOpen] = useState(false);
  // Multi-resource form state — resourceIds is an array; one booking is created per resource on submit
  const [formResourceIds, setFormResourceIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Omit<CreateBookingPayload, 'resourceId'>>({
    projectId: '',
    projectLabel: '',
    startDate: '',
    endDate: '',
    allocationPct: 100,
    bookingType: 'PROJECT',
    notes: '',
  });

  // Fetch resources
  const { data: resources = [], isLoading: resourcesLoading, isError: resourcesError } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await apiClient.get('/resources/all');
      return res.data;
    },
  });

  // Fetch projects
  const { data: projects = [], isError: projectsError } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects/all');
      return res.data;
    },
  });

  // Fetch bookings — use stable ISO string keys so invalidateQueries prefix match works reliably
  const weeks = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeeks(base, 10);
  }, [weekOffset]);

  const fromStr = weeks[0]?.start.toISOString().split('T')[0] ?? '';
  const toStr   = weeks[weeks.length - 1]?.end.toISOString().split('T')[0] ?? '';

  const { data: bookings = [], isLoading: bookingsLoading, isError: bookingsError } = useQuery({
    queryKey: ['bookings', fromStr, toStr],
    queryFn: async () => {
      if (!weeks.length) return [];
      const res = await apiClient.get('/resource-bookings', {
        params: { from: fromStr, to: toStr },
      });
      return res.data;
    },
    enabled: !!fromStr && !!toStr,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      const res = await apiClient.post('/resource-bookings', payload);
      return res.data;
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to create booking',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: CreateBookingPayload }) => {
      const res = await apiClient.put(`/resource-bookings/${payload.id}`, payload.data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Booking updated successfully',
      });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update booking',
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
    setFormResourceIds([]);
    setFormData({
      projectId: '',
      projectLabel: '',
      startDate: '',
      endDate: '',
      allocationPct: 100,
      bookingType: 'PROJECT',
      notes: '',
    });
  };

  const handleSubmit = useCallback(async () => {
    if (formResourceIds.length === 0 || !formData.projectLabel || !formData.startDate || !formData.endDate) {
      notifications.show({
        color: 'yellow',
        title: 'Validation',
        message: 'At least one resource, a project label, start date, and end date are required',
      });
      return;
    }

    try {
      // Create one booking per selected resource (sequentially to avoid mutation state conflicts)
      for (const rid of formResourceIds) {
        await createMutation.mutateAsync({ ...formData, resourceId: rid });
      }
      // Invalidate after all bookings are saved so the timeline refetches fresh data
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: formResourceIds.length === 1
          ? 'Booking created successfully'
          : `${formResourceIds.length} bookings created successfully`,
      });
      resetForm();
      setModalOpen(false);
      // If the user has navigated away from the current week, reset so the new booking is visible
      setWeekOffset(0);
    } catch {
      // individual errors already shown by onError above
    }
  }, [formResourceIds, formData, createMutation, queryClient, resetForm]);

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
      <Stack gap="xs" p="md">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}</Stack>
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
    <PPPageLayout title="Resource Bookings" subtitle="Resource booking requests and approval workflows" animate>
      {(resourcesError || projectsError || bookingsError) && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" mb="md" mx="md" radius="md">
          Failed to load data. Please try again or refresh the page.
        </Alert>
      )}
      <Group justify="space-between" align="flex-start" mb="lg" p="md">
        <Box />
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
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="lg" p="md">
        {[
          { label: 'Total Resources', value: resources.length, color: DEEP_BLUE },
          {
            label: 'Fully Booked',
            value: resources.filter((r: Resource) => (utilization[String(r.id)] ?? 0) >= 90).length,
            color: COLOR_ERROR_STRONG,
          },
          {
            label: 'Under-Utilized',
            value: resources.filter((r: Resource) => (utilization[String(r.id)] ?? 0) < 50).length,
            color: COLOR_WARNING,
          },
          {
            label: 'Available Capacity',
            value: `${Math.round(
              resources.reduce((sum: number, r: Resource) => sum + (100 - (utilization[String(r.id)] ?? 0)), 0) /
                resources.length
            )}%`,
            color: COLOR_GREEN_STRONG,
          },
        ].map((stat) => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }}>
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
              aria-label="Previous"
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
              aria-label="Next"
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
            <ActionIcon.Group
      aria-label="List view"
    >
              <ActionIcon
                variant={viewMode === 'timeline' ? 'filled' : 'subtle'}
                color={viewMode === 'timeline' ? 'teal' : 'gray'}
                onClick={() => setViewMode('timeline')}
                aria-label="List view"
              >
                <IconList size={15} />
              </ActionIcon>
              <ActionIcon
                variant={viewMode === 'cards' ? 'filled' : 'subtle'}
                color={viewMode === 'cards' ? 'teal' : 'gray'}
                onClick={() => setViewMode('cards')}
                aria-label="Grid layout"
              >
                <IconLayoutGrid size={15} />
              </ActionIcon>
            </ActionIcon.Group>
          </Group>
        </Group>
      </Paper>

      {bookingsLoading ? (
        <Stack gap="xs" p="md">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}</Stack>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <Paper withBorder radius="md" style={{ overflow: 'hidden', margin: '0 16px' }}>
          <ScrollArea type="auto">
            <Box miw={200 + weeks.length * CELL_W}>
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
                <span style={{ color: COLOR_GREEN_STRONG }}>●</span> Available &nbsp;
                <span style={{ color: COLOR_WARNING }}>●</span> Partially Booked &nbsp;
                <span style={{ color: COLOR_ERROR_STRONG }}>●</span> Fully Booked
              </Text>
              <Text size="xs" c="dimmed">
                Showing {filteredResources.length} of {resources.length} resources across {weeks.length} weeks
              </Text>
            </Group>
          </Box>
        </Paper>
      ) : (
        /* Cards View */
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" p="md">
          {filteredResources.map((resource: Resource) => {
            const resourceBookings = bookings.filter((b: Booking) => String(b.resourceId) === String(resource.id));
            const util = Math.round(utilization[String(resource.id)] ?? 0);
            const utilColor = util >= 90 ? COLOR_ERROR_STRONG : util >= 70 ? COLOR_WARNING : COLOR_GREEN_STRONG;
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
                <Stack gap={6}>
                  {resourceBookings.slice(0, 3).map((b: Booking, i: number) => {
                    const col = BOOKING_COLORS[i % BOOKING_COLORS.length];
                    return (
                      <Box key={b.id} style={{ borderLeft: `3px solid ${col.border}`, paddingLeft: 12 }}>
                        <Group justify="space-between" mb="xs">
                          <Group gap={6} style={{ flex: 1 }}>
                            <InlineSelectCell
                              value={b.projectLabel}
                              options={projects.map((p: Project) => ({
                                value: p.name ?? p.label ?? String(p.id),
                                label: p.name ?? p.label ?? String(p.id),
                              }))}
                              onSave={async (newValue: string) => {
                                const found = projects.find((p: Project) => (p.name ?? p.label ?? String(p.id)) === newValue);
                                await updateMutation.mutateAsync({
                                  id: b.id,
                                  data: {
                                    resourceId: b.resourceId,
                                    projectId: found?.id ? String(found.id) : undefined,
                                    projectLabel: newValue,
                                    startDate: b.startDate,
                                    endDate: b.endDate,
                                    allocationPct: b.allocationPct,
                                    bookingType: b.bookingType,
                                    notes: b.notes,
                                  },
                                });
                              }}
                              isEditing={isEditing(b.id, 'projectLabel')}
                              onStartEdit={() => startEdit(b.id, 'projectLabel')}
                              onCancel={() => stopEdit()}
                              placeholder="Project…"
                            />
                          </Group>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(b.id)}
                            aria-label="Delete"
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                        <Group gap="xs" mb="xs">
                          <Text size="10px" c="dimmed" miw={50}>Start</Text>
                          <InlineDateCell
                            value={b.startDate}
                            onSave={async (newValue: string | null) => {
                              await updateMutation.mutateAsync({
                                id: b.id,
                                data: {
                                  resourceId: b.resourceId,
                                  projectId: b.projectId,
                                  projectLabel: b.projectLabel,
                                  startDate: newValue || b.startDate,
                                  endDate: b.endDate,
                                  allocationPct: b.allocationPct,
                                  bookingType: b.bookingType,
                                  notes: b.notes,
                                },
                              });
                            }}
                            isEditing={isEditing(b.id, 'startDate')}
                            onStartEdit={() => startEdit(b.id, 'startDate')}
                            onCancel={() => stopEdit()}
                          />
                        </Group>
                        <Group gap="xs" mb="xs">
                          <Text size="10px" c="dimmed" miw={50}>End</Text>
                          <InlineDateCell
                            value={b.endDate}
                            onSave={async (newValue: string | null) => {
                              await updateMutation.mutateAsync({
                                id: b.id,
                                data: {
                                  resourceId: b.resourceId,
                                  projectId: b.projectId,
                                  projectLabel: b.projectLabel,
                                  startDate: b.startDate,
                                  endDate: newValue || b.endDate,
                                  allocationPct: b.allocationPct,
                                  bookingType: b.bookingType,
                                  notes: b.notes,
                                },
                              });
                            }}
                            isEditing={isEditing(b.id, 'endDate')}
                            onStartEdit={() => startEdit(b.id, 'endDate')}
                            onCancel={() => stopEdit()}
                          />
                        </Group>
                        <Group gap="xs" mb="xs">
                          <Text size="10px" c="dimmed" miw={50}>FTE %</Text>
                          <InlineNumberCell
                            value={b.allocationPct}
                            min={1}
                            max={100}
                            suffix="%"
                            onSave={async (newValue: number) => {
                              await updateMutation.mutateAsync({
                                id: b.id,
                                data: {
                                  resourceId: b.resourceId,
                                  projectId: b.projectId,
                                  projectLabel: b.projectLabel,
                                  startDate: b.startDate,
                                  endDate: b.endDate,
                                  allocationPct: newValue,
                                  bookingType: b.bookingType,
                                  notes: b.notes,
                                },
                              });
                            }}
                            isEditing={isEditing(b.id, 'allocationPct')}
                            onStartEdit={() => startEdit(b.id, 'allocationPct')}
                            onCancel={() => stopEdit()}
                          />
                        </Group>
                        <Group gap="xs" mb="xs">
                          <Text size="10px" c="dimmed" miw={50}>Type</Text>
                          <InlineSelectCell
                            value={b.bookingType}
                            options={[
                              { value: 'PROJECT', label: 'Project' },
                              { value: 'TRAINING', label: 'Training' },
                              { value: 'LEAVE', label: 'Leave' },
                              { value: 'OTHER', label: 'Other' },
                            ]}
                            onSave={async (newValue: string) => {
                              await updateMutation.mutateAsync({
                                id: b.id,
                                data: {
                                  resourceId: b.resourceId,
                                  projectId: b.projectId,
                                  projectLabel: b.projectLabel,
                                  startDate: b.startDate,
                                  endDate: b.endDate,
                                  allocationPct: b.allocationPct,
                                  bookingType: newValue as any,
                                  notes: b.notes,
                                },
                              });
                            }}
                            isEditing={isEditing(b.id, 'bookingType')}
                            onStartEdit={() => startEdit(b.id, 'bookingType')}
                            onCancel={() => stopEdit()}
                          />
                        </Group>
                        <Group gap="xs">
                          <Text size="10px" c="dimmed" miw={50}>Notes</Text>
                          <InlineTextCell
                            value={b.notes || ''}
                            onSave={async (newValue: string) => {
                              await updateMutation.mutateAsync({
                                id: b.id,
                                data: {
                                  resourceId: b.resourceId,
                                  projectId: b.projectId,
                                  projectLabel: b.projectLabel,
                                  startDate: b.startDate,
                                  endDate: b.endDate,
                                  allocationPct: b.allocationPct,
                                  bookingType: b.bookingType,
                                  notes: newValue,
                                },
                              });
                            }}
                            isEditing={isEditing(b.id, 'notes')}
                            onStartEdit={() => startEdit(b.id, 'notes')}
                            onCancel={() => stopEdit()}
                            placeholder="Add notes…"
                            maxWidth={300}
                          />
                        </Group>
                      </Box>
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
          <MultiSelect
            label="Resource"
            description="Select one or more resources — a booking will be created for each"
            placeholder={formResourceIds.length === 0 ? 'Select resources…' : undefined}
            required
            searchable
            clearable
            data={resources.map((r: Resource) => ({
              value: String(r.id),
              label: `${r.name} (${r.role})`,
            }))}
            value={formResourceIds}
            onChange={setFormResourceIds}
            maxDropdownHeight={240}
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
          <DateInput
            label="Start Date"
            placeholder="Pick a start date"
            valueFormat="YYYY-MM-DD"
            required
            clearable
            value={formData.startDate ? new Date(formData.startDate + 'T00:00:00') : null}
            onChange={(d) => setFormData({ ...formData, startDate: d ? d.toISOString().slice(0, 10) : '' })}
          />
          <DateInput
            label="End Date"
            placeholder="Pick an end date"
            valueFormat="YYYY-MM-DD"
            required
            clearable
            minDate={formData.startDate ? new Date(formData.startDate + 'T00:00:00') : undefined}
            value={formData.endDate ? new Date(formData.endDate + 'T00:00:00') : null}
            onChange={(d) => setFormData({ ...formData, endDate: d ? d.toISOString().slice(0, 10) : '' })}
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
    </PPPageLayout>
  );
}
