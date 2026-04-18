/**
 * EmailTemplatesPage — admin UI for customising email template subjects and bodies.
 *
 * Each known template (approval-pending, approval-decision, etc.) is shown as a
 * card.  Clicking "Edit" opens a modal with:
 *   • Subject TextInput  (supports {{variable}} tokens)
 *   • HTML Body Textarea (supports {{variable}} tokens)
 *   • Live preview pane (rendered in an <iframe srcDoc>)
 *   • Variable reference cheat-sheet
 *
 * Saving POSTs to PUT /api/settings/email-templates/{name}.
 * Reset reverts to the Thymeleaf default.
 */
import { useState, useRef } from 'react';
import {
  Title, Text, Stack, Group, Button, Paper, Badge, Skeleton,
  Alert, Modal, TextInput, Tabs, ThemeIcon, ActionIcon,
  Tooltip, Code, ScrollArea, Divider, Box, CopyButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconMail, IconEdit, IconRefresh, IconCheck, IconAlertCircle,
  IconEye, IconCode, IconTrash, IconInfoCircle, IconCopy,
  IconMailFast, IconMailCheck, IconMailX, IconCalendar, IconKey,
  IconHeadset,
} from '@tabler/icons-react';
import { DEEP_BLUE, GRAY_100, SURFACE_SUBTLE } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  useEmailTemplates, useSaveEmailTemplate, useResetEmailTemplate,
  previewEmailTemplate, EmailTemplateDto,
} from '../../api/emailTemplates';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'approval-pending':   <IconMailFast size={16} />,
  'approval-decision':  <IconMailCheck size={16} />,
  'approval-withdrawn': <IconMailX size={16} />,
  'weekly-digest':      <IconCalendar size={16} />,
  'password-reset':     <IconKey size={16} />,
  'support-staleness':  <IconHeadset size={16} />,
};

const TEMPLATE_COLORS: Record<string, string> = {
  'approval-pending':   'orange',
  'approval-decision':  'teal',
  'approval-withdrawn': 'gray',
  'weekly-digest':      'blue',
  'password-reset':     'violet',
  'support-staleness':  'red',
};

/** Variables available in every template. */
const COMMON_VARS = [
  { name: 'orgName',    desc: 'Organisation name from Org Settings' },
  { name: 'orgColor',   desc: 'Brand hex colour from Org Settings' },
  { name: 'orgLogoUrl', desc: 'Logo URL (empty if not set)' },
];

/** Per-template variable reference. */
const TEMPLATE_VARS: Record<string, { name: string; desc: string }[]> = {
  'approval-pending': [
    { name: 'projectName',       desc: 'Name of the project' },
    { name: 'requestedBy',       desc: 'Username of the requester' },
    { name: 'changeDescription', desc: 'Human-readable description of the change' },
    { name: 'requestNote',       desc: 'Optional note left by the requester' },
    { name: 'projectUrl',        desc: 'Deep-link to the project approval tab' },
  ],
  'approval-decision': [
    { name: 'projectName',       desc: 'Name of the project' },
    { name: 'decision',          desc: '"APPROVED" or "REJECTED"' },
    { name: 'ownerName',         desc: 'Username of the requester' },
    { name: 'changeDescription', desc: 'Change that was approved/rejected' },
    { name: 'reviewedBy',        desc: 'Reviewer username' },
    { name: 'reviewComment',     desc: 'Reviewer comment (may be empty)' },
    { name: 'projectUrl',        desc: 'Deep-link to the project' },
  ],
  'approval-withdrawn': [
    { name: 'projectName',       desc: 'Name of the project' },
    { name: 'requestedBy',       desc: 'Username who withdrew the request' },
    { name: 'changeDescription', desc: 'Change that was withdrawn' },
  ],
  'weekly-digest': [
    { name: 'recipientName', desc: 'Name of the email recipient' },
    { name: 'projectCount',  desc: 'Total number of projects' },
    { name: 'warningCount',  desc: 'Number of at-risk projects' },
  ],
  'password-reset': [
    { name: 'username',   desc: 'Username of the account' },
    { name: 'resetUrl',   desc: 'Password-reset link' },
    { name: 'expiryMins', desc: 'Link expiry in minutes' },
  ],
  'support-staleness': [
    { name: 'ticketTitle', desc: 'Support ticket title' },
    { name: 'staleDays',   desc: 'Number of days inactive' },
    { name: 'ticketUrl',   desc: 'Link to the ticket' },
  ],
};

// ── Sub-components ────────────────────────────────────────────────────────────

function VariableChip({ name, onClick }: { name: string; onClick: (v: string) => void }) {
  return (
    <CopyButton value={`{{${name}}}`} timeout={1200}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied!' : `Click to copy {{${name}}}`} withArrow>
          <Badge
            variant="outline"
            color={copied ? 'teal' : 'blue'}
            size="sm"
            style={{ cursor: 'pointer', fontFamily: 'monospace' }}
            onClick={() => { copy(); onClick(`{{${name}}}`); }}
            leftSection={copied ? <IconCheck size={10} /> : <IconCopy size={10} />}
          >
            {`{{${name}}}`}
          </Badge>
        </Tooltip>
      )}
    </CopyButton>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  template: EmailTemplateDto;
  onClose: () => void;
}

