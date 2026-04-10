import { useState, useCallback } from 'react';
import {
  ActionIcon, Indicator, Popover, Stack, Text, Group, Badge,
  Button, Divider, Anchor, ScrollArea, ThemeIcon, Box,
} from '@mantine/core';
import { IconBell, IconBellOff, IconExternalLink, IconCheck } from '@tabler/icons-react';
import { useAlertCounts } from '../../hooks/useAlertCounts';
import { SupportTicket } from '../../api/jira';
import { useJiraStatus } from '../../api/jira';
import { COLOR_ERROR_DEEP, COLOR_ERROR_LIGHT } from '../../brandTokens';

const DISMISSED_KEY = 'pp_dismissed_alerts';

const PRIORITY_COLOR: Record<string, string> = {
  Blocker: COLOR_ERROR_DEEP,
  Critical: '#e03131',
  Highest:  '#f03e3e',
};

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const { criticalTickets } = useAlertCounts();
  const { data: jiraStatus } = useJiraStatus();
  const jiraBaseUrl = jiraStatus?.baseUrl;

  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [open, setOpen] = useState(false);

  const visible = criticalTickets.filter(t => !dismissed.has(t.key));
  const count   = visible.length;

  const dismiss = useCallback((key: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      criticalTickets.forEach(t => next.add(t.key));
      saveDismissed(next);
      return next;
    });
    setOpen(false);
  }, [criticalTickets]);

  // Don't render if Jira isn't configured
  if (!jiraStatus?.configured) return null;

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-end"
      offset={8}
      withArrow
      width={380}
      shadow="md"
    >
      <Popover.Target>
        <Indicator
          label={count > 0 ? count : undefined}
          size={16}
          color="red"
          processing={count > 0}
          disabled={count === 0}
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setOpen(o => !o)}
            style={{ color: count > 0 ? COLOR_ERROR_LIGHT : 'rgba(255,255,255,0.75)' }}
          >
            {count > 0 ? <IconBell size={19} /> : <IconBellOff size={19} />}
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Header */}
        <Box px="md" py="sm" style={{ borderBottom: '1px solid #eee' }}>
          <Group justify="space-between">
            <Text fw={600} size="sm">Critical Alerts</Text>
            {count > 0 && (
              <Button
                size="xs" variant="subtle" color="gray"
                leftSection={<IconCheck size={12} />}
                onClick={dismissAll}
              >
                Mark all read
              </Button>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {count === 0
              ? 'No active critical or blocker tickets'
              : `${count} Blocker / Critical ticket${count > 1 ? 's' : ''} open`}
          </Text>
        </Box>

        {/* Ticket list */}
        <ScrollArea.Autosize mah={360}>
          {count === 0 ? (
            <Stack align="center" gap="xs" py="xl">
              <ThemeIcon size={40} variant="light" color="green" radius="xl">
                <IconCheck size={20} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">All clear — no critical tickets</Text>
            </Stack>
          ) : (
            <Stack gap={0}>
              {visible.map((ticket, i) => (
                <TicketRow
                  key={ticket.key}
                  ticket={ticket}
                  jiraBaseUrl={jiraBaseUrl}
                  onDismiss={() => dismiss(ticket.key)}
                  last={i === visible.length - 1}
                />
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>

        {/* Footer */}
        {count > 0 && (
          <Box px="md" py="xs" style={{ borderTop: '1px solid #eee' }}>
            <Anchor href="/jira-support" size="xs" c="dimmed">
              View all in Support Queue →
            </Anchor>
          </Box>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

// ── Individual ticket row ──────────────────────────────────────────────────────

function TicketRow({
  ticket, jiraBaseUrl, onDismiss, last,
}: {
  ticket: SupportTicket;
  jiraBaseUrl?: string;
  onDismiss: () => void;
  last: boolean;
}) {
  const color = PRIORITY_COLOR[ticket.priority ?? ''] ?? '#e03131';
  const jiraUrl = jiraBaseUrl && ticket.key
    ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${ticket.key}`
    : null;

  return (
    <Box
      px="md"
      py="sm"
      style={{
        borderBottom: last ? 'none' : '1px solid #f0f0f0',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" mb={2}>
            <Badge size="xs" style={{ background: color + '22', color, border: `1px solid ${color}44`, fontWeight: 700 }}>
              {ticket.priority}
            </Badge>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>{ticket.key}</Text>
            <Text size="xs" c="dimmed">{timeAgo(ticket.created)}</Text>
          </Group>
          <Text
            size="xs"
            fw={500}
            style={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: '100%',
            }}
            title={ticket.summary ?? ''}
          >
            {ticket.summary ?? '(no summary)'}
          </Text>
          {ticket.assignee && (
            <Text size="xs" c="dimmed" mt={1}>→ {ticket.assignee}</Text>
          )}
        </div>
        <Group gap={4} wrap="nowrap">
          {jiraUrl && (
            <ActionIcon
              size="xs" variant="subtle" color="gray"
              component="a" href={jiraUrl} target="_blank" rel="noopener"
            >
              <IconExternalLink size={12} />
            </ActionIcon>
          )}
          <ActionIcon
            size="xs" variant="subtle" color="gray"
            onClick={onDismiss}
            title="Mark as read"
          >
            <IconCheck size={12} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
}
