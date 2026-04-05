import { useState } from 'react';
import { Tabs } from '@mantine/core';
import { IconReportMoney, IconTrendingUp, IconGitBranch, IconBrain } from '@tabler/icons-react';
import FinancialIntelligencePage from './FinancialIntelligencePage';
import EngineeringProductivityPage from './EngineeringProductivityPage';
import GitIntelligencePage from './GitIntelligencePage';
import AiImpactPage from './AiImpactPage';

/**
 * EngineeringIntelligencePage
 * Unified surface combining three lenses on engineering performance:
 *   1. Financial Intelligence — cost attribution from Jira worklogs + resource rates
 *   2. Engineering Productivity — investment, output, efficiency, impact + DORA snapshot
 *   3. Git Intelligence — Azure DevOps PR metrics, commit frequency, branch health
 */
export default function EngineeringIntelligencePage() {
  const [tab, setTab] = useState<string>('financial');

  return (
    <Tabs
      value={tab}
      onChange={v => setTab(v ?? 'financial')}
      variant="outline"
      radius="sm"
    >
      <Tabs.List mb="xl">
        <Tabs.Tab value="financial" leftSection={<IconReportMoney size={15} />}>
          Financial Intelligence
        </Tabs.Tab>
        <Tabs.Tab value="productivity" leftSection={<IconTrendingUp size={15} />}>
          Engineering Productivity
        </Tabs.Tab>
        <Tabs.Tab value="git" leftSection={<IconGitBranch size={15} />}>
          Git Intelligence
        </Tabs.Tab>
        <Tabs.Tab value="ai" leftSection={<IconBrain size={15} />}>
          AI Impact
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="financial">
        <FinancialIntelligencePage />
      </Tabs.Panel>

      <Tabs.Panel value="productivity">
        <EngineeringProductivityPage />
      </Tabs.Panel>

      <Tabs.Panel value="git">
        <GitIntelligencePage />
      </Tabs.Panel>

      <Tabs.Panel value="ai">
        <AiImpactPage />
      </Tabs.Panel>
    </Tabs>
  );
}
