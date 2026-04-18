import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconDeviceDesktop } from '@tabler/icons-react';

/**
 * Shown in place of the app when the viewport is narrower than the minimum
 * supported width (1024 px).  Portfolio Planner is a power-user desktop tool;
 * drag-and-drop grids and dense data tables are not designed for narrow screens.
 *
 * See docs/adr/0001-desktop-only-or-responsive.md for the decision record.
 */
export function NarrowViewportGuard() {
  return (
    <Center style={{ minHeight: '100dvh', padding: '2rem' }}>
      <Stack align="center" gap="md" style={{ maxWidth: 360, textAlign: 'center' }}>
        <ThemeIcon size={64} radius="xl" variant="light" color="blue">
          <IconDeviceDesktop size={36} />
        </ThemeIcon>

        <Text fw={700} size="xl">
          Desktop required
        </Text>

        <Text c="dimmed" size="sm">
          Portfolio Planner is designed for desktop use. Please open this page on a
          screen that is at least 1024 px wide.
        </Text>

        <Text c="dimmed" size="xs">
          If you are on a laptop, try maximising your browser window or reducing your
          browser zoom level.
        </Text>
      </Stack>
    </Center>
  );
}
