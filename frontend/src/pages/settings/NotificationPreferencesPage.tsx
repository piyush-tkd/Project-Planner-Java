/**
 * NotificationPreferencesPage — per-user notification settings.
 *
 * Grouped into three sections:
 *   1. In-app event toggles (which events generate an in-app notification)
 *   2. Email settings (master toggle, digest cadence)
 *   3. Quiet hours (suppress notifications between X and Y)
 */
import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Button, Paper, Switch, Select,
  SimpleGrid, Divider, Badge, NumberInput, ThemeIcon, Skeleton,
  Alert, ActionIcon, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBell, IconMail, IconClock, IconCheck, IconRefresh,
  IconAlertCircle, IconAlertTriangle,
  IconBolt, IconCalendarEvent, IconMessageCircle,
  IconRocket, IconFlag,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  NotificationPreference,
} from '../../api/notificationPreferences';

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TOGGLES: {
  key: keyof NotificationPreference;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    key: 'onStatusChange',
    label: 'Status change',
    description: 'Notified when a project status is updated (e.g. On Track → At Risk)',
    icon: <IconFlag size={16} />,
    color: 'blue',
  },
  {
    key: 'onRiskAdded',
    label: 'Risk added',
    description: 'Notified when a new risk is logged against a project',
    icon: <IconAlertTriangle size={16} />,
    color: 'orange',
  },
  {
    key: 'onCommentMention',
    label: 'Comment mention',
    description: 'Notified when someone mentions you in a project discussion',
    icon: <IconMessageCircle size={16} />,
    color: 'teal',
  },
  {
    key: 'onSprintStart',
    label: 'Sprint start',
    description: 'Notified at the beginning of each sprint cycle',
    icon: <IconRocket size={16} />,
    color: 'indigo',
  },
  {
    key: 'onAutomationFired',
    label: 'Automation fired',
    description: 'Notified whenever an automation rule executes for a project you own',
    icon: <IconBolt size={16} />,
    color: 'violet',
  },
  {
    key: 'onTargetDatePassed',
    label: 'Target date passed',
    description: 'Notified when a project\'s target date passes without completion',
    icon: <IconCalendarEvent size={16} />,
    color: 'red',
  },
];

