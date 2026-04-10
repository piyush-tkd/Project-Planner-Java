import { useState, useMemo } from 'react';
import {
  Title, Text, Group, Button, Badge, Table, ActionIcon, Tooltip,
  Stack, Paper, SimpleGrid, Select, Modal, TextInput, SegmentedControl,
  ThemeIcon, Box,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent, IconPlus, IconTrash, IconEdit, IconFlag,
  IconMapPin, IconCheck, IconX,
} from '@tabler/icons-react';
import { useHolidays, useSaveHoliday, useUpdateHoliday, useDeleteHoliday, HolidayResponse } from '../../api/holidays';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { InlineTextCell, InlineDateCell, InlineSelectCell } from '../../components/common/InlineCell';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const LOCATION_COLOR: Record<string, string> = {
  US:    'blue',
  INDIA: 'orange',
  ALL:   'violet',
};

const LOCATION_LABEL: Record<string, string> = {
  US:    '🇺🇸 US',
  INDIA: '🇮🇳 India',
  ALL:   '🌐 All',
};

const DOW_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

interface FormState {
  id: number | null;
  name: string;
  holidayDate: Date | null;
  location: string;
}

const EMPTY_FORM: FormState = { id: null, name: '', holidayDate: null, location: 'US' };

export default function HolidayCalendarPage({ embedded = false }: { embedded?: boolean } = {}) {
  const isDark = useDarkMode();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [locFilter, setLocFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: holidays = [], isLoading, error, refetch } = useHolidays(year);
  const saveMut    = useSaveHoliday();
  const updateMut  = useUpdateHoliday();
  const deleteMut  = useDeleteHoliday();
  const { editingCell, startEdit, stopEdit, isEditing } = useInlineEdit();

  // Group by location → month
  const grouped = useMemo(() => {
    const visible = locFilter === 'all'
      ? holidays
      : holidays.filter(h => h.location === locFilter.toUpperCase() || h.location === 'ALL');
    const byMonth: Record<number, HolidayResponse[]> = {};
    for (const h of visible) {
      const m = new Date(h.holidayDate + 'T00:00:00').getMonth() + 1;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(h);
    }
    return byMonth;
  }, [holidays, locFilter]);

  const counts = useMemo(() => ({
    US:    holidays.filter(h => h.location === 'US').length,
    INDIA: holidays.filter(h => h.location === 'INDIA').length,
    ALL:   holidays.filter(h => h.location === 'ALL').length,
  }), [holidays]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(h: HolidayResponse) {
    setForm({
      id: h.id,
      name: h.name,
      holidayDate: new Date(h.holidayDate + 'T00:00:00'),
      location: h.location,
    });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.holidayDate) {
      notifications.show({ message: 'Name and date are required', color: 'red' });
      return;
    }
    const iso = form.holidayDate.toISOString().split('T')[0];
    const payload = { name: form.name.trim(), holidayDate: iso, location: form.location };

    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload }, {
        onSuccess: () => {
          notifications.show({ message: 'Holiday updated', color: 'green' });
          setModalOpen(false);
        },
        onError: (e: any) => notifications.show({ message: e?.response?.data?.message ?? 'Failed to update', color: 'red' }),
      });
    } else {
      saveMut.mutate(payload, {
        onSuccess: () => {
          notifications.show({ message: 'Holiday added', color: 'green' });
          setModalOpen(false);
        },
        onError: (e: any) => notifications.show({ message: e?.response?.data?.message ?? 'Failed to add', color: 'red' }),
      });
    }
  }

  function handleDelete(id: number) {
    deleteMut.mutate(id, {
      onSuccess: () => notifications.show({ message: 'Holiday removed', color: 'orange' }),
    });
  }

  async function handleInlineEditName(id: number, newName: string) {
    const holiday = holidays.find(h => h.id === id);
    if (!holiday) return;

    const iso = holiday.holidayDate;
    await new Promise<void>((resolve, reject) => {
      updateMut.mutate(
        { id, name: newName.trim(), holidayDate: iso, location: holiday.location },
        {
          onSuccess: () => {
            notifications.show({ message: 'Holiday name updated', color: 'green' });
            stopEdit();
            resolve();
          },
          onError: (e: any) => {
            notifications.show({ message: e?.response?.data?.message ?? 'Failed to update', color: 'red' });
            reject(e);
          },
        }
      );
    });
  }

  async function handleInlineEditDate(id: number, newDate: string | null) {
    const holiday = holidays.find(h => h.id === id);
    if (!holiday || !newDate) return;

    await new Promise<void>((resolve, reject) => {
      updateMut.mutate(
        { id, name: holiday.name, holidayDate: newDate, location: holiday.location },
        {
          onSuccess: () => {
            notifications.show({ message: 'Holiday date updated', color: 'green' });
            stopEdit();
            resolve();
          },
          onError: (e: any) => {
            notifications.show({ message: e?.response?.data?.message ?? 'Failed to update', color: 'red' });
            reject(e);
          },
        }
      );
    });
  }

  async function handleInlineEditLocation(id: number, newLocation: string) {
    const holiday = holidays.find(h => h.id === id);
    if (!holiday) return;

    const iso = holiday.holidayDate;
    await new Promise<void>((resolve, reject) => {
      updateMut.mutate(
        { id, name: holiday.name, holidayDate: iso, location: newLocation },
        {
          onSuccess: () => {
            notifications.show({ message: 'Holiday location updated', color: 'green' });
            stopEdit();
            resolve();
          },
          onError: (e: any) => {
            notifications.show({ message: e?.response?.data?.message ?? 'Failed to update', color: 'red' });
            reject(e);
          },
        }
      );
    });
  }

  if (isLoading) return <LoadingSpinner />;
  if (error)    return <PageError context="loading holiday calendar" error={error} onRetry={refetch} />;

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 1 + i));

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        {!embedded && (
          <div>
            <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
              Holiday Calendar
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Public holidays by location — used to adjust available capacity per resource per month
            </Text>
          </div>
        )}
        <Group gap="xs">
          <Select
            size="xs"
            value={String(year)}
            onChange={v => v && setYear(Number(v))}
            data={yearOptions}
            w={90}
          />
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            style={{ backgroundColor: AQUA, color: DEEP_BLUE }}
            onClick={openAdd}
          >
            Add Holiday
          </Button>
        </Group>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 3 }} spacing="sm">
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="blue" variant="light" size="sm"><IconFlag size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>US Holidays</Text>
          </Group>
          <Text size="xl" fw={700} c="blue" mt={4}>{counts.US}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="sm"><IconMapPin size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>India Holidays</Text>
          </Group>
          <Text size="xl" fw={700} c="orange" mt={4}>{counts.INDIA}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="violet" variant="light" size="sm"><IconCalendarEvent size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>All Locations</Text>
          </Group>
          <Text size="xl" fw={700} c="violet" mt={4}>{counts.ALL}</Text>
        </Paper>
      </SimpleGrid>

      {/* Location filter */}
      <SegmentedControl
        size="xs"
        value={locFilter}
        onChange={setLocFilter}
        data={[
          { label: 'All', value: 'all' },
          { label: '🇺🇸 US', value: 'us' },
          { label: '🇮🇳 India', value: 'india' },
          { label: '🌐 All Locations', value: 'all_loc' },
        ]}
        w="fit-content"
      />

      {/* Monthly view */}
      {MONTHS.map((monthName, idx) => {
        const m = idx + 1;
        const rows = grouped[m];
        if (!rows || rows.length === 0) return null;
        return (
          <Paper key={m} withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
            <Box
              px="md"
              py="xs"
              style={{
                background: isDark ? '#1A2B3C' : '#EEF4FA',
                borderBottom: `1px solid ${isDark ? '#2C3E50' : '#D0DCE8'}`,
              }}
            >
              <Text fw={700} size="sm" style={{ color: isDark ? AQUA : DEEP_BLUE }}>
                {monthName} {year}
                <Text span size="xs" c="dimmed" ml={8}>
                  {rows.length} holiday{rows.length !== 1 ? 's' : ''} · {rows.length * 8} hrs deducted
                </Text>
              </Text>
            </Box>
            <Table highlightOnHover withRowBorders={false}>
              <Table.Tbody>
                {rows.map(h => (
                  <Table.Tr key={h.id}>
                    <Table.Td w={100}>
                      {/* Date column - inline editable */}
                      <InlineDateCell
                        value={h.holidayDate}
                        onSave={(newDate) => handleInlineEditDate(h.id, newDate)}
                        isEditing={isEditing(h.id, 'date')}
                        onStartEdit={() => startEdit(h.id, 'date')}
                        onCancel={stopEdit}
                        placeholder="Select date…"
                      />
                      <Text size="xs" c="dimmed" mt={4}>{DOW_SHORT[h.dayOfWeek] ?? h.dayOfWeek}</Text>
                    </Table.Td>
                    <Table.Td>
                      {/* Name column - inline editable */}
                      <InlineTextCell
                        value={h.name}
                        onSave={(newName) => handleInlineEditName(h.id, newName)}
                        isEditing={isEditing(h.id, 'name')}
                        onStartEdit={() => startEdit(h.id, 'name')}
                        onCancel={stopEdit}
                        placeholder="Holiday name…"
                      />
                    </Table.Td>
                    <Table.Td w={120}>
                      {/* Location column - inline editable */}
                      <InlineSelectCell
                        value={h.location}
                        options={[
                          { value: 'US', label: '🇺🇸 US' },
                          { value: 'INDIA', label: '🇮🇳 India' },
                          { value: 'ALL', label: '🌐 All Locations' },
                        ]}
                        onSave={(newLocation) => handleInlineEditLocation(h.id, newLocation)}
                        isEditing={isEditing(h.id, 'location')}
                        onStartEdit={() => startEdit(h.id, 'location')}
                        onCancel={stopEdit}
                      />
                    </Table.Td>
                    <Table.Td w={80}>
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="Delete">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            loading={deleteMut.isPending}
                            onClick={() => handleDelete(h.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        );
      })}

      {Object.keys(grouped).length === 0 && (
        <Paper withBorder p="xl" radius="md" style={{ textAlign: 'center' }}>
          <IconCalendarEvent size={40} color="gray" />
          <Text c="dimmed" mt="sm">No holidays for {year}{locFilter !== 'all' ? ` — ${locFilter.toUpperCase()}` : ''}</Text>
          <Button size="xs" mt="md" leftSection={<IconPlus size={14} />} onClick={openAdd}>
            Add Holiday
          </Button>
        </Paper>
      )}

      {/* Add / Edit modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700} style={{ color: DEEP_BLUE }}>{form.id ? 'Edit Holiday' : 'Add Holiday'}</Text>}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Holiday Name"
            placeholder="e.g. New Year's Day"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <DateInput
            label="Date"
            placeholder="Pick a date"
            value={form.holidayDate}
            onChange={v => setForm(f => ({ ...f, holidayDate: v }))}
            valueFormat="YYYY-MM-DD"
          />
          <Select
            label="Location"
            value={form.location}
            onChange={v => v && setForm(f => ({ ...f, location: v }))}
            data={[
              { value: 'US',    label: '🇺🇸 US' },
              { value: 'INDIA', label: '🇮🇳 India' },
              { value: 'ALL',   label: '🌐 All Locations' },
            ]}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" leftSection={<IconX size={14} />} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={14} />}
              loading={saveMut.isPending || updateMut.isPending}
              onClick={handleSave}
              style={{ backgroundColor: AQUA, color: DEEP_BLUE }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
