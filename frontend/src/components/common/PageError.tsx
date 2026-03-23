import { Stack, Text, Title, Button, Group } from '@mantine/core';
import { IconMoodSad, IconRefresh } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW } from '../../brandTokens';

const WITTY_ERROR_MESSAGES = [
  "The data took an unplanned vacation.",
  "Our server blinked at the wrong time.",
  "Bits and bytes got tangled up.",
  "The query went out for coffee.",
  "Data pipeline had a plot twist.",
  "Numbers decided to play hide and seek.",
];

interface PageErrorProps {
  /** What the user was trying to do, e.g. "Loading capacity gap data" */
  context?: string;
  /** The actual error message from the API */
  error?: string | Error | null;
  /** Called when user clicks Retry */
  onRetry?: () => void;
}

export default function PageError({ context, error, onRetry }: PageErrorProps) {
  const witty = WITTY_ERROR_MESSAGES[Math.floor(Math.random() * WITTY_ERROR_MESSAGES.length)];
  const errorMsg = error instanceof Error ? error.message : error;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      padding: 32,
      fontFamily: FONT_FAMILY,
    }}>
      <Stack align="center" gap="md" maw={440}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${DEEP_BLUE} 0%, ${DEEP_BLUE_TINTS[80]} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: SHADOW.md,
        }}>
          <IconMoodSad size={30} color={AQUA} stroke={1.5} />
        </div>

        <Title order={3} ta="center" style={{
          color: DEEP_BLUE,
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
        }}>
          {witty}
        </Title>

        {context && (
          <Text size="sm" c="dimmed" ta="center" style={{ fontFamily: FONT_FAMILY }}>
            We couldn't finish: <strong>{context}</strong>
          </Text>
        )}

        {errorMsg && (
          <div style={{
            background: DEEP_BLUE_TINTS[10],
            borderRadius: 8,
            padding: '8px 14px',
            width: '100%',
          }}>
            <Text size="xs" ff="monospace" c={DEEP_BLUE_TINTS[70]} style={{ wordBreak: 'break-word' }}>
              {errorMsg}
            </Text>
          </div>
        )}

        {onRetry && (
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            color="teal"
            size="sm"
            onClick={onRetry}
            style={{ fontFamily: FONT_FAMILY }}
          >
            Retry
          </Button>
        )}
      </Stack>
    </div>
  );
}
