import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Button, TextInput, Paper, Tabs,
  ColorInput, SimpleGrid, Box, Switch, Badge, Select, Divider,
  FileButton, Center, ThemeIcon, Tooltip, NumberInput,
  PasswordInput, UnstyledButton, Skeleton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding, IconUpload, IconCheck, IconRefresh,
  IconBell, IconUserCog, IconDatabase, IconHistory,
  IconAlertTriangle, IconBrain, IconMessageReport, IconArrowsShuffle,
  IconKey, IconTicket, IconPackage, IconHeadset,
  IconSettings, IconBrandAzure, IconMail, IconPlugConnected,
  IconClock, IconCloudDownload, IconCircleCheck, IconCircleX, IconChevronRight,
  IconShield, IconLink, IconCopy, IconListCheck, IconPercentage, IconArrowRight,
} from '@tabler/icons-react';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import apiClient from '../../api/client';
import { useOrgSettings, OrgConfig } from '../../context/OrgSettingsContext';
import { useNavigate as useNav, useSearchParams } from 'react-router-dom';
import UserManagementPage  from './UserManagementPage';
import RefDataSettingsPage from './RefDataSettingsPage';
import TimelineSettingsPage from './TimelineSettingsPage';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'UTC', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Shared compact nav-link grid ─────────────────────────────────────────────
interface NavItem { icon: React.ReactNode; label: string; path: string; desc: string }

/** Single card — extracted so hover useState works per-item without extra deps */
function NavGridItem({ item, color }: { item: NavItem; color: string }) {
  const navigate = useNav();
  const [hovered, setHovered] = useState(false);
  return (
    <UnstyledButton
      onClick={() => navigate(item.path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'block', minWidth: 0 }}
    >
      <Paper
        withBorder
        p="sm"
        radius="md"
        style={{
          cursor: 'pointer',
          transition: 'border-color 120ms, background 120ms',
          borderColor: hovered ? 'var(--mantine-color-teal-5)' : undefined,
          background:   hovered ? 'var(--mantine-color-default-hover)' : undefined,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color={color} size={30} radius="md" style={{ flexShrink: 0 }}>
            {item.icon}
          </ThemeIcon>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{item.label}</Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }} lineClamp={1}>{item.desc}</Text>
          </Box>
          <IconChevronRight size={13} style={{
            flexShrink: 0, transition: 'opacity 120ms',
            opacity: hovered ? 0.65 : 0.3,
          }} />
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

function NavGrid({ items, color = 'teal', cols = 2 }: {
  items: NavItem[];
  color?: string;
  cols?: number;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: Math.min(cols, 2), lg: cols }} spacing="xs">
      {items.map(l => <NavGridItem key={l.path} item={l} color={color} />)}
    </SimpleGrid>
  );
}

// ── Jira Epic Sync Panel ─────────────────────────────────────────────────────
function JiraEpicSyncPanel({ schedule, setSchedule, scheduleSaving, handleScheduleSave }: {
  schedule: any; setSchedule: any; scheduleSaving: boolean; handleScheduleSave: () => void;
}) {
  const [boardStatus, setBoardStatus]     = useState<any[]>([]);
  const [syncing, setSyncing]             = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const loadStatus = () => {
    setStatusLoading(true);
    apiClient.get('/jira-sync/status')
      .then(({ data }) => setBoardStatus(data ?? []))
      .catch(() => setBoardStatus([]))
      .finally(() => setStatusLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const { data } = await apiClient.post('/jira-sync/run');
      notifications.show({
        title: 'Sync complete',
        message: `Created ${data.created}, updated ${data.updated}, failed ${data.failed}`,
        color: data.failed > 0 ? 'orange' : 'green',
      });
      loadStatus();
    } catch {
      notifications.show({ title: 'Sync failed', message: 'Could not reach Jira. Check credentials.', color: 'red' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="center" mb="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color="teal" size={26} radius="md">
            <IconCloudDownload size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Project Sync — Jira Epics → PP</Text>
          <Badge size="xs" color={schedule.jiraSyncEnabled ? 'teal' : 'gray'} variant="light">
            {schedule.jiraSyncEnabled ? 'Auto-sync ON' : 'Auto-sync OFF'}
          </Badge>
        </Group>
        <Group gap="xs">
          <Switch
            size="xs"
            color="teal"
            label="Auto-sync"
            checked={schedule.jiraSyncEnabled}
            onChange={e => setSchedule((p: any) => ({ ...p, jiraSyncEnabled: e.currentTarget.checked }))}
          />
          <Button size="xs" variant="light" color="teal" leftSection={<IconCloudDownload size={12} />}
            loading={syncing} onClick={handleForceSync}>
            Force Sync
          </Button>
        </Group>
      </Group>

      {schedule.jiraSyncEnabled && (
        <Group gap="sm" mb="sm">
          <TextInput
            size="xs"
            label="Sync cron"
            placeholder="0 0 */2 * * *"
            value={schedule.jiraSyncCron}
            onChange={e => setSchedule((p: any) => ({ ...p, jiraSyncCron: e.target.value }))}
            description="Spring format. Default: every 2 h"
            style={{ flex: 1, maxWidth: 280 }}
          />
          <Button size="xs" variant="subtle" color="teal" mt={20}
            loading={scheduleSaving} onClick={handleScheduleSave}>
            Save
          </Button>
        </Group>
      )}

      {(() => {
        // Filter out placeholder rows that carry no real identity
        // (boardId === 0 / falsy means Jira hasn't been configured yet)
        const validBoards = boardStatus.filter((b: any) => b.boardId && b.boardName);
        if (statusLoading) return <Stack gap="xs" py="xs">{[1,2].map(i => <Skeleton key={i} height={28} radius="sm" />)}</Stack>;
        if (validBoards.length === 0) return (
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            No boards found. Configure Jira credentials first.
          </Text>
        );
        return (
          <Stack gap={4}>
            {validBoards.map((b: any) => (
              <Group key={b.boardId} justify="space-between" px="sm" py="xs"
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--mantine-color-default-border)',
                  background: 'var(--mantine-color-body)',
                }}>
                <Group gap="xs">
                  <ThemeIcon size={18} radius="xl" color={b.hasError ? 'red' : 'teal'} variant="light">
                    {b.hasError ? <IconCircleX size={11} /> : <IconCircleCheck size={11} />}
                  </ThemeIcon>
                  <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>{b.boardName}</Text>
                  <Badge size="xs" variant="light" color={b.epicCount > 0 ? 'teal' : 'gray'}>
                    {b.epicCount} project{b.epicCount !== 1 ? 's' : ''}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                  {b.lastSync ? `Last sync: ${new Date(b.lastSync).toLocaleDateString()}` : 'Never synced'}
                </Text>
              </Group>
            ))}
          </Stack>
        );
      })()}
    </Paper>
  );
}