const DIGEST_OPTIONS = [
  { value: 'NONE',   label: 'No email digest' },
  { value: 'DAILY',  label: 'Daily digest' },
  { value: 'WEEKLY', label: 'Weekly digest' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <Group gap="sm" mb="sm">
      <ThemeIcon size={32} radius="md" variant="light" color="teal">
        {icon}
      </ThemeIcon>
      <div>
        <Group gap="xs" align="center">
          <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
            {title}
          </Text>
          {badge && <Badge size="xs" variant="light" color="teal">{badge}</Badge>}
        </Group>
      </div>
    </Group>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  const isDark = useDarkMode();
  const { data, isLoading, isError, refetch } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Local draft state — mirrors server state; edits are staged until Save
  const [draft, setDraft] = useState<Partial<NotificationPreference>>({});
  const [dirty, setDirty] = useState(false);

  // Populate draft when data loads
  useEffect(() => {
    if (data) {
      setDraft({ ...data });
      setDirty(false);
    }
  }, [data]);

  // Generic toggle updater
  const setField = <K extends keyof NotificationPreference>(
    key: K,
    value: NotificationPreference[K],
  ) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(draft);
      notifications.show({
        title: 'Preferences saved',
        message: 'Your notification settings have been updated.',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setDirty(false);
    } catch {
      notifications.show({
        title: 'Save failed',
        message: 'Could not save notification preferences. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleReset = () => {
    if (data) {
      setDraft({ ...data });
      setDirty(false);
    }
  };

  const cardBg = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef';

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={40} width={280} />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={140} radius="md" />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Load error">
        Could not load notification preferences. {' '}
        <Button size="xs" variant="subtle" onClick={() => refetch()}>Retry</Button>
      </Alert>
    );
  }

  const val = draft as NotificationPreference;

  return (
    <Stack gap="lg" className="page-enter">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Notification Preferences
          </Title>
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Control which events generate in-app and email notifications for your account.
          </Text>
        </div>
        <Group gap="xs">
          {dirty && (
            <Tooltip label="Discard changes">
              <ActionIcon variant="default" size="lg" onClick={handleReset}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Button
            leftSection={<IconCheck size={15} />}
            onClick={handleSave}
            loading={updateMutation.isPending}
            disabled={!dirty}
            color="teal"
            size="sm"
          >
            Save preferences
          </Button>
        </Group>
      </Group>

      {/* ── Section 1: In-app event toggles ─────────────────────────────── */}
      <Paper
        withBorder
        radius="md"
        p="lg"
        style={{ background: cardBg, borderColor }}
      >
        <SectionHeader
          icon={<IconBell size={16} />}
          title="In-app notifications"
          badge="real-time"
        />
        <Text size="xs" c="dimmed" mb="md" style={{ fontFamily: FONT_FAMILY }}>
          These events will appear in your notification bell and activity feed.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {EVENT_TOGGLES.map(toggle => (
            <Paper
              key={toggle.key}
              withBorder
              radius="sm"
              p="sm"
              style={{
                background: isDark ? 'var(--mantine-color-dark-6)' : '#f8f9fa',
                borderColor,
                transition: 'background 0.15s',
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                  <ThemeIcon size={28} radius="sm" variant="light" color={toggle.color}>
                    {toggle.icon}
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                      {toggle.label}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      {toggle.description}
                    </Text>
                  </div>
                </Group>
                <Switch
                  checked={Boolean(val[toggle.key])}
                  onChange={e => setField(toggle.key as keyof NotificationPreference, e.currentTarget.checked as never)}
                  color="teal"
                  size="sm"
                  mt={2}
                />
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>

      {/* ── Section 2: Email settings ──────────────────────────────────── */}
      <Paper
        withBorder
        radius="md"
        p="lg"
        style={{ background: cardBg, borderColor }}
      >
        <SectionHeader
          icon={<IconMail size={16} />}
          title="Email notifications"
        />

        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                Enable email notifications
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                Receive email alerts for the events you have enabled above.
              </Text>
            </div>
            <Switch
              checked={val.emailEnabled ?? false}
              onChange={e => setField('emailEnabled', e.currentTarget.checked)}
              color="teal"
              size="md"
            />
          </Group>

          <Divider />

          <div>
            <Text size="sm" fw={500} mb={6} style={{ fontFamily: FONT_FAMILY }}>
              Digest cadence
            </Text>
            <Text size="xs" c="dimmed" mb={8} style={{ fontFamily: FONT_FAMILY }}>
              Bundle notifications into a periodic digest instead of immediate emails.
            </Text>
            <Select
              data={DIGEST_OPTIONS}
              value={val.emailDigest ?? 'NONE'}
              onChange={v => setField('emailDigest', (v ?? 'NONE') as NotificationPreference['emailDigest'])}
              disabled={!val.emailEnabled}
              size="sm"
              w={220}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          </div>
        </Stack>
      </Paper>

      {/* ── Section 3: Quiet hours ────────────────────────────────────── */}
      <Paper
        withBorder
        radius="md"
        p="lg"
        style={{ background: cardBg, borderColor }}
      >
        <SectionHeader
          icon={<IconClock size={16} />}
          title="Quiet hours"
          badge="optional"
        />
        <Text size="xs" c="dimmed" mb="md" style={{ fontFamily: FONT_FAMILY }}>
          Suppress all notifications during these hours. Leave blank to disable quiet hours.
        </Text>

        <Group gap="md" align="flex-end">
          <div>
            <Text size="xs" fw={500} mb={4} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              From (hour)
            </Text>
            <Select
              data={HOUR_OPTIONS}
              value={val.quietStartHour !== null && val.quietStartHour !== undefined ? String(val.quietStartHour) : null}
              onChange={v => setField('quietStartHour', v !== null ? Number(v) : null)}
              clearable
              placeholder="Start hour"
              size="sm"
              w={130}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          </div>
          <Text size="sm" c="dimmed" mb={6}>to</Text>
          <div>
            <Text size="xs" fw={500} mb={4} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              To (hour)
            </Text>
            <Select
              data={HOUR_OPTIONS}
              value={val.quietEndHour !== null && val.quietEndHour !== undefined ? String(val.quietEndHour) : null}
              onChange={v => setField('quietEndHour', v !== null ? Number(v) : null)}
              clearable
              placeholder="End hour"
              size="sm"
              w={130}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          </div>
        </Group>

        {val.quietStartHour !== null && val.quietStartHour !== undefined &&
         val.quietEndHour   !== null && val.quietEndHour   !== undefined && (
          <Alert
            mt="md"
            icon={<IconClock size={14} />}
            color="blue"
            variant="light"
            radius="sm"
          >
            <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
              Notifications will be silenced between{' '}
              <strong>{String(val.quietStartHour).padStart(2, '0')}:00</strong>
              {' '}and{' '}
              <strong>{String(val.quietEndHour).padStart(2, '0')}:00</strong>.
            </Text>
          </Alert>
        )}
      </Paper>

      {/* Sticky save bar (only shown when dirty) */}
      {dirty && (
        <Paper
          withBorder
          radius="md"
          p="sm"
          style={{
            background: isDark ? 'var(--mantine-color-dark-6)' : '#fffbe6',
            borderColor: isDark ? 'var(--mantine-color-yellow-8)' : '#ffe066',
            position: 'sticky',
            bottom: 16,
          }}
        >
          <Group justify="space-between">
            <Group gap="xs">
              <IconAlertTriangle size={15} color={isDark ? '#ffe066' : '#e67700'} />
              <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#ffe066' : '#e67700' }}>
                You have unsaved changes
              </Text>
            </Group>
            <Group gap="xs">
              <Button variant="subtle" size="xs" onClick={handleReset} color="gray">
                Discard
              </Button>
              <Button
                leftSection={<IconCheck size={14} />}
                size="xs"
                color="teal"
                onClick={handleSave}
                loading={updateMutation.isPending}
              >
                Save now
              </Button>
            </Group>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