function EditModal({ template, onClose }: EditModalProps) {
  const isDark = useDarkMode();
  const saveMutation    = useSaveEmailTemplate();
  const resetMutation   = useResetEmailTemplate();

  const [subject,  setSubject]  = useState(template.subject  ?? '');
  const [htmlBody, setHtmlBody] = useState(template.htmlBody ?? '');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('edit');

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const vars  = TEMPLATE_VARS[template.templateName] ?? [];
  const allVars = [...COMMON_VARS, ...vars];

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const html = await previewEmailTemplate(template.templateName, { subject, htmlBody });
      setPreviewHtml(html);
      setActiveTab('preview');
    } catch {
      notifications.show({ title: 'Preview failed', message: 'Could not render preview.', color: 'red' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const insertVar = (token: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? htmlBody.length;
    const end   = el.selectionEnd   ?? htmlBody.length;
    const next  = htmlBody.slice(0, start) + token + htmlBody.slice(end);
    setHtmlBody(next);
    // Restore focus + caret
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        name: template.templateName,
        data: {
          subject:  subject.trim()  || null,
          htmlBody: htmlBody.trim() || null,
        },
      });
      notifications.show({
        title: 'Template saved',
        message: `"${template.templateName}" override saved. Future emails will use your custom content.`,
        color: 'teal',
        icon: <IconCheck size={15} />,
      });
      onClose();
    } catch {
      notifications.show({ title: 'Save failed', message: 'Could not save template.', color: 'red' });
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(template.templateName);
      notifications.show({
        title: 'Template reset',
        message: `"${template.templateName}" reverted to built-in default.`,
        color: 'blue',
      });
      onClose();
    } catch {
      notifications.show({ title: 'Reset failed', message: 'Could not reset template.', color: 'red' });
    }
  };

  const cardBg     = isDark ? 'var(--mantine-color-dark-6)' : SURFACE_SUBTLE;
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  return (
    <>
      {/* Variable reference */}
      <Paper withBorder p="sm" radius="sm" mb="md" style={{ background: cardBg, borderColor }}>
        <Group gap="xs" mb={6} align="center">
          <IconInfoCircle size={13} color="var(--mantine-color-blue-5)" />
          <Text size="xs" fw={600}>
            Available variables — click to insert into body
          </Text>
        </Group>
        <Group gap={6} wrap="wrap">
          {allVars.map(v => (
            <VariableChip key={v.name} name={v.name} onClick={insertVar} />
          ))}
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          Use <Code style={{ fontSize: 11 }}>{'{{variableName}}'}</Code> syntax in both subject and body.
          Variables not listed above are left as-is.
        </Text>
      </Paper>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="edit"    leftSection={<IconCode size={14} />}>Edit</Tabs.Tab>
          <Tabs.Tab value="preview" leftSection={<IconEye  size={14} />}>
            Preview {previewLoading && <Text span size="xs" c="dimmed" ml={4}>(loading…)</Text>}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="edit">
          <Stack gap="md">
            <TextInput
              label="Subject line"
              description="Leave blank to use the application default subject."
              placeholder="e.g. [{{orgName}}] Approval required: {{projectName}}"
              value={subject}
              onChange={e => setSubject(e.currentTarget.value)}/>
            <Box>
              <Text size="sm" fw={500} mb={4}>
                HTML body
              </Text>
              <Text size="xs" c="dimmed" mb={6}>
                Full HTML is supported. Leave blank to use the built-in Thymeleaf template.
              </Text>
              <textarea
                ref={bodyRef}
                value={htmlBody}
                onChange={e => setHtmlBody(e.target.value)}
                placeholder="<!DOCTYPE html>\n<html>\n<body>\n  <p>Hello {{orgName}},</p>\n  ...\n</body>\n</html>"
                rows={16}
                spellCheck={false}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: `1px solid ${borderColor}`,
                  background: isDark ? 'var(--mantine-color-dark-7)' : '#fff',
                  color: isDark ? '#c1c2c5' : '#333',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="preview">
          {previewHtml ? (
            <Box
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                overflow: 'hidden',
                height: 480,
              }}
            >
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                style={{ width: '100%', height: '100%', border: 'none', background: isDark ? 'var(--mantine-color-dark-7)' : '#fff' }}
                sandbox="allow-same-origin"
              />
            </Box>
          ) : (
            <Paper withBorder radius="sm" p="xl" style={{ background: cardBg, borderColor, textAlign: 'center' }}>
              <IconEye size={32} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed" mt="sm">
                Click "Preview" to render your template with sample data.
              </Text>
              <Button
                mt="md"
                size="sm"
                variant="light"
                leftSection={<IconEye size={14} />}
                onClick={handlePreview}
                loading={previewLoading}
              >
                Load preview
              </Button>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>

      <Divider my="md" />

      <Group justify="space-between">
        <Group gap="xs">
          {template.customized && (
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconTrash size={14} />}
              onClick={handleReset}
              loading={resetMutation.isPending}
            >
              Reset to default
            </Button>
          )}
        </Group>
        <Group gap="xs">
          <Button variant="subtle" size="sm" color="gray" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={handlePreview}
            loading={previewLoading}
          >
            Preview
          </Button>
          <Button
            size="sm"
            color="teal"
            leftSection={<IconCheck size={14} />}
            onClick={handleSave}
            loading={saveMutation.isPending}
          >
            Save template
          </Button>
        </Group>
      </Group>
    </>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isDark,
  borderColor,
  onEdit,
}: {
  template: EmailTemplateDto;
  isDark: boolean;
  borderColor: string;
  onEdit: (t: EmailTemplateDto) => void;
}) {
  const icon  = TEMPLATE_ICONS[template.templateName] ?? <IconMail size={16} />;
  const color = TEMPLATE_COLORS[template.templateName] ?? 'blue';

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        background: isDark ? 'var(--mantine-color-dark-7)' : '#fff',
        borderColor,
        transition: 'box-shadow 0.15s',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ThemeIcon size={36} radius="md" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Group gap="xs" align="center" wrap="nowrap">
              <Text fw={600} size="sm">
                {template.templateName}
              </Text>
              {template.customized ? (
                <Badge size="xs" color="teal" variant="filled">customised</Badge>
              ) : (
                <Badge size="xs" color="gray" variant="outline">default</Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              {template.description}
            </Text>
            {template.customized && template.subject && (
              <Text size="xs" c="dimmed" mt={4}>
                Subject: <em>{template.subject.length > 70 ? template.subject.slice(0, 70) + '…' : template.subject}</em>
              </Text>
            )}
            {template.customized && template.updatedAt && (
              <Text size="xs" c="dimmed" mt={2}>
                Last saved: {new Date(template.updatedAt).toLocaleString()}
              </Text>
            )}
          </div>
        </Group>
        <Tooltip label="Edit template" withArrow>
          <ActionIcon
            variant="light"
            color={color}
            size="lg"
            onClick={() => onEdit(template)}
            aria-label="Edit"
          >
            <IconEdit size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const isDark = useDarkMode();
  const { data, isLoading, isError, refetch } = useEmailTemplates();
  const [editing, setEditing] = useState<EmailTemplateDto | null>(null);

  const cardBg     = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width={300} />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} height={90} radius="md" />)}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Load error">
        Could not load email templates.{' '}
        <Button size="xs" variant="subtle" onClick={() => refetch()}>Retry</Button>
      </Alert>
    );
  }

  const templates = data ?? [];

  return (
    <>
      {/* Edit modal */}
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" variant="light" color={editing ? TEMPLATE_COLORS[editing.templateName] ?? 'blue' : 'blue'}>
              {editing ? TEMPLATE_ICONS[editing.templateName] ?? <IconMail size={14} /> : <IconMail size={14} />}
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">
                Edit: {editing?.templateName}
              </Text>
              <Text size="xs" c="dimmed">
                {editing?.description}
              </Text>
            </div>
          </Group>
        }
        size="xl"
        padding="lg"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {editing && (
          <EditModal
            template={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>

      <Stack gap="lg" className="page-enter">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
              Email Templates
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Customise the subject line and HTML body of outgoing emails without touching backend files.
              Use <Code style={{ fontSize: 11 }}>{'{{variable}}'}</Code> tokens to insert dynamic values.
            </Text>
          </div>
          <Tooltip label="Refresh">
            <ActionIcon variant="default" size="lg" onClick={() => refetch()}
      aria-label="Refresh"
    >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Info banner */}
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
          variant="light"
          radius="sm"
        >
          <Text size="sm">
            Templates marked <Badge size="xs" color="teal" variant="filled">customised</Badge> use your
            saved content. <Badge size="xs" color="gray" variant="outline">default</Badge> templates use
            the built-in HTML file. You can reset a custom template at any time to restore the built-in design.
          </Text>
        </Alert>

        {/* Template cards */}
        <Stack gap="sm">
          {templates.map(t => (
            <TemplateCard
              key={t.templateName}
              template={t}
              isDark={isDark}
              borderColor={borderColor}
              onEdit={setEditing}
            />
          ))}
          {templates.length === 0 && (
            <Paper withBorder radius="md" p="xl" style={{ background: cardBg, borderColor, textAlign: 'center' }}>
              <Text size="sm" c="dimmed">No templates found.</Text>
            </Paper>
          )}
        </Stack>
      </Stack>
    </>
  );
}