// ── Legacy tab key mapping ───────────────────────────────────────────────────
const LEGACY_TAB_MAP: Record<string, string> = {
  branding: 'general', workspace: 'general',
  email: 'notifications', ai: 'notifications',
  data: 'system',
  approvals: 'approvals',
};
const resolveTabKey = (raw: string | null) =>
  raw ? (LEGACY_TAB_MAP[raw] ?? raw) : 'general';

// ── Main Settings Hub ────────────────────────────────────────────────────────
export default function OrgSettingsPage() {
  const navigate = useNav();
  const [searchParams] = useSearchParams();
  const { orgSettings, loading: ctxLoading, refresh } = useOrgSettings();

  const [draft, setDraft]     = useState<OrgConfig>(orgSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [activeTab, setActiveTab] = useState<string | null>(
    () => resolveTabKey(searchParams.get('tab'))
  );
  useEffect(() => {
    setActiveTab(resolveTabKey(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (tab: string | null) => {
    const key = tab ?? 'general';
    setActiveTab(key);
    navigate(`/settings/org?tab=${key}`, { replace: true });
  };

  // ── SMTP state ────────────────────────────────────────────────────────────
  interface SmtpDraft {
    host: string; port: number; username: string; password: string;
    fromAddress: string; useTls: boolean; enabled: boolean; passwordSet: boolean;
  }
  const [smtp, setSmtp] = useState<SmtpDraft>({
    host: 'smtp.gmail.com', port: 587, username: '', password: '',
    fromAddress: 'noreply@portfolioplanner', useTls: true, enabled: false, passwordSet: false,
  });
  const [smtpLoaded, setSmtpLoaded]   = useState(false);
  const [smtpSaving, setSmtpSaving]   = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);

  // ── Schedule state ────────────────────────────────────────────────────────
  interface ScheduleDraft {
    recipients: string;
    digestEnabled: boolean; digestCron: string;
    stalenessEnabled: boolean; stalenessCron: string;
    jiraSyncEnabled: boolean; jiraSyncCron: string;
  }
  const [schedule, setSchedule] = useState<ScheduleDraft>({
    recipients: '', digestEnabled: false, digestCron: '0 0 8 * * MON',
    stalenessEnabled: false, stalenessCron: '0 0 9 * * MON',
    jiraSyncEnabled: false, jiraSyncCron: '0 0 */2 * * *',
  });
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'notifications' && !smtpLoaded) {
      apiClient.get('/settings/smtp').then(({ data }) => {
        setSmtp({
          host: data.host ?? 'smtp.gmail.com', port: data.port ?? 587,
          username: data.username ?? '', password: '',
          fromAddress: data.fromAddress ?? 'noreply@portfolioplanner',
          useTls: data.useTls ?? true, enabled: data.enabled ?? false,
          passwordSet: data.passwordSet ?? false,
        });
        setSmtpLoaded(true);
      }).catch(() => {});
    }
  }, [activeTab, smtpLoaded]);

  useEffect(() => {
    if (activeTab === 'notifications' && !scheduleLoaded) {
      apiClient.get('/settings/notification-schedule').then(({ data }) => {
        setSchedule({
          recipients:       data.recipients       ?? '',
          digestEnabled:    data.digestEnabled    ?? false,
          digestCron:       data.digestCron       ?? '0 0 8 * * MON',
          stalenessEnabled: data.stalenessEnabled ?? false,
          stalenessCron:    data.stalenessCron    ?? '0 0 9 * * MON',
          jiraSyncEnabled:  data.jiraSyncEnabled  ?? false,
          jiraSyncCron:     data.jiraSyncCron     ?? '0 0 */2 * * *',
        });
        setScheduleLoaded(true);
      }).catch(() => {});
    }
  }, [activeTab, scheduleLoaded]);

  const handleScheduleSave = async () => {
    setScheduleSaving(true);
    try {
      await apiClient.put('/settings/notification-schedule', schedule);
      notifications.show({ title: 'Saved', message: 'Notification schedule saved', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save schedule', color: 'red' });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSmtpSave = async () => {
    setSmtpSaving(true);
    try {
      const payload = { ...smtp };
      if (!payload.password) delete (payload as Partial<SmtpDraft>).password;
      const { data } = await apiClient.put('/settings/smtp', payload);
      setSmtp(prev => ({ ...prev, passwordSet: data.passwordSet ?? prev.passwordSet, password: '' }));
      notifications.show({ title: 'Saved', message: 'SMTP settings saved', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save SMTP settings', color: 'red' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    try {
      const { data } = await apiClient.post('/settings/smtp/test');
      notifications.show({
        title: data.success ? 'Connection OK' : 'Connection Failed',
        message: data.message,
        color: data.success ? 'green' : 'red',
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Test request failed', color: 'red' });
    } finally {
      setSmtpTesting(false);
    }
  };

  const [smtpSendingTest, setSmtpSendingTest] = useState(false);
  const handleSmtpSendTest = async () => {
    setSmtpSendingTest(true);
    try {
      const { data } = await apiClient.post('/settings/smtp/send-test');
      notifications.show({
        title: data.success ? 'Test email sent' : 'Send failed',
        message: data.message,
        color: data.success ? 'teal' : 'red',
        autoClose: 8000,
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Could not send test email', color: 'red' });
    } finally {
      setSmtpSendingTest(false);
    }
  };

  // ── SSO state ─────────────────────────────────────────────────────────────
  interface SsoDraft {
    provider: string; clientId: string; clientSecret: string;
    redirectUri: string; discoveryUrl: string; enabled: boolean;
  }
  const [sso, setSso] = useState<SsoDraft>({
    provider: 'GOOGLE', clientId: '', clientSecret: '',
    redirectUri: '', discoveryUrl: '', enabled: false,
  });
  const [ssoLoaded, setSsoLoaded]   = useState(false);
  const [ssoSaving, setSsoSaving]   = useState(false);
  const [ssoSecretSet, setSsoSecretSet] = useState(false);

  const SSO_MASK = '••••••••';

  useEffect(() => {
    if (activeTab === 'jira' && !ssoLoaded) {
      apiClient.get('/admin/sso').then(({ data }) => {
        setSso({
          provider:     data.provider     ?? 'GOOGLE',
          clientId:     data.clientId     ?? '',
          clientSecret: '',
          redirectUri:  data.redirectUri  ?? '',
          discoveryUrl: data.discoveryUrl ?? '',
          enabled:      data.enabled      ?? false,
        });
        setSsoSecretSet(data.clientSecret === SSO_MASK);
        setSsoLoaded(true);
      }).catch(() => {});
    }
  }, [activeTab, ssoLoaded]);

  const handleSsoSave = async () => {
    setSsoSaving(true);
    try {
      const payload: Record<string, unknown> = {
        provider:     sso.provider,
        clientId:     sso.clientId,
        redirectUri:  sso.redirectUri,
        discoveryUrl: sso.discoveryUrl,
        enabled:      sso.enabled,
      };
      if (sso.clientSecret && sso.clientSecret !== SSO_MASK) {
        payload.clientSecret = sso.clientSecret;
      }
      await apiClient.put('/admin/sso', payload);
      setSso(prev => ({ ...prev, clientSecret: '' }));
      setSsoSecretSet(!!sso.clientId);
      notifications.show({ title: 'Saved', message: 'SSO configuration saved', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save SSO config', color: 'red' });
    } finally {
      setSsoSaving(false);
    }
  };

  // ── Approval rules state (features JSONB + localStorage for threshold) ──────
  const APPROVAL_PREFS_KEY = 'pp_approval_prefs';
  const loadApprovalPrefs = () => {
    try { return JSON.parse(localStorage.getItem(APPROVAL_PREFS_KEY) ?? '{}'); }
    catch { return {}; }
  };
  interface ApprovalPrefs {
    requireBudgetChange: boolean;
    requireTimelineChange: boolean;
    requireScopeChange: boolean;
    requireStatusToActive: boolean;
    autoApproveEnabled: boolean;
    autoApproveThresholdPct: number;
  }
  const APPROVAL_DEFAULTS: ApprovalPrefs = {
    requireBudgetChange: true,
    requireTimelineChange: false,
    requireScopeChange: true,
    requireStatusToActive: false,
    autoApproveEnabled: true,
    autoApproveThresholdPct: 5,
  };
  const [approvalPrefs, setApprovalPrefs] = useState<ApprovalPrefs>(() => ({
    ...APPROVAL_DEFAULTS,
    ...loadApprovalPrefs(),
  }));
  const [approvalSaving, setApprovalSaving] = useState(false);

  const saveApprovalPrefs = async () => {
    setApprovalSaving(true);
    try {
      localStorage.setItem(APPROVAL_PREFS_KEY, JSON.stringify(approvalPrefs));
      // Also persist the boolean flags into the org settings features map
      await apiClient.put('/org/settings', {
        ...draft,
        features: {
          ...draft.features,
          'approval.require_status':    approvalPrefs.requireStatusToActive,
          'approval.require_budget':    approvalPrefs.requireBudgetChange,
          'approval.require_timeline':  approvalPrefs.requireTimelineChange,
          'approval.require_scope':     approvalPrefs.requireScopeChange,
          'approval.auto_approve':      approvalPrefs.autoApproveEnabled,
        },
      });
      notifications.show({ title: 'Saved', message: 'Approval rules updated.', color: 'teal' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save approval settings.', color: 'red' });
    } finally {
      setApprovalSaving(false);
    }
  };

  useEffect(() => { setDraft(orgSettings); setIsDirty(false); }, [orgSettings]);

  const handleChange = (key: keyof OrgConfig, val: string | null) => {
    setDraft(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleFeatureToggle = (flagKey: string, enabled: boolean) => {
    setDraft(prev => ({ ...prev, features: { ...prev.features, [flagKey]: enabled } }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/org/settings', {
        orgName: draft.orgName, orgSlug: draft.orgSlug, logoUrl: draft.logoUrl,
        primaryColor: draft.primaryColor, secondaryColor: draft.secondaryColor,
        timezone: draft.timezone, dateFormat: draft.dateFormat,
        fiscalYearStart: draft.fiscalYearStart, features: draft.features,
      });
      await refresh();
      setIsDirty(false);
      notifications.show({ title: 'Saved', message: 'Org settings updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save. Please try again.', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (ctxLoading) return <Stack gap="xs" p="md">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>;

  // ── Nav-link data sets ───────────────────────────────────────────────────
  const jiraLinks: NavItem[] = [
    { icon: <IconKey size={15} />,     label: 'Jira Credentials',  path: '/settings/jira-credentials',      desc: 'Configure Jira Cloud/Server connection' },
    { icon: <IconTicket size={15} />,  label: 'Jira Boards',       path: '/settings/jira',                  desc: 'Map Jira boards to PODs' },
    { icon: <IconHeadset size={15} />, label: 'Support Boards',    path: '/settings/support-boards',        desc: 'Configure Jira support queue boards' },
    { icon: <IconPackage size={15} />, label: 'Release Mapping',   path: '/settings/jira-release-mapping',  desc: 'Map Jira fix versions to release calendar' },
    { icon: <IconUserCog size={15} />, label: 'Resource Mapping',  path: '/settings/jira-resource-mapping', desc: 'Map Jira accounts to resources' },
  ];

  const azureLinks: NavItem[] = [
    { icon: <IconKey size={15} />, label: 'Azure DevOps Settings', path: '/settings/azure-devops', desc: 'Configure org URL, project, PAT, and repositories' },
  ];

  const systemLinks: NavItem[] = [
    { icon: <IconHistory size={15} />,       label: 'Audit Log',         path: '/settings/audit-log',     desc: 'All system actions and user activity' },
    { icon: <IconAlertTriangle size={15} />, label: 'Error Log',         path: '/settings/error-log',     desc: 'Frontend and backend errors' },
    { icon: <IconMessageReport size={15} />, label: 'Feedback Hub',      path: '/settings/feedback-hub',  desc: 'User-submitted feedback' },
    { icon: <IconArrowsShuffle size={15} />, label: 'Sidebar Order',     path: '/settings/sidebar-order', desc: 'Navigation group and item order' },
    { icon: <IconDatabase size={15} />,      label: 'Database Browser',  path: '/settings/tables',        desc: 'Raw data tables (admin only)' },
    { icon: <IconSettings size={15} />,      label: 'Timeline Settings', path: '/settings/timeline',      desc: 'Planning horizon and fiscal months' },
  ];

  const aiLinks: NavItem[] = [
    { icon: <IconBrain size={15} />, label: 'NLP Configuration', path: '/settings/nlp',           desc: 'AI provider, model, and query strategy' },
    { icon: <IconBrain size={15} />, label: 'NLP Optimizer',     path: '/settings/nlp-optimizer', desc: 'Review and train low-confidence patterns' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Stack gap="md" style={{ minWidth: 0, width: '100%' }}>
      {/* Page header */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Admin Settings</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Branding, users, integrations, and system preferences
          </Text>
        </div>
        {activeTab === 'general' && isDirty && (
          <Group gap="xs">
            <Button variant="subtle" color="gray" size="sm"
              leftSection={<IconRefresh size={13} />}
              onClick={() => { setDraft(orgSettings); setIsDirty(false); }}>
              Discard
            </Button>
            <Button color="teal" size="sm" leftSection={<IconCheck size={13} />}
              loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </Group>
        )}
      </Group>

      <Tabs value={activeTab} onChange={handleTabChange} variant="outline" radius="sm">
        <Tabs.List mb="md">
          <Tabs.Tab value="general"       leftSection={<IconBuilding size={13} />}>General</Tabs.Tab>
          <Tabs.Tab value="users"         leftSection={<IconUserCog size={13} />}>Users &amp; Access</Tabs.Tab>
          <Tabs.Tab value="jira"          leftSection={<IconPlugConnected size={13} />}>Integrations</Tabs.Tab>
          <Tabs.Tab value="notifications" leftSection={<IconBell size={13} />}>Notifications &amp; Email</Tabs.Tab>
          <Tabs.Tab value="system"        leftSection={<IconSettings size={13} />}>System</Tabs.Tab>
          <Tabs.Tab value="approvals"     leftSection={<IconListCheck size={13} />}>Approvals</Tabs.Tab>
        </Tabs.List>

        {/* ── GENERAL (Branding + Workspace side by side) ─── */}
        <Tabs.Panel value="general">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" style={{ alignItems: 'start' }}>

            {/* LEFT: Branding ──────────────────────────── */}
            <Stack gap="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                Branding
              </Text>

              {/* Org Identity */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Organization Identity
                </Text>
                <Group gap="md" align="flex-start" wrap="nowrap">
                  {/* Logo block */}
                  <Stack align="center" gap="xs" style={{
                    padding: '12px 10px',
                    border: '1px dashed var(--mantine-color-default-border)',
                    borderRadius: 10,
                    flexShrink: 0,
                  }}>
                    <Box style={{
                      width: 64, height: 64, borderRadius: 14,
                      background: `linear-gradient(135deg, ${draft.secondaryColor} 0%, ${draft.primaryColor} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(12,35,64,0.16)',
                    }}>
                      {draft.logoUrl
                        ? <img src={draft.logoUrl} alt="logo" style={{ width: 46, height: 46, objectFit: 'contain', borderRadius: 8 }} />
                        : <Text style={{ color: '#fff', fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                            {(draft.orgName || 'A').charAt(0).toUpperCase()}
                          </Text>
                      }
                    </Box>
                    <FileButton onChange={() => notifications.show({ title: 'Coming soon', message: 'Logo upload coming soon', color: 'blue' })} accept="image/*">
                      {(props) => (
                        <Button {...props} variant="subtle" size="xs" color="teal"
                          leftSection={<IconUpload size={11} />}>
                          Upload
                        </Button>
                      )}
                    </FileButton>
                  </Stack>

                  {/* Fields */}
                  <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <TextInput
                      label="Organization Name"
                      value={draft.orgName}
                      onChange={e => handleChange('orgName', e.target.value)}
                      placeholder="e.g. Acme Corp Engineering"
                      size="sm"
                      styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 } }}
                    />
                    <TextInput
                      label="Org Slug"
                      value={draft.orgSlug}
                      onChange={e => handleChange('orgSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      placeholder="acme-eng"
                      size="sm"
                      leftSectionWidth={68}
                      leftSection={
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
                          epp.app/
                        </Text>
                      }
                      styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 } }}
                    />
                  </Stack>
                </Group>
              </Paper>

              {/* Logo URL */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} size="sm" mb="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Logo
                </Text>
                <TextInput
                  label="Logo URL"
                  value={draft.logoUrl ?? ''}
                  onChange={e => handleChange('logoUrl', e.target.value || null)}
                  placeholder="https://example.com/logo.png"
                  size="sm"
                  description="Full URL to your organization logo image"
                  styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                />
                {draft.logoUrl && (
                  <Box mt="sm">
                    <Text size="xs" fw={500} mb="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      Preview:
                    </Text>
                    <Box style={{
                      padding: 8,
                      border: '1px solid var(--mantine-color-default-border)',
                      borderRadius: 6,
                      background: 'var(--mantine-color-body)',
                    }}>
                      <img 
                        src={draft.logoUrl} 
                        alt="logo preview" 
                        style={{ maxWidth: 100, maxHeight: 60, objectFit: 'contain' }}
                        onError={() => {
                          // Image failed to load
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </Paper>

              {/* Accent Colors */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} size="sm" mb="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Accent Colors
                </Text>
                <SimpleGrid cols={2} spacing="sm" mb="md">
                  <ColorInput
                    label="Primary"
                    value={draft.primaryColor}
                    onChange={v => handleChange('primaryColor', v)}
                    format="hex"
                    size="sm"
                    description="Buttons, active states"
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                  <ColorInput
                    label="Secondary"
                    value={draft.secondaryColor}
                    onChange={v => handleChange('secondaryColor', v)}
                    format="hex"
                    size="sm"
                    description="Sidebar background"
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                </SimpleGrid>

                {/* Compact live preview */}
                <Box style={{
                  borderRadius: 10, overflow: 'hidden',
                  border: '1px solid var(--mantine-color-default-border)',
                  display: 'flex', height: 140,
                }}>
                  {/* Sidebar strip */}
                  <Box style={{
                    width: 130, background: draft.secondaryColor,
                    padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
                  }}>
                    <Box style={{ padding: '0 8px 8px', borderBottom: `1px solid rgba(255,255,255,0.08)`, marginBottom: 4 }}>
                      <Group gap={5}>
                        <Box style={{ width: 20, height: 20, borderRadius: 4, background: draft.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: draft.secondaryColor, fontWeight: 800, fontSize: 10, fontFamily: FONT_FAMILY }}>
                            {(draft.orgName || 'A').charAt(0).toUpperCase()}
                          </Text>
                        </Box>
                        <Text size="10px" fw={700} style={{ color: '#fff', fontFamily: FONT_FAMILY, opacity: 0.9 }} truncate>
                          {draft.orgName || 'Your Org'}
                        </Text>
                      </Group>
                    </Box>
                    {['Dashboard', 'Projects', 'Resources'].map((item, i) => (
                      <Box key={item} style={{
                        padding: '4px 8px', margin: '0 6px', borderRadius: 5,
                        background: i === 0 ? `${draft.primaryColor}22` : 'transparent',
                        borderLeft: i === 0 ? `2px solid ${draft.primaryColor}` : '2px solid transparent',
                      }}>
                        <Text size="9px" style={{
                          color: i === 0 ? draft.primaryColor : 'rgba(255,255,255,0.5)',
                          fontFamily: FONT_FAMILY, fontWeight: i === 0 ? 700 : 400,
                        }}>{item}</Text>
                      </Box>
                    ))}
                    <Box style={{ marginTop: 'auto', padding: '6px 8px' }}>
                      <Text size="9px" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: FONT_FAMILY }}>v30.0</Text>
                    </Box>
                  </Box>
                  {/* Main area */}
                  <Box style={{ flex: 1, background: 'var(--mantine-color-default)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Group justify="space-between" align="center">
                      <Text size="xs" fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Dashboard</Text>
                      <Badge size="xs" style={{ background: draft.primaryColor, color: '#fff', fontFamily: FONT_FAMILY }}>Preview</Badge>
                    </Group>
                    <Box style={{ height: 1, background: 'var(--mantine-color-default-border)' }} />
                    <SimpleGrid cols={3} spacing={6}>
                      {['Projects', 'Resources', 'Capacity'].map(card => (
                        <Box key={card} style={{
                          background: 'var(--mantine-color-body)', borderRadius: 5,
                          padding: '6px 8px', border: '1px solid var(--mantine-color-default-border)',
                          borderTop: `2px solid ${draft.primaryColor}`,
                        }}>
                          <Text size="9px" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{card}</Text>
                          <Text size="10px" fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>—</Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                </Box>
                <Text size="xs" c="dimmed" mt="xs" style={{ fontFamily: FONT_FAMILY }}>
                  Live preview — changes apply after saving.
                </Text>
              </Paper>
            </Stack>

            {/* RIGHT: Workspace ────────────────────────── */}
            <Stack gap="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                Workspace
              </Text>

              {/* Regional */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} size="sm" mb="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Regional Settings
                </Text>
                <SimpleGrid cols={2} spacing="sm">
                  <Select label="Timezone" data={TIMEZONES} value={draft.timezone}
                    onChange={val => handleChange('timezone', val)} searchable size="sm"
                    styles={{ label: { fontFamily: FONT_FAMILY } }} />
                  <Select label="Fiscal Year Start" data={MONTHS} value={draft.fiscalYearStart}
                    onChange={val => handleChange('fiscalYearStart', val)} size="sm"
                    styles={{ label: { fontFamily: FONT_FAMILY } }} />
                </SimpleGrid>
              </Paper>

              {/* Feature Flags */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} size="sm" mb={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Feature Flags</Text>
                <Text size="xs" c="dimmed" mb="sm" style={{ fontFamily: FONT_FAMILY }}>
                  Disabled features are hidden from the sidebar for all users.
                </Text>
                <Stack gap={0}>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: '0.06em', fontFamily: FONT_FAMILY }}>Modules</Text>
                  {[
                    { key: 'jira',            label: 'Jira Integration',       desc: 'POD Dashboard, Releases, Actuals, Support Queue' },
                    { key: 'engineering',     label: 'Engineering Analytics',  desc: 'DORA, Git Intelligence, Sprint Retro' },
                    { key: 'simulations',     label: 'Simulators',             desc: 'Timeline & Scenario Simulators' },
                    { key: 'advanced_people', label: 'Advanced People',        desc: 'Capacity Forecast, Skills Matrix, Team Pulse' },
                    { key: 'financials',      label: 'Financial Tracking',     desc: 'Budget & CapEx / OpEx' },
                  ].map(flag => (
                    <Group key={flag.key} justify="space-between" wrap="nowrap" py="xs"
                      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                      <div>
                        <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{flag.label}</Text>
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{flag.desc}</Text>
                      </div>
                      <Switch checked={draft.features?.[flag.key] ?? true}
                        onChange={e => handleFeatureToggle(flag.key, e.currentTarget.checked)}
                        color="teal" size="sm" />
                    </Group>
                  ))}
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" mt="sm" mb="xs" style={{ letterSpacing: '0.06em', fontFamily: FONT_FAMILY }}>Features</Text>
                  {[
                    { key: 'ai',    label: 'AI Features',   desc: 'Ask AI, Smart Notifications — requires API key' },
                    { key: 'okr',   label: 'OKR Tracking',  desc: 'Objectives & Key Results management' },
                    { key: 'risk',  label: 'Risk Register', desc: 'Risk and issue tracking across projects' },
                    { key: 'ideas', label: 'Ideas Board',   desc: 'Team idea submission and voting' },
                  ].map(flag => (
                    <Group key={flag.key} justify="space-between" wrap="nowrap" py="xs"
                      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                      <div>
                        <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{flag.label}</Text>
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{flag.desc}</Text>
                      </div>
                      <Switch checked={draft.features?.[flag.key] ?? true}
                        onChange={e => handleFeatureToggle(flag.key, e.currentTarget.checked)}
                        color="teal" size="sm" />
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {/* Timeline embedded */}
              <TimelineSettingsPage embedded />
            </Stack>
          </SimpleGrid>
        </Tabs.Panel>

        {/* ── USERS & ACCESS ─── */}
        <Tabs.Panel value="users">
          <UserManagementPage embedded />
        </Tabs.Panel>

        {/* ── INTEGRATIONS ─── */}
        <Tabs.Panel value="jira">
          <Stack gap="lg">

            {/* Jira */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="teal" size={24} radius="md">
                  <IconTicket size={13} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Jira</Text>
              </Group>
              <NavGrid items={jiraLinks} color="teal" cols={3} />
            </Stack>

            {/* Project Sync */}
            <JiraEpicSyncPanel
              schedule={schedule}
              setSchedule={setSchedule}
              scheduleSaving={scheduleSaving}
              handleScheduleSave={handleScheduleSave}
            />

            <Divider />

            {/* Azure DevOps */}
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size={24} radius="md">
                  <IconBrandAzure size={13} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Azure DevOps</Text>
              </Group>
              <NavGrid items={azureLinks} color="blue" cols={1} />
            </Stack>

            <Divider />

            {/* SSO / OIDC — gated by 'sso' feature flag */}
            {draft.features?.sso ? (
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="violet" size={24} radius="md">
                      <IconShield size={13} />
                    </ThemeIcon>
                    <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      SSO / OIDC
                    </Text>
                    <Badge size="xs" color={sso.enabled ? 'violet' : 'gray'} variant="light">
                      {sso.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Group>
                  <Switch
                    size="sm"
                    color="violet"
                    label="Enable SSO"
                    checked={sso.enabled}
                    onChange={e => setSso(p => ({ ...p, enabled: e.currentTarget.checked }))}
                  />
                </Group>

                <Paper withBorder radius="md" p="md">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Select
                      label="Identity provider"
                      size="sm"
                      value={sso.provider}
                      onChange={v => setSso(p => ({ ...p, provider: v ?? 'GOOGLE' }))}
                      data={[
                        { value: 'GOOGLE',    label: 'Google Workspace' },
                        { value: 'MICROSOFT', label: 'Microsoft Entra ID' },
                        { value: 'OKTA',      label: 'Okta' },
                        { value: 'CUSTOM',    label: 'Custom OIDC' },
                      ]}
                    />
                    <TextInput
                      label="Client ID"
                      size="sm"
                      placeholder="OAuth2 client ID"
                      value={sso.clientId}
                      onChange={e => setSso(p => ({ ...p, clientId: e.currentTarget.value }))}
                    />
                    <PasswordInput
                      label="Client secret"
                      size="sm"
                      placeholder={ssoSecretSet ? '••••••••  (set — enter new to change)' : 'OAuth2 client secret'}
                      value={sso.clientSecret}
                      onChange={e => setSso(p => ({ ...p, clientSecret: e.currentTarget.value }))}
                      description="Stored server-side; never exposed in the UI"
                    />
                    <Box>
                      <TextInput
                        label="Redirect URI"
                        size="sm"
                        placeholder="https://yourdomain.com/login/oauth2/code/sso"
                        value={sso.redirectUri}
                        onChange={e => setSso(p => ({ ...p, redirectUri: e.currentTarget.value }))}
                        rightSection={
                          sso.redirectUri ? (
                            <Tooltip label="Copy">
                              <IconCopy
                                size={14}
                                style={{ cursor: 'pointer', color: 'var(--mantine-color-dimmed)' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(sso.redirectUri);
                                  notifications.show({ message: 'Redirect URI copied', color: 'teal', autoClose: 2000 });
                                }}
                              />
                            </Tooltip>
                          ) : undefined
                        }
                      />
                    </Box>
                    {(sso.provider === 'OKTA' || sso.provider === 'CUSTOM') && (
                      <TextInput
                        label="OIDC Discovery URL"
                        size="sm"
                        placeholder="https://your-domain/.well-known/openid-configuration"
                        value={sso.discoveryUrl}
                        onChange={e => setSso(p => ({ ...p, discoveryUrl: e.currentTarget.value }))}
                        description="Required for Okta and Custom OIDC providers"
                      />
                    )}
                  </SimpleGrid>

                  <Group justify="flex-end" mt="md" gap="xs">
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<IconLink size={13} />}
                      disabled={!sso.clientId}
                      onClick={() => notifications.show({ title: 'Test connection', message: 'Full OIDC flow test will be available once SSO auth flow is configured.', color: 'blue', autoClose: 4000 })}
                    >
                      Test connection
                    </Button>
                    <Button
                      color="violet"
                      size="sm"
                      leftSection={<IconCheck size={13} />}
                      loading={ssoSaving}
                      onClick={handleSsoSave}
                    >
                      Save SSO config
                    </Button>
                  </Group>
                </Paper>
              </Stack>
            ) : (
              <Paper withBorder radius="md" p="md"
                style={{ borderStyle: 'dashed', background: 'var(--mantine-color-default-hover)' }}>
                <Group gap="sm">
                  <ThemeIcon variant="light" color="gray" size={28} radius="md">
                    <IconShield size={14} />
                  </ThemeIcon>
                  <Box>
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>SSO / OIDC — Enterprise Auth</Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      Enable the <strong>sso</strong> feature flag in General → Features to configure
                      Google Workspace, Microsoft Entra, Okta, or Custom OIDC single sign-on.
                    </Text>
                  </Box>
                </Group>
              </Paper>
            )}

          </Stack>
        </Tabs.Panel>

        {/* ── NOTIFICATIONS & EMAIL ─── */}
        <Tabs.Panel value="notifications">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" style={{ alignItems: 'start' }}>

            {/* LEFT: Notification info + SMTP ───── */}
            <Stack gap="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                Notifications
              </Text>

              {/* In-app bell */}
              <Paper withBorder p="md" radius="md">
                <Group gap="sm" mb="sm">
                  <ThemeIcon variant="light" color="orange" size={28} radius="md">
                    <IconBell size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                    In-App Notification Bell
                  </Text>
                  <Badge size="xs" color="teal" variant="light">Live</Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="sm" style={{ fontFamily: FONT_FAMILY }}>
                  Shows real-time alerts for <strong>Blocker</strong> and <strong>Critical</strong> Jira
                  tickets from your linked support boards. Requires Jira credentials under{' '}
                  <strong>Integrations → Jira Credentials</strong>.
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge size="xs" color="red" variant="light">Requires Jira connection</Badge>
                  <Badge size="xs" color="gray" variant="light">Browser-local dismiss</Badge>
                  <Badge size="xs" color="blue" variant="light">Blocker + Critical only</Badge>
                </Group>
              </Paper>

              {/* Email delivery status */}
              <Paper withBorder p="md" radius="md">
                <Group gap="sm" mb="sm">
                  <ThemeIcon variant="light" color={smtp.enabled ? 'teal' : 'gray'} size={28} radius="md">
                    <IconMail size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                    Email Alert Delivery
                  </Text>
                  <Badge size="xs" color={smtp.enabled ? 'teal' : 'gray'} variant="light">
                    {smtp.enabled ? 'SMTP configured' : 'SMTP not configured'}
                  </Badge>
                </Group>
                <Stack gap={4}>
                  {[
                    'Project overdue alerts',
                    'Budget overrun warnings',
                    'Capacity threshold alerts',
                    'New risk logged',
                    'Support queue staleness',
                    'AI weekly digest',
                  ].map(item => (
                    <Group key={item} justify="space-between" wrap="nowrap"
                           style={{ opacity: smtp.enabled ? 1 : 0.45 }}>
                      <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{item}</Text>
                      <Tooltip label={smtp.enabled ? 'Active' : 'Requires SMTP'} position="left" withArrow>
                        <Switch disabled color="teal" size="xs" />
                      </Tooltip>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {/* Notification schedule */}
              <Paper withBorder p="md" radius="md">
                <Group gap="sm" mb="sm">
                  <ThemeIcon variant="light" color="orange" size={28} radius="md">
                    <IconClock size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                    Notification Schedule
                  </Text>
                </Group>
                <Stack gap="sm">
                  <TextInput
                    label="Recipients"
                    placeholder="alice@company.com, bob@company.com"
                    description="Comma-separated. Used by digest and staleness alerts."
                    value={schedule.recipients}
                    onChange={e => setSchedule((p: ScheduleDraft) => ({ ...p, recipients: e.target.value }))}
                    size="sm"
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                  <Divider label="Weekly Portfolio Digest" labelPosition="left" />
                  <Group gap="sm" align="flex-start">
                    <Switch label="Enable" size="sm" color="teal"
                      checked={schedule.digestEnabled}
                      onChange={e => setSchedule((p: ScheduleDraft) => ({ ...p, digestEnabled: e.currentTarget.checked }))}
                      mt={6} />
                    <TextInput label="Cron" placeholder="0 0 8 * * MON"
                      value={schedule.digestCron}
                      onChange={e => setSchedule((p: ScheduleDraft) => ({ ...p, digestCron: e.target.value }))}
                      description="sec min hr day month weekday"
                      size="sm" style={{ flex: 1 }}
                      styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }} />
                  </Group>
                  <Divider label="Support Staleness Alert" labelPosition="left" />
                  <Group gap="sm" align="flex-start">
                    <Switch label="Enable" size="sm" color="teal"
                      checked={schedule.stalenessEnabled}
                      onChange={e => setSchedule((p: ScheduleDraft) => ({ ...p, stalenessEnabled: e.currentTarget.checked }))}
                      mt={6} />
                    <TextInput label="Cron" placeholder="0 0 9 * * MON"
                      value={schedule.stalenessCron}
                      onChange={e => setSchedule((p: ScheduleDraft) => ({ ...p, stalenessCron: e.target.value }))}
                      description="sec min hr day month weekday"
                      size="sm" style={{ flex: 1 }}
                      styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }} />
                  </Group>
                </Stack>
                <Button mt="sm" size="xs" color="teal" leftSection={<IconCheck size={12} />}
                  loading={scheduleSaving} onClick={handleScheduleSave}>
                  Save Schedule
                </Button>
              </Paper>
            </Stack>

            {/* RIGHT: SMTP + AI ────────────────────── */}
            <Stack gap="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                Email / SMTP
              </Text>

              <Paper withBorder p="md" radius="md">
                <Group gap="sm" mb="md">
                  <ThemeIcon variant="light" color="teal" size={28} radius="md">
                    <IconMail size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                    SMTP Server
                  </Text>
                  <Switch label="Enable" size="sm" color="teal"
                    checked={smtp.enabled}
                    onChange={e => setSmtp(p => ({ ...p, enabled: e.currentTarget.checked }))} />
                </Group>

                <Stack gap="sm">
                  <SimpleGrid cols={2} spacing="sm">
                    <TextInput label="SMTP Host" placeholder="smtp.gmail.com" size="sm"
                      value={smtp.host} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} />
                    <NumberInput label="Port" placeholder="587" value={smtp.port} min={1} max={65535}
                      size="sm" onChange={v => setSmtp(p => ({ ...p, port: Number(v) || 587 }))} />
                  </SimpleGrid>
                  <TextInput label="Username" placeholder="your@gmail.com" size="sm"
                    value={smtp.username} onChange={e => setSmtp(p => ({ ...p, username: e.target.value }))} />
                  <PasswordInput
                    label={smtp.passwordSet ? 'Password (leave blank to keep)' : 'Password'}
                    placeholder={smtp.passwordSet ? '•••••••• (stored)' : 'Enter password'}
                    size="sm" value={smtp.password}
                    onChange={e => setSmtp(p => ({ ...p, password: e.target.value }))} />
                  <TextInput label="From Address" placeholder="noreply@yourcompany.com" size="sm"
                    value={smtp.fromAddress} onChange={e => setSmtp(p => ({ ...p, fromAddress: e.target.value }))} />
                  <Switch label="Use STARTTLS (recommended)" size="sm" color="teal"
                    checked={smtp.useTls} onChange={e => setSmtp(p => ({ ...p, useTls: e.currentTarget.checked }))} />
                </Stack>

                <Group mt="md" gap="xs">
                  <Button size="xs" color="teal" leftSection={<IconCheck size={12} />}
                    loading={smtpSaving} onClick={handleSmtpSave}>
                    Save
                  </Button>
                  <Button size="xs" variant="light" color="blue"
                    leftSection={<IconPlugConnected size={12} />}
                    loading={smtpTesting} onClick={handleSmtpTest}>
                    Test Connection
                  </Button>
                  <Button size="xs" variant="light" color="teal"
                    leftSection={<IconMail size={12} />}
                    loading={smtpSendingTest} onClick={handleSmtpSendTest}
                    disabled={!smtp.enabled}>
                    Send Test Email
                  </Button>
                </Group>

                <Text size="xs" c="dimmed" mt="sm" style={{ fontFamily: FONT_FAMILY }}>
                  <strong>Gmail tip:</strong> Use <code>smtp.gmail.com</code> port <code>587</code>,
                  STARTTLS on. Password must be an <em>App Password</em> (Google Account → Security).
                </Text>
              </Paper>

              <Button
                variant="light"
                color="blue"
                size="xs"
                leftSection={<IconMail size={13} />}
                rightSection={<IconArrowRight size={13} />}
                onClick={() => navigate('/settings/email-templates')}
              >
                Customise Email Templates
              </Button>

              <Divider label={
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                  AI &amp; NLP
                </Text>
              } labelPosition="left" />

              <NavGrid items={aiLinks} color="violet" cols={1} />
            </Stack>
          </SimpleGrid>
        </Tabs.Panel>

        {/* ── SYSTEM ─── */}
        <Tabs.Panel value="system">
          <Stack gap="lg">
            <Stack gap="xs">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                System Tools
              </Text>
              <NavGrid items={systemLinks} color="blue" cols={3} />
            </Stack>

            <Divider label={
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                Reference Data
              </Text>
            } labelPosition="left" />

            <Box style={{ overflowX: 'auto', width: '100%' }}>
              <RefDataSettingsPage embedded />
            </Box>
          </Stack>
        </Tabs.Panel>

        {/* ── APPROVALS ─────────────────────────────────────────────── */}
        <Tabs.Panel value="approvals">
          <Stack gap="lg">

            {/* Header + link to queue */}
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                  Approval Workflow Configuration
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Control which project changes require human approval before taking effect.
                </Text>
              </Box>
              <Button
                variant="light"
                color="teal"
                size="xs"
                rightSection={<IconArrowRight size={13} />}
                onClick={() => navigate('/approvals')}
              >
                View Approval Queue
              </Button>
            </Group>

            {/* Section: Approval triggers */}
            <Paper withBorder radius="md" p="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, marginBottom: 12 }}>
                Approval Required When…
              </Text>
              <Stack gap="xs">
                <Switch
                  label="Budget changes (any amount)"
                  description="Require approval when a project's budget estimate is modified"
                  checked={approvalPrefs.requireBudgetChange}
                  onChange={e => setApprovalPrefs(p => ({ ...p, requireBudgetChange: e.currentTarget.checked }))}
                />
                <Switch
                  label="Timeline / deadline extension"
                  description="Require approval when the target end date is pushed out"
                  checked={approvalPrefs.requireTimelineChange}
                  onChange={e => setApprovalPrefs(p => ({ ...p, requireTimelineChange: e.currentTarget.checked }))}
                />
                <Switch
                  label="Scope change (major)"
                  description="Require approval when the project scope, deliverables, or objectives change"
                  checked={approvalPrefs.requireScopeChange}
                  onChange={e => setApprovalPrefs(p => ({ ...p, requireScopeChange: e.currentTarget.checked }))}
                />
                <Switch
                  label="Status change to Active"
                  description="Require approval before a project moves from Planning → Active"
                  checked={approvalPrefs.requireStatusToActive}
                  onChange={e => setApprovalPrefs(p => ({ ...p, requireStatusToActive: e.currentTarget.checked }))}
                />
              </Stack>
            </Paper>

            {/* Section: Auto-approve rules */}
            <Paper withBorder radius="md" p="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, marginBottom: 12 }}>
                Auto-Approve Rules
              </Text>
              <Stack gap="sm">
                <Switch
                  label="Enable auto-approve for small budget variances"
                  description="Budget changes below the threshold below are automatically approved without review"
                  checked={approvalPrefs.autoApproveEnabled}
                  onChange={e => setApprovalPrefs(p => ({ ...p, autoApproveEnabled: e.currentTarget.checked }))}
                />
                {approvalPrefs.autoApproveEnabled && (
                  <NumberInput
                    label="Auto-approve threshold (%)"
                    description="Budget changes under this percentage are auto-approved (e.g. 5 = changes under 5% of total budget)"
                    placeholder="5"
                    min={1} max={50} step={1}
                    leftSection={<IconPercentage size={13} />}
                    value={approvalPrefs.autoApproveThresholdPct}
                    onChange={v => setApprovalPrefs(p => ({ ...p, autoApproveThresholdPct: typeof v === 'number' ? v : 5 }))}
                    w={260}
                  />
                )}
              </Stack>
            </Paper>

            {/* Save */}
            <Group justify="flex-end">
              <Button
                leftSection={<IconCheck size={14} />}
                loading={approvalSaving}
                onClick={saveApprovalPrefs}
              >
                Save Approval Rules
              </Button>
            </Group>

          </Stack>
        </Tabs.Panel>

      </Tabs>
    </Stack>
  );
}
