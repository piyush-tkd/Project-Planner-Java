import { useNavigate } from 'react-router-dom';
import { Stack, Title, Text, Button, Group, Box } from '@mantine/core';
import { IconHome, IconArrowLeft } from '@tabler/icons-react';
import { AQUA, AQUA_HEX, DEEP_BLUE, DEEP_BLUE_HEX, FONT_FAMILY } from '../brandTokens';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Stack align="center" gap="lg" style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>

        {/* Large 404 */}
        <Box>
          <Text
            style={{
              fontSize: 120,
              fontWeight: 800,
              lineHeight: 1,
              color: AQUA,
              opacity: 0.15,
              userSelect: 'none',
            }}
          >
            404
          </Text>
        </Box>

        {/* Icon */}
        <Box
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${AQUA}22, ${DEEP_BLUE}33)`,
            border: `2px solid ${AQUA}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -60,
          }}
        >
          <Text style={{ fontSize: 32 }}>🗺️</Text>
        </Box>

        <Stack gap={6} align="center">
          <Title
            order={2}
            style={{ fontFamily: FONT_FAMILY, fontWeight: 700, color: 'var(--mantine-color-text)' }}
          >
            Page not found
          </Title>
          <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
            The URL you visited doesn't exist in Portfolio Planner.
            It may have been moved, deleted, or you may have mistyped the address.
          </Text>
        </Stack>

        <Group gap="sm" justify="center">
          <Button
            leftSection={<IconArrowLeft size={15} />}
            variant="subtle"
            color="gray"
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
          <Button
            leftSection={<IconHome size={15} />}
            variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
            onClick={() => navigate('/')}
          >
            Dashboard
          </Button>
        </Group>

        <Text size="xs" c="dimmed" mt={8}>
          If you believe this is a bug, use ⌘K to search for the page you're looking for.
        </Text>
      </Stack>
    </Box>
  );
}
