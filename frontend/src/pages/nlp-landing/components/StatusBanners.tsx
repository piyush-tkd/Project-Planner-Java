import { Alert, Paper, Group, Text, Badge, Button, ThemeIcon } from '@mantine/core';
import { IconInfoCircle, IconX, IconHistory } from '@tabler/icons-react';
import { FONT_FAMILY } from '../../../brandTokens';

export function DegradedBanner({
    isDegraded,
  nlpTierLabel,
  onNavigate,
}: {
  isDark: boolean;
  isDegraded: boolean;
  nlpTierLabel: string | null;
  onNavigate: () => void;
}) {
  if (!isDegraded || !nlpTierLabel) return null;

  return (
    <Alert
      icon={<IconInfoCircle size={16} />}
      color="yellow"
      radius="lg"
      mb="sm"
      style={{ fontFamily: FONT_FAMILY }}
      title="AI running in limited mode"
    >
      <span>{nlpTierLabel}. Complex questions may not be answered.</span>
      {' '}
      <span
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
        onClick={onNavigate}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate(); }}
      >
        Configure your AI key or engine →
      </span>
    </Alert>
  );
}

export function HistoryButton({
  isDark,
  conversationCount,
  onOpen,
}: {
  isDark: boolean;
  conversationCount: number;
  onOpen: () => void;
}) {
  if (conversationCount === 0) return null;

  return (
    <Group justify="flex-end" mb={6}>
      <Button
        variant="subtle"
        size="xs"
        leftSection={<IconHistory size={12} />}
        rightSection={
          <Badge size="xs" circle color="teal" variant="filled" style={{ minWidth: 16, fontSize: 9, padding: 0 }}>
            {conversationCount}
          </Badge>
        }
        onClick={onOpen}
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          fontSize: 12,
          color: isDark ? '#9ca3af' : '#6D7B8C',
          padding: '4px 8px',
          height: 'auto',
        }}
      >
        Conversation history
      </Button>
    </Group>
  );
}

export function ErrorBanner({
  onRetry,
  isLoading,
  errorMessage,
}: {
  onRetry: () => void;
  isLoading: boolean;
  errorMessage: string;
}) {
  return (
    <Paper p="md" mb="lg" radius="lg" withBorder style={{ borderColor: 'var(--mantine-color-red-4)', borderLeft: `4px solid var(--mantine-color-red-5)` }}>
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={32} variant="light" color="red" radius="md">
            <IconX size={18} />
          </ThemeIcon>
          <div>
            <Text c="red" size="sm" fw={500}>
              {errorMessage}
            </Text>
          </div>
        </Group>
        <Button
          variant="light"
          color="red"
          size="xs"
          onClick={onRetry}
          loading={isLoading}
        >
          Retry
        </Button>
      </Group>
    </Paper>
  );
}
