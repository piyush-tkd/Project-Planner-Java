import { useState } from 'react';
import { Tabs } from '@mantine/core';
import { IconCalendarOff, IconCalendarEvent } from '@tabler/icons-react';
import { PPPageLayout } from '../components/pp';
import LeaveManagementPage from './settings/LeaveManagementPage';
import HolidayCalendarPage from './settings/HolidayCalendarPage';

export default function LeaveHubPage() {
  const [activeTab, setActiveTab] = useState<string | null>('leave');

  return (
    <PPPageLayout
      title="Leave &amp; Holidays"
      subtitle="Team leave management and organisation holiday calendar"
      animate
    >
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
    </PPPageLayout>
  );
}
