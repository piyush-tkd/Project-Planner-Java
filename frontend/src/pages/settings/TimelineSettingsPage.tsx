import { useState, useEffect } from 'react';
import {
  Title, Stack, Card, NumberInput, Button, Group, Text, Table,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useTimeline, useUpdateTimeline } from '../../api/timeline';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CsvToolbar from '../../components/common/CsvToolbar';
import { workingHoursColumns } from '../../utils/csvColumns';

export default function TimelineSettingsPage() {
  const { data: timeline, isLoading } = useTimeline();
  const updateTimeline = useUpdateTimeline();
  const { monthLabels } = useMonthLabels();

  const [startYear, setStartYear] = useState(2026);
  const [startMonth, setStartMonth] = useState(1);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(1);
  const [workingHours, setWorkingHours] = useState<Record<string, number>>({});

  useEffect(() => {
    if (timeline) {
      setStartYear(timeline.startYear);
      setStartMonth(timeline.startMonth);
      setCurrentMonthIndex(timeline.currentMonthIndex);
      setWorkingHours(timeline.workingHours ?? {});
    }
  }, [timeline]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleSave = () => {
    updateTimeline.mutate({
      startYear,
      startMonth,
      currentMonthIndex,
      workingHours,
    }, {
      onSuccess: () => {
        notifications.show({ title: 'Saved', message: 'Timeline settings updated', color: 'green' });
      },
    });
  };

  if (isLoading) return <LoadingSpinner variant="form" message="Loading settings..." />;

  return (
    <Stack>
      <Title order={2}>Timeline Settings</Title>

      <Card withBorder padding="md">
        <Group grow>
          <NumberInput
            label="Start Year"
            value={startYear}
            onChange={v => setStartYear(Number(v))}
            min={2020}
            max={2035}
          />
          <NumberInput
            label="Start Month (1-12)"
            value={startMonth}
            onChange={v => setStartMonth(Number(v))}
            min={1}
            max={12}
          />
          <NumberInput
            label="Current Month Index"
            value={currentMonthIndex}
            onChange={v => setCurrentMonthIndex(Number(v))}
            min={1}
            max={12}
          />
        </Group>
      </Card>

      <Group justify="space-between">
        <Title order={4}>Working Hours per Month</Title>
        <CsvToolbar
          data={[Object.fromEntries(months.map(m => [`M${m}`, workingHours[`M${m}`] ?? 160]))]}
          columns={workingHoursColumns(monthLabels)}
          filename="working_hours"
          onImport={(rows) => {
            if (rows.length === 0) return;
            const row = rows[0];
            const newHours = { ...workingHours };
            for (let m = 1; m <= 12; m++) {
              const val = Number(row[`M${m}`]);
              if (!isNaN(val)) newHours[`M${m}`] = val;
            }
            setWorkingHours(newHours);
            notifications.show({ title: 'Imported', message: 'Working hours loaded — click Save to persist', color: 'blue' });
          }}
        />
      </Group>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Month</Table.Th>
            <Table.Th>Working Hours</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {months.map(m => (
            <Table.Tr key={m}>
              <Table.Td fw={500}>{monthLabels[m] ?? `M${m}`}</Table.Td>
              <Table.Td>
                <NumberInput
                  value={workingHours[`M${m}`] ?? 160}
                  onChange={v => setWorkingHours(prev => ({ ...prev, [`M${m}`]: Number(v) }))}
                  min={0}
                  max={300}
                  style={{ maxWidth: 150 }}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button onClick={handleSave} loading={updateTimeline.isPending}>Save Settings</Button>
    </Stack>
  );
}
