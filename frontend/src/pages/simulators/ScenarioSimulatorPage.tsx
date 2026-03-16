import { Title, Stack, Text, Card, ThemeIcon } from '@mantine/core';
import { IconAdjustments } from '@tabler/icons-react';

export default function ScenarioSimulatorPage() {
  return (
    <Stack align="center" mt="xl">
      <ThemeIcon size={64} radius="xl" variant="light" color="indigo">
        <IconAdjustments size={32} />
      </ThemeIcon>
      <Title order={2}>Scenario Simulator</Title>
      <Text c="dimmed" ta="center" maw={500}>
        The Scenario Simulator will allow you to model complex what-if scenarios
        including adding/removing projects, changing priorities, adjusting POD assignments,
        and modifying resource allocations to see the impact on overall capacity planning.
      </Text>
      <Card withBorder padding="lg" maw={400} w="100%">
        <Text fw={500} mb="xs">Planned Features:</Text>
        <Text size="sm" c="dimmed">- Add or remove projects from the plan</Text>
        <Text size="sm" c="dimmed">- Change project priorities and ordering</Text>
        <Text size="sm" c="dimmed">- Reassign PODs between projects</Text>
        <Text size="sm" c="dimmed">- Model team growth scenarios</Text>
        <Text size="sm" c="dimmed">- Compare multiple scenarios side by side</Text>
      </Card>
    </Stack>
  );
}
