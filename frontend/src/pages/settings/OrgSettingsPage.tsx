import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Button, TextInput, Paper, Tabs,
  ColorInput, SimpleGrid, Box, Switch, Badge, Select, Divider,
  FileButton, Loader, Center, ThemeIcon, Tooltip, NumberInput, PasswordInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding, IconPalette, IconUpload, IconCheck, IconRefresh,
  IconBell, IconWorld, IconUserCog, IconDatabase, IconHistory,
  IconAlertTriangle, IconBrain, IconMessageReport, IconArrowsShuffle,
  IconExternalLink, IconKey, IconTicket, IconPackage, IconHeadset,
  IconSettings, IconBrandAzure, IconGitBranch, IconMail, IconPlugConnected,
  IconClock,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
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

// ── System quick-links panel ─────────────────────────────────────────────────
function SystemLinksPanel() {
  const navigate = useNav();
  const links = [
    { icon: <IconHistory size={18} />,        label: 'Audit Log',         path: '/settings/audit-log',         desc: 'View all system actions and user activity' },
    { icon: <IconAlertTriangle size={18} />,  label: 'Error Log',         path: '/settings/error-log',         desc: 'Review frontend and backend errors' },
    { icon: <IconMessageReport size={18} />,  label: 'Feedback Hub',      path: '/settings/feedback-hub',      desc: 'Browse user-submitted feedback' },
    { icon: <IconArrowsShuffle size={18} />,  label: 'Sidebar Order',     path: '/settings/sidebar-order',     desc: 'Customise navigation group and item order' },
    { icon: <IconDatabase size={18} />,       label: 'Database Browser',  path: '/settings/tables',            desc: 'Browse raw data tables (admin only)' },
    { icon: <IconSettings size={18} />,       label: 'Timeline Settings', path: '/settings/timeline',          desc: 'Configure planning horizon and fiscal months' },
  ];
  return (
    <Stack gap="sm">
      {links.map(l => (
        <Paper key={l.path} withBorder p="md" radius="md" style={{ cursor: 'pointer' }}
          onClick={() => navigate(l.path)}>
          <Group gap="md">
            <ThemeIcon variant="light" color="blue" size={36} radius="md">
              {l.icon}
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{l.label}</Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{l.desc}</Text>
            </div>
            <IconExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

// ── Azure DevOps panel ──────────────────────────────────────────────────────
function AzureDevOpsPanel() {
  const navigate = useNav();
  const sections = [
    { icon: <IconKey size={18} />,       label: 'Azure DevOps Settings', path: '/settings/azure-devops', desc: 'Configure organisation URL, project, PAT, and repositories' },
    { icon: <IconGitBranch size={18} />, label: 'Git Intelligence',       path: '/reports/engineering-intelligence', desc: 'View PR activity, commit frequency, and branch health' },
  ];
  return (
    <Stack gap="sm">
      {sections.map(s => (
        <Paper key={s.path} withBorder p="md" radius="md" style={{ cursor: 'pointer' }}
          onClick={() => navigate(s.path)}>
          <Group gap="md">
            <ThemeIcon variant="light" color="blue" size={36} radius="md">
              {s.icon}
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{s.label}</Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{s.desc}</Text>
            </div>
            <IconExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

// ── Jira hub panel ──────────────────────────────────────────────────────────
function JiraHubPanel() {
  const navigate = useNav();
  const sections = [
    { icon: <IconKey size={18} />,     label: 'Jira Credentials',       path: '/settings/jira-credentials',       desc: 'Configure Jira Cloud/Server connection' },
    { icon: <IconTicket size={18} />,  label: 'Jira Boards',            path: '/settings/jira',                   desc: 'Map Jira boards to PODs' },
    { icon: <IconHeadset size={18} />, label: 'Support Boards',         path: '/settings/support-boards',         desc: 'Configure Jira support queue boards' },
    { icon: <IconPackage size={18} />, label: 'Release Mapping',        path: '/settings/jira-release-mapping',   desc: 'Map Jira fix versions to release calendar' },
    { icon: <IconUserCog size={18} />, label: 'Resource Mapping',       path: '/settings/jira-resource-mapping',  desc: 'Map Jira accounts to resources' },
  ];
  return (
    <Stack gap="sm">
      {sections.map(s => (
        <Paper key={s.path} withBorder p="md" radius="md" style={{ cursor: 'pointer' }}
          onClick={() => navigate(s.path)}>
          <Group gap="md">
            <ThemeIcon variant="light" color="teal" size={36} radius="md">
              {s.icon}
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{s.label}</Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{s.desc}</Text>
            </div>
            <IconExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

// ── Main Settings Hub ────────────────────────────────────────────────────────
export default function OrgSettingsPage() {
  const navigate = useNav();
  const [searchParams] = useSearchParams();
  const { orgSettings, loading: ctxLoading, refresh } = useOrgSettings();

  const [draft, setDraft]       = useState<OrgConfig>(orgSettings);
  const [isDirty, setIsDirty]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(searchParams.get('tab') ?? 'branding');

  // ── SMTP config state ────────────────────────────────────────────────────
  interface SmtpDraft {
    host: string; port: number; username: string; password: string;
    fromAddress: string; useTls: boolean; enabled: boolean; passwordSet: boolean;
  }
  const [smtp, setSmtp]           = useState<SmtpDraft>({
    host: 'smtp.gmail.com', port: 587, username: '', password: '',
    fromAddress: 'noreply@portfolioplanner', useTls: true, enabled: false, passwordSet: false,
  });
  const [smtpLoaded, setSmtpLoaded]     = useState(false);
  const [smtpSaving, setSmtpSaving]     = useState(false);
  const [smtpTesting, setSmtpTesting]   = useState(false);

  // ── Notification schedule state ──────────────────────────────────────────
  interface ScheduleDraft {
    recipients: string;
    digestEnabled: boolean; digestCron: string;
    stalenessEnabled: boolean; stalenessCron: string;
  }
  const [schedule, setSchedule]       = useState<ScheduleDraft>({
    recipients: '', digestEnabled: false, digestCron: '0 0 8 * * MON',
    stalenessEnabled: false, stalenessCron: '0 0 9 * * MON',
  });
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'email' && !smtpLoaded) {
      apiClient.get('/settings/smtp').then(({ data }) => {
        setSmtp({
          host:        data.host        ?? 'smtp.gmail.com',
          port:        data.port        ?? 587,
          username:    data.username    ?? '',
          password:    '',   // never pre-filled
          fromAddress: data.fromAddress ?? 'noreply@portfolioplanner',
          useTls:      data.useTls      ?? true,
          enabled:     data.enabled     ?? false,
          passwordSet: data.passwordSet ?? false,
        });
        setSmtpLoaded(true);
      }).catch(() => {});
    }
  }, [activeTab, smtpLoaded]);

  useEffect(() => {
    if (activeTab === 'email' && !scheduleLoaded) {
      apiClient.get('/settings/notification-schedule').then(({ data }) => {
        setSchedule({
          recipients:       data.recipients       ?? '',
          digestEnabled:    data.digestEnabled    ?? false,
          digestCron:       data.digestCron       ?? '0 0 8 * * MON',
          stalenessEnabled: data.stalenessEnabled ?? false,
          stalenessCron:    data.stalenessCron    ?? '0 0 9 * * MON',
        });
        setScheduleLoaded(true);
      }).catch(() => {});
    }
  }, [activeTab, scheduleLoaded]);

  const handleScheduleSave = async () => {
    setScheduleSaving(true);
    try {
      await apiClient.put('/settings/notification-schedule', schedule);
      notifications.show({ title: 'Saved', message: 'Notification schedule saved successfully', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save notification schedule', color: 'red' });
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
      notifications.show({ title: 'Saved', message: 'SMTP settings saved successfully', color: 'green' });
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

  useEffect(() => {
    setDraft(orgSettings);
    setIsDirty(false);
  }, [orgSettings]);

  const handleChange = (key: keyof OrgConfig, val: string | null) => {
    setDraft(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleFeatureToggle = (flagKey: string, enabled: boolean) => {
    setDraft(prev => ({
      ...prev,
      features: { ...prev.features, [flagKey]: enabled },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/org/settings', {
        orgName:         draft.orgName,
        orgSlug:         draft.orgSlug,
        logoUrl:         draft.logoUrl,
        primaryColor:    draft.primaryColor,
        secondaryColor:  draft.secondaryColor,
        timezone:        draft.timezone,
        dateFormat:      draft.dateFormat,
        fiscalYearStart: draft.fiscalYearStart,
        features:        draft.features,
      });
      await refresh();
      setIsDirty(false);
      notifications.show({ title: 'Saved', message: 'Org settings updated successfully', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save org settings. Please try again.', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(orgSettings);
    setIsDirty(false);
  };

  if (ctxLoading) {
    return <Center h={200}><Loader color="teal" /></Center>;
  }

  return (
    <Stack gap="lg">
      {/* Page header — only shown for branding/workspace/notifications */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Admin Settings</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Configure branding, users, integrations, and system preferences.
          </Text>
        </div>
        {(activeTab === 'branding' || activeTab === 'workspace' || activeTab === 'notifications') && isDirty && (
          <Group gap="sm">
            <Button variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} onClick={handleReset}>
              Discard
            </Button>
            <Button color="teal" leftSection={<IconCheck size={14} />} loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </Group>
        )}
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm">
        <Tabs.List mb="lg">
          <Tabs.Tab value="branding"      leftSection={<IconPalette size={14} />}>Branding</Tabs.Tab>
          <Tabs.Tab value="workspace"     leftSection={<IconBuilding size={14} />}>Workspace</Tabs.Tab>
          <Tabs.Tab value="users"         leftSection={<IconUserCog size={14} />}>Users &amp; Access</Tabs.Tab>
          <Tabs.Tab value="data"          leftSection={<IconDatabase size={14} />}>Reference Data</Tabs.Tab>
          <Tabs.Tab value="jira"          leftSection={<IconTicket size={14} />}>Integrations</Tabs.Tab>
          <Tabs.Tab value="notifications" leftSection={<IconBell size={14} />}>Notifications</Tabs.Tab>
          <Tabs.Tab value="email"         leftSection={<IconMail size={14} />}>Email / SMTP</Tabs.Tab>
          <Tabs.Tab value="ai"            leftSection={<IconBrain size={14} />}>AI &amp; NLP</Tabs.Tab>
          <Tabs.Tab value="system"        leftSection={<IconSettings size={14} />}>System</Tabs.Tab>
        </Tabs.List>

        {/* ── BRANDING ─── */}
        <Tabs.Panel value="branding">
          <Stack gap="lg" style={{ maxWidth: 860 }}>

            {/* ── Organization Identity ── */}
            <Paper withBorder p="lg" radius="md">
              <Text fw={700} size="sm" mb="lg" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Organization Identity
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                {/* Left: logo */}
                <Stack align="center" justify="center" gap="md"
                  style={{ padding: '24px 16px', border: '1px dashed #d0d7e2', borderRadius: 12, background: '#fafbfc' }}>
                  <Box style={{
                    width: 88, height: 88, borderRadius: 18,
                    background: `linear-gradient(135deg, ${draft.secondaryColor} 0%, ${draft.primaryColor} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 20px rgba(12,35,64,0.18)',
                    flexShrink: 0,
                  }}>
                    {draft.logoUrl ? (
                      <img src={draft.logoUrl} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10 }} />
                    ) : (
                      <Text style={{ color: '#fff', fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
                        {(draft.orgName || 'A').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </Box>
                  <Text size="xs" c="dimmed" ta="center" style={{ fontFamily: FONT_FAMILY }}>
                    Logo preview
                  </Text>
                  <FileButton onChange={() => notifications.show({ title: 'Coming soon', message: 'Logo upload coming soon', color: 'blue' })} accept="image/*">
                    {(props) => (
                      <Button {...props} variant="light" size="xs" color="teal" leftSection={<IconUpload size={13} />}>
                        Upload Logo
                      </Button>
                    )}
                  </FileButton>
                </Stack>

                {/* Right: name + slug */}
                <Stack gap="md" justify="center">
                  <TextInput
                    label="Organization Name"
                    value={draft.orgName}
                    onChange={e => handleChange('orgName', e.target.value)}
                    placeholder="e.g. Acme Corp Engineering"
                    description="Shown in the header and throughout the app"
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                  <TextInput
                    label="Org Slug"
                    value={draft.orgSlug}
                    onChange={e => handleChange('orgSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="acme-eng"
                    description="Used in URLs and API identifiers — lowercase, hyphens only"
                    leftSectionWidth={72}
                    leftSection={
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
                        epp.app/
                      </Text>
                    }
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                </Stack>
              </SimpleGrid>
            </Paper>

            {/* ── Accent Colors ── */}
            <Paper withBorder p="lg" radius="md">
              <Text fw={700} size="sm" mb={4} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Accent Colors
              </Text>
              <Text size="xs" c="dimmed" mb="lg" style={{ fontFamily: FONT_FAMILY }}>
                Customize the primary and secondary colors used across the interface. Changes apply after saving.
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <ColorInput
                  label="Primary Color"
                  value={draft.primaryColor}
                  onChange={v => handleChange('primaryColor', v)}
                  format="hex"
                  description="Action buttons, active states, highlights"
                  styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                />
                <ColorInput
                  label="Secondary Color"
                  value={draft.secondaryColor}
                  onChange={v => handleChange('secondaryColor', v)}
                  format="hex"
                  description="Sidebar and header background"
                  styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                />
              </SimpleGrid>

              <Divider my="lg" label="Live Preview" labelPosition="left" />

              {/* Sidebar-style preview */}
              <Box style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              }}>
                {/* Mock sidebar strip */}
                <Box style={{
                  display: 'flex',
                  height: 220,
                }}>
                  {/* Sidebar */}
                  <Box style={{
                    width: 180,
                    background: draft.secondaryColor,
                    borderRight: `2px solid ${draft.primaryColor}22`,
                    padding: '16px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flexShrink: 0,
                  }}>
                    {/* Logo row */}
                    <Box style={{ padding: '0 12px 12px', borderBottom: `1px solid rgba(255,255,255,0.08)`, marginBottom: 8 }}>
                      <Group gap={8}>
                        <Box style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: draft.primaryColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: draft.secondaryColor, fontWeight: 800, fontSize: 13, fontFamily: FONT_FAMILY }}>
                            {(draft.orgName || 'A').charAt(0).toUpperCase()}
                          </Text>
                        </Box>
                        <Text size="xs" fw={700} style={{ color: '#fff', fontFamily: FONT_FAMILY, opacity: 0.9 }} truncate>
                          {draft.orgName || 'Your Org'}
                        </Text>
                      </Group>
                    </Box>
                    {/* Nav items */}
                    {[
                      { label: 'Dashboard', active: true },
                      { label: 'Projects', active: false },
                      { label: 'Resources', active: false },
                      { label: 'Analytics', active: false },
                    ].map(item => (
                      <Box key={item.label} style={{
                        padding: '6px 12px',
                        margin: '0 8px',
                        borderRadius: 6,
                        background: item.active ? `${draft.primaryColor}22` : 'transparent',
                        borderLeft: item.active ? `3px solid ${draft.primaryColor}` : '3px solid transparent',
                      }}>
                        <Text size="xs" style={{
                          color: item.active ? draft.primaryColor : 'rgba(255,255,255,0.55)',
                          fontFamily: FONT_FAMILY,
                          fontWeight: item.active ? 700 : 400,
                        }}>
                          {item.label}
                        </Text>
                      </Box>
                    ))}
                    {/* Version */}
                    <Box style={{ marginTop: 'auto', padding: '8px 12px' }}>
                      <Text size="10px" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: FONT_FAMILY }}>v12.5</Text>
                    </Box>
                  </Box>

                  {/* Main content area mock */}
                  <Box style={{ flex: 1, background: '#f8fafc', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Dashboard</Text>
                      <Badge size="sm" style={{ background: draft.primaryColor, color: '#fff', fontFamily: FONT_FAMILY, fontWeight: 600 }}>
                        Preview
                      </Badge>
                    </Group>
                    <Box style={{ height: 1, background: '#e2e8f0' }} />
                    <SimpleGrid cols={3} spacing="xs">
                      {['Projects', 'Resources', 'Capacity'].map(card => (
                        <Box key={card} style={{
                          background: '#fff',
                          borderRadius: 8,
                          padding: '10px 12px',
                          border: '1px solid #e9ecef',
                          borderTop: `3px solid ${draft.primaryColor}`,
                        }}>
                          <Text size="10px" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{card}</Text>
                          <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>—</Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                    <Button size="xs" style={{ background: draft.primaryColor, color: '#fff', alignSelf: 'flex-start', fontFamily: FONT_FAMILY }}>
                      Primary Action
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Text size="xs" c="dimmed" mt="sm" style={{ fontFamily: FONT_FAMILY }}>
                This preview reflects how your color choices appear in the sidebar and main content area.
              </Text>
            </Paper>

          </Stack>
        </Tabs.Panel>

        {/* ── WORKSPACE ─── */}
        <Tabs.Panel value="workspace">
          <Stack gap="lg" style={{ maxWidth: 860 }}>
            <Paper withBorder p="lg" radius="md">
              <Text fw={600} mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Regional Settings</Text>
              <SimpleGrid cols={2} spacing="md">
                <Select
                  label="Timezone"
                  data={TIMEZONES}
                  value={draft.timezone}
                  onChange={val => handleChange('timezone', val)}
                  searchable
                  styles={{ label: { fontFamily: FONT_FAMILY } }}
                />
                <Select
                  label="Fiscal Year Start"
                  data={MONTHS}
                  value={draft.fiscalYearStart}
                  onChange={val => handleChange('fiscalYearStart', val)}
                  styles={{ label: { fontFamily: FONT_FAMILY } }}
                />
              </SimpleGrid>
            </Paper>
            <Paper withBorder p="lg" radius="md">
              <Text fw={600} mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Feature Flags</Text>
              <Stack gap="sm">
                {[
                  { key: 'ai',         label: 'AI Features',        desc: 'Enable Ask AI, Smart Notifications, and delivery predictions', defaultOn: true  },
                  { key: 'ideas',      label: 'Ideas Board',        desc: 'Allow team members to submit and vote on ideas',               defaultOn: true  },
                  { key: 'risk',       label: 'Risk Register',      desc: 'Enable risk and issue tracking across projects',              defaultOn: true  },
                  { key: 'okr',        label: 'OKR Tracking',       desc: 'Enable Objectives & Key Results management',                  defaultOn: true  },
                  { key: 'financials', label: 'Financial Tracking', desc: 'Show budget, actuals, and CapEx/OpEx tracking',               defaultOn: false },
                ].map(flag => (
                  <Group key={flag.key} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{flag.label}</Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{flag.desc}</Text>
                    </div>
                    <Switch
                      checked={draft.features?.[flag.key] ?? flag.defaultOn}
                      onChange={e => handleFeatureToggle(flag.key, e.currentTarget.checked)}
                      color="teal"
                      size="sm"
                    />
                  </Group>
                ))}
              </Stack>
            </Paper>
            {/* Timeline settings embedded */}
            <TimelineSettingsPage embedded />
          </Stack>
        </Tabs.Panel>

        {/* ── USERS & ACCESS ─── */}
        <Tabs.Panel value="users">
          <UserManagementPage embedded />
        </Tabs.Panel>

        {/* ── REFERENCE DATA ─── */}
        <Tabs.Panel value="data">
          <RefDataSettingsPage embedded />
        </Tabs.Panel>

        {/* ── INTEGRATIONS ─── */}
        <Tabs.Panel value="jira">
          <Stack gap="xl">
            {/* Jira */}
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" color="teal" size={28} radius="md">
                  <IconTicket size={15} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Jira Configuration
                </Text>
              </Group>
              <JiraHubPanel />
            </Stack>

            <Divider />

            {/* Azure DevOps */}
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size={28} radius="md">
                  <IconBrandAzure size={15} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Azure DevOps
                </Text>
              </Group>
              <AzureDevOpsPanel />
            </Stack>
          </Stack>
        </Tabs.Panel>

        {/* ── NOTIFICATIONS ─── */}
        <Tabs.Panel value="notifications">
          <Stack gap="md" style={{ maxWidth: 860 }}>

            {/* Notification Bell — what it actually does */}
            <Paper withBorder p="lg" radius="md">
              <Group gap="sm" mb="xs">
                <ThemeIcon variant="light" color="orange" size={32} radius="md">
                  <IconBell size={16} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  In-App Notification Bell
                </Text>
                <Badge size="sm" color="teal" variant="light">Live</Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: FONT_FAMILY }}>
                The bell icon in the top-right toolbar is active and shows real-time alerts for
                <strong> Blocker</strong> and <strong>Critical</strong> Jira tickets in your linked support boards.
                Alerts are dismissed per-browser and reset on next visit if unresolved.
              </Text>
              <Divider mb="md" />
              <Stack gap="xs">
                <Group gap="xs" align="flex-start">
                  <Badge size="xs" color="red" variant="filled" style={{ marginTop: 2 }}>Requires</Badge>
                  <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    Jira credentials must be configured under <strong>Admin Settings → Jira Integration → Jira Credentials</strong>.
                    Without a Jira connection, the bell is hidden.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Badge size="xs" color="blue" variant="filled" style={{ marginTop: 2 }}>Scope</Badge>
                  <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    Monitors Blocker / Critical / Highest priority tickets from your configured Jira support boards only.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Badge size="xs" color="gray" variant="filled" style={{ marginTop: 2 }}>Storage</Badge>
                  <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    Dismissed alerts are stored in your browser's local storage — they do not sync across devices or users.
                  </Text>
                </Group>
              </Stack>
            </Paper>

            {/* Email Alerts — links to SMTP tab */}
            <Paper withBorder p="lg" radius="md">
              <Group gap="sm" mb="xs">
                <ThemeIcon variant="light" color={smtp.enabled ? 'teal' : 'gray'} size={32} radius="md">
                  <IconMail size={16} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Email Alert Delivery
                </Text>
                <Badge size="sm" color={smtp.enabled ? 'teal' : 'gray'} variant="light">
                  {smtp.enabled ? 'Configured' : 'Not configured'}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: FONT_FAMILY }}>
                Email delivery for alerts (overdue projects, capacity thresholds, risk notifications)
                requires an SMTP server connection.
                {!smtp.enabled && ' Configure it in the Email / SMTP tab.'}
              </Text>
              <Divider mb="md" />
              <Stack gap="xs">
                {[
                  { label: 'Project overdue alerts',    desc: 'Alert when a project passes its target date' },
                  { label: 'Budget overrun warnings',   desc: 'Alert when project spending exceeds budget' },
                  { label: 'Capacity threshold alerts', desc: 'Alert when utilization exceeds 90%' },
                  { label: 'New risk logged',            desc: 'Notify owner when a critical risk is filed' },
                  { label: 'Support queue staleness',   desc: 'Alert when tickets are stale for 48h' },
                  { label: 'AI weekly digest',          desc: 'Weekly AI-generated portfolio summary email' },
                ].map(item => (
                  <Group key={item.label} justify="space-between" wrap="nowrap"
                         style={{ opacity: smtp.enabled ? 1 : 0.5 }}>
                    <div>
                      <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{item.label}</Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{item.desc}</Text>
                    </div>
                    <Tooltip label={smtp.enabled ? 'SMTP configured' : 'Requires SMTP configuration'}
                             position="left" withArrow>
                      <Switch disabled color="teal" size="sm" />
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
              {!smtp.enabled && (
                <Button size="xs" variant="light" color="teal" mt="md"
                        leftSection={<IconMail size={12} />}
                        onClick={() => setActiveTab('email')}>
                  Configure SMTP
                </Button>
              )}
            </Paper>

          </Stack>
        </Tabs.Panel>

        {/* ── EMAIL / SMTP ─── */}
        <Tabs.Panel value="email">
          <Stack gap="md" style={{ maxWidth: 640 }}>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Configure the outbound SMTP server used for email alerts and the weekly digest.
              Changes take effect immediately — no server restart required.
            </Text>

            <Paper withBorder p="lg" radius="md">
              <Group gap="sm" mb="lg">
                <ThemeIcon variant="light" color="teal" size={32} radius="md">
                  <IconMail size={16} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  SMTP Server
                </Text>
                <Switch
                  label="Enable email delivery"
                  size="sm"
                  color="teal"
                  checked={smtp.enabled}
                  onChange={e => setSmtp(p => ({ ...p, enabled: e.currentTarget.checked }))}
                />
              </Group>

              <Stack gap="sm">
                <SimpleGrid cols={2} spacing="sm">
                  <TextInput
                    label="SMTP Host"
                    placeholder="smtp.gmail.com"
                    value={smtp.host}
                    onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))}
                  />
                  <NumberInput
                    label="Port"
                    placeholder="587"
                    value={smtp.port}
                    min={1}
                    max={65535}
                    onChange={v => setSmtp(p => ({ ...p, port: Number(v) || 587 }))}
                  />
                </SimpleGrid>

                <TextInput
                  label="Username"
                  placeholder="your@gmail.com"
                  value={smtp.username}
                  onChange={e => setSmtp(p => ({ ...p, username: e.target.value }))}
                />

                <PasswordInput
                  label={smtp.passwordSet ? 'Password (leave blank to keep current)' : 'Password'}
                  placeholder={smtp.passwordSet ? '••••••••  (stored)' : 'Enter password'}
                  value={smtp.password}
                  onChange={e => setSmtp(p => ({ ...p, password: e.target.value }))}
                />

                <TextInput
                  label="From Address"
                  placeholder="noreply@yourcompany.com"
                  value={smtp.fromAddress}
                  onChange={e => setSmtp(p => ({ ...p, fromAddress: e.target.value }))}
                />

                <Switch
                  label="Use STARTTLS (recommended)"
                  size="sm"
                  color="teal"
                  checked={smtp.useTls}
                  onChange={e => setSmtp(p => ({ ...p, useTls: e.currentTarget.checked }))}
                />
              </Stack>

              <Group mt="lg" gap="sm">
                <Button
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  loading={smtpSaving}
                  onClick={handleSmtpSave}
                >
                  Save Settings
                </Button>
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconPlugConnected size={14} />}
                  loading={smtpTesting}
                  onClick={handleSmtpTest}
                >
                  Test Connection
                </Button>
              </Group>
            </Paper>

            <Paper withBorder p="md" radius="md" style={{ background: '#f8fafb' }}>
              <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>
                Gmail / Google Workspace tip
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                Use <strong>smtp.gmail.com</strong>, port <strong>587</strong>, STARTTLS enabled.
                Your password must be an <strong>App Password</strong> (not your account password).
                Generate one at <em>Google Account → Security → App Passwords</em>.
              </Text>
            </Paper>

            {/* ── Notification Schedule ── */}
            <Paper withBorder p="lg" radius="md">
              <Group gap="sm" mb="lg">
                <ThemeIcon variant="light" color="orange" size={32} radius="md">
                  <IconClock size={16} />
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Notification Schedule
                </Text>
              </Group>

              <Stack gap="sm">
                <TextInput
                  label="Recipients"
                  placeholder="alice@company.com, bob@company.com"
                  description="Comma-separated email addresses. Used by both digest and staleness alerts."
                  value={schedule.recipients}
                  onChange={e => setSchedule(p => ({ ...p, recipients: e.target.value }))}
                  styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                />

                <Divider label="Weekly Portfolio Digest" labelPosition="left" mt="xs" />
                <Group gap="md" align="flex-start">
                  <Switch
                    label="Enable weekly digest"
                    size="sm"
                    color="teal"
                    checked={schedule.digestEnabled}
                    onChange={e => setSchedule(p => ({ ...p, digestEnabled: e.currentTarget.checked }))}
                    mt={6}
                  />
                  <TextInput
                    label="Cron expression"
                    placeholder="0 0 8 * * MON"
                    value={schedule.digestCron}
                    onChange={e => setSchedule(p => ({ ...p, digestCron: e.target.value }))}
                    description="Spring cron: sec min hr day month weekday"
                    style={{ flex: 1 }}
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                </Group>

                <Divider label="Support Staleness Alert" labelPosition="left" mt="xs" />
                <Group gap="md" align="flex-start">
                  <Switch
                    label="Enable staleness alert"
                    size="sm"
                    color="teal"
                    checked={schedule.stalenessEnabled}
                    onChange={e => setSchedule(p => ({ ...p, stalenessEnabled: e.currentTarget.checked }))}
                    mt={6}
                  />
                  <TextInput
                    label="Cron expression"
                    placeholder="0 0 9 * * MON"
                    value={schedule.stalenessCron}
                    onChange={e => setSchedule(p => ({ ...p, stalenessCron: e.target.value }))}
                    description="Spring cron: sec min hr day month weekday"
                    style={{ flex: 1 }}
                    styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600 }, description: { fontFamily: FONT_FAMILY } }}
                  />
                </Group>
              </Stack>

              <Group mt="lg" gap="sm">
                <Button
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  loading={scheduleSaving}
                  onClick={handleScheduleSave}
                >
                  Save Schedule
                </Button>
              </Group>
            </Paper>

            <Paper withBorder p="md" radius="md" style={{ background: '#f8fafb' }}>
              <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>
                Cron expression reference
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                Format: <strong>sec min hr day month weekday</strong> — e.g.{' '}
                <code>0 0 8 * * MON</code> = every Monday at 08:00,{' '}
                <code>0 0 9 * * MON,FRI</code> = Monday &amp; Friday at 09:00.
                Changes take effect at the next scheduled tick with no restart required.
              </Text>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ── AI & NLP ─── */}
        <Tabs.Panel value="ai">
          <Stack gap="sm" style={{ maxWidth: 860 }}>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Configure AI and NLP settings. Each section opens its dedicated configuration page.
            </Text>
            {[
              { icon: <IconBrain size={18} />, label: 'NLP Configuration',   path: '/settings/nlp',           desc: 'Configure AI provider, model, and query strategy' },
              { icon: <IconBrain size={18} />, label: 'NLP Optimizer',       path: '/settings/nlp-optimizer', desc: 'Review and train low-confidence query patterns' },
            ].map(s => (
              <Paper key={s.path} withBorder p="md" radius="md" style={{ cursor: 'pointer' }}
                onClick={() => navigate(s.path)}>
                <Group gap="md">
                  <ThemeIcon variant="light" color="violet" size={36} radius="md">{s.icon}</ThemeIcon>
                  <div>
                    <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{s.label}</Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{s.desc}</Text>
                  </div>
                  <IconExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Group>
              </Paper>
            ))}
          </Stack>
        </Tabs.Panel>

        {/* ── SYSTEM ─── */}
        <Tabs.Panel value="system">
          <Stack gap="lg" style={{ maxWidth: 860 }}>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              System administration tools. Admin-only access.
            </Text>
            <SystemLinksPanel />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
