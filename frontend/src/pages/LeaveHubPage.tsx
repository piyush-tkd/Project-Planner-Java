import { useState } from 'react';
import { Tabs, Title, Text, Group } from '@mantine/core';
import { IconCalendarOff, IconCalendarEvent } from '@tabler/icons-react';
import LeaveManagementPage from './settings/LeaveManagementPage';
import HolidayCalendarPage from './settings/HolidayCalendarPage';
import { DEEP_BLUE, FONT_FAMILY } from '../brandTokens';

export default function LeaveHubPage() {
  const [activeTab, setActiveTab] = useState<string | null>('leave');

  return (
    <div>
      <Group mb="lg" align="flex-start">
        <div>
          <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
            Leave &amp; Holidays
          </Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Team leave management and organisation holiday calendar
          </Text>
        </div>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm">
        <Tabs.List mb="lg">
          <Tabs.Tab value="leave"    leftSection={<IconCalendarOff size={14} />}>
            Leave Management
          </Tabs.Tab>
          <Tabs.Tab value="holidays" leftSection={<IconCalendarEvent size={14} />}>
            Holiday Calendar
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="leave">
          <LeaveManagementPage embedded />
        </Tabs.Panel>

        <Tabs.Panel value="holidays">
          <HolidayCalendarPage embedded />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
