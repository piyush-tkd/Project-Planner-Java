import { useState } from 'react';
import { Tabs, Box, Title, Text, Group } from '@mantine/core';
import { IconCurrencyDollar, IconReceipt2 } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import BudgetPage from './BudgetPage';
import JiraCapexPage from '../JiraCapexPage';

export default function BudgetCapexPage() {
 const dark = useDarkMode();
 const [activeTab, setActiveTab] = useState<string | null>('budget');

 return (
 <Box p="lg" style={{ }}>
 <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="sm">
 <Box>
 <Title order={2} style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 Budget & CapEx
 </Title>
 <Text size="sm" c="dimmed" mt={2}>
 Project cost tracking, CapEx / OpEx classification and Jira actuals
 </Text>
 </Box>
 </Group>

 <Tabs
 value={activeTab}
 onChange={setActiveTab}
 styles={{
 root: { '--tabs-color': AQUA },
 list: {
 borderBottom: `2px solid ${dark ? 'rgba(45,204,211,0.15)' : 'rgba(12,35,64,0.08)'}`,
 marginBottom: 20
 },
 tab: {fontWeight: 600, fontSize: 13,
 paddingBottom: 10,
 '&[data-active]': {
 color: dark ? AQUA : DEEP_BLUE,
 borderBottom: `2.5px solid ${AQUA}`
 }
 }}}
 >
 <Tabs.List>
 <Tabs.Tab
 value="budget"
 leftSection={<IconCurrencyDollar size={15} color={activeTab === 'budget' ? AQUA : undefined} />}
 >
 Budget & Cost
 </Tabs.Tab>
 <Tabs.Tab
 value="capex"
 leftSection={<IconReceipt2 size={15} color={activeTab === 'capex' ? AQUA : undefined} />}
 >
 CapEx / OpEx
 </Tabs.Tab>
 </Tabs.List>

 <Tabs.Panel value="budget">
 <BudgetPage />
 </Tabs.Panel>
 <Tabs.Panel value="capex">
 <JiraCapexPage />
 </Tabs.Panel>
 </Tabs>
 </Box>
 );
}
