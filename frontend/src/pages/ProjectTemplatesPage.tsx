import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Badge, Button, Card, SimpleGrid,
  TextInput, ActionIcon, Modal, Stack, Divider, Tabs,
  Paper, ScrollArea, Select, NumberInput, Textarea,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconTemplate, IconPlus, IconSearch, IconCopy, IconEdit,
  IconTrash, IconRocket, IconCode, IconChartBar,
  IconBriefcase, IconStar, IconStarFilled, IconCheck,
  IconDownload, IconArrowRight,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS } from '../brandTokens';

interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  duration: string;
  team: string;
  effort: string;
  tags: string[];
  starred: boolean;
  usageCount: number;
  lastUsed?: string;
  phases: { name: string; duration: string; description: string }[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Engineering': <IconCode size={20} />,
  'Analytics':   <IconChartBar size={20} />,
  'Launch':      <IconRocket size={20} />,
  'Standard':    <IconBriefcase size={20} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Engineering': '#3b82f6',
  'Analytics':   '#8b5cf6',
  'Launch':      '#10b981',
  'Standard':    '#f59e0b',
};

const INITIAL_TEMPLATES: Template[] = [
  {
    id: 1,
    name: 'Standard Feature Release',
    description: 'A standard 3-month project template for new feature development with discovery, build, and QA phases.',
    category: 'Standard',
    duration: '3 months',
    team: 'Mixed',
    effort: 'Flat',
    tags: ['Feature', 'Development', 'QA'],
    starred: true,
    usageCount: 12,
    lastUsed: 'Mar 2026',
    phases: [
      { name: 'Discovery & Design', duration: '2 weeks', description: 'Requirements gathering, UX design, technical spec' },
      { name: 'Development', duration: '8 weeks', description: 'Frontend + backend implementation' },
      { name: 'QA & Testing', duration: '2 weeks', description: 'Regression, UAT, performance testing' },
    ],
  },
  {
    id: 2,
    name: 'Data Migration Project',
    description: 'Template for large-scale data migration with validation, ETL build, and cutover phases.',
    category: 'Engineering',
    duration: '4 months',
    team: 'Backend + Data',
    effort: 'Steady',
    tags: ['Data', 'Migration', 'ETL'],
    starred: false,
    usageCount: 5,
    lastUsed: 'Feb 2026',
    phases: [
      { name: 'Data Audit & Mapping', duration: '2 weeks', description: 'Source/target schema analysis' },
      { name: 'ETL Build', duration: '10 weeks', description: 'Transform scripts + pipeline build' },
      { name: 'Validation & Cutover', duration: '4 weeks', description: 'Data quality checks + go-live' },
    ],
  },
  {
    id: 3,
    name: 'Analytics Dashboard Build',
    description: 'Template for building internal analytics dashboards — from data model to front-end delivery.',
    category: 'Analytics',
    duration: '2 months',
    team: 'Data + Frontend',
    effort: 'Flat',
    tags: ['Dashboard', 'Analytics', 'Reporting'],
    starred: true,
    usageCount: 8,
    lastUsed: 'Apr 2026',
    phases: [
      { name: 'Requirements & KPI Definition', duration: '1 week', description: 'Stakeholder interviews, metric definitions' },
      { name: 'Data Modelling', duration: '3 weeks', description: 'Data warehouse queries, calculated fields' },
      { name: 'UI Build & Testing', duration: '4 weeks', description: 'Dashboard implementation and UAT' },
    ],
  },
  {
    id: 4,
    name: 'Product Launch',
    description: 'End-to-end product launch template covering engineering, QA, marketing readiness, and go-live.',
    category: 'Launch',
    duration: '6 months',
    team: 'Cross-functional',
    effort: 'Ramp-up',
    tags: ['Launch', 'Cross-team', 'Go-live'],
    starred: false,
    usageCount: 3,
    phases: [
      { name: 'Planning & Architecture', duration: '3 weeks', description: 'Scope finalization, tech design' },
      { name: 'Build Phase 1 - Core', duration: '10 weeks', description: 'Core features, APIs, integrations' },
      { name: 'Build Phase 2 - Polish', duration: '6 weeks', description: 'UI polish, edge cases, docs' },
      { name: 'QA & Stabilization', duration: '3 weeks', description: 'Full regression, load tests, fixes' },
      { name: 'Launch & Hypercare', duration: '2 weeks', description: 'Go-live, 24/7 monitoring, rapid fixes' },
    ],
  },
  {
    id: 5,
    name: 'Quick Fix / Patch',
    description: 'Lightweight template for bug fixes and minor enhancements. Streamlined with minimal process.',
    category: 'Engineering',
    duration: '2 weeks',
    team: 'Dev only',
    effort: 'Flat',
    tags: ['Bug Fix', 'Patch', 'Quick'],
    starred: false,
    usageCount: 24,
    lastUsed: 'Apr 2026',
    phases: [
      { name: 'Investigation', duration: '2 days', description: 'Root cause analysis' },
      { name: 'Fix + Test', duration: '1 week', description: 'Implementation and unit tests' },
      { name: 'Deploy', duration: '2 days', description: 'Staged rollout and monitoring' },
    ],
  },
  {
    id: 6,
    name: 'API Integration',
    description: 'Template for third-party API integrations including contracts, build, security review, and testing.',
    category: 'Engineering',
    duration: '6 weeks',
    team: 'Backend',
    effort: 'Flat',
    tags: ['API', 'Integration', 'Backend'],
    starred: false,
    usageCount: 7,
    phases: [
      { name: 'API Contract & Auth Design', duration: '1 week', description: 'Endpoint mapping, auth scheme' },
      { name: 'Integration Build', duration: '3 weeks', description: 'Implementation + error handling' },
      { name: 'Security Review + Testing', duration: '2 weeks', description: 'Pen test, QA, performance' },
    ],
  },
];

export default function ProjectTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const categories = useMemo(() =>
    Array.from(new Set(INITIAL_TEMPLATES.map(t => t.category))).sort(), []);

  const filtered = useMemo(() => {
    let ts = templates;
    if (search) ts = ts.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );
    if (filterCategory) ts = ts.filter(t => t.category === filterCategory);
    return ts;
  }, [templates, search, filterCategory]);

  const starred = useMemo(() => filtered.filter(t => t.starred), [filtered]);
  const all = useMemo(() => filtered.filter(t => !t.starred), [filtered]);

  function toggleStar(id: number) {
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, starred: !t.starred } : t));
  }

  function handleUseTemplate(template: Template) {
    notifications.show({
      title: 'Template Applied',
      message: `"${template.name}" has been pre-filled into a new project. Review and save to confirm.`,
      color: 'teal',
      icon: <IconCheck size={16} />,
    });
    setTemplates(ts => ts.map(t => t.id === template.id
      ? { ...t, usageCount: t.usageCount + 1, lastUsed: 'Apr 2026' } : t));
  }

  function TemplateCard({ template }: { template: Template }) {
    const color = CATEGORY_COLORS[template.category] || '#64748b';
    const icon = CATEGORY_ICONS[template.category] || <IconBriefcase size={20} />;
    return (
      <Card
        className="hover-glow"
        withBorder radius="md" p="md"
        style={{ borderTop: `3px solid ${color}`, cursor: 'pointer' }}
        onClick={() => { setSelectedTemplate(template); openDetail(); }}
      >
        <Group justify="space-between" mb="sm">
          <ThemeIcon size={36} radius="md"
            style={{ background: `${color}18`, color }}>
            {icon}
          </ThemeIcon>
          <Group gap={6}>
            <ActionIcon
              variant="subtle" size="sm"
              onClick={e => { e.stopPropagation(); toggleStar(template.id); }}
              color={template.starred ? 'yellow' : 'gray'}
            >
              {template.starred ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </ActionIcon>
          </Group>
        </Group>

        <Text fw={700} size="sm" style={{ color: DEEP_BLUE }} mb={4}>
          {template.name}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
          {template.description}
        </Text>

        <Group gap={6} mb="sm" wrap="wrap">
          {template.tags.slice(0, 3).map(tag => (
            <Badge key={tag} size="xs" variant="light" color="gray"
              style={{ fontSize: 10, border: '1px solid #e2e8f0' }}>
              {tag}
            </Badge>
          ))}
        </Group>

        <Divider mb="sm" />

        <Group justify="space-between">
          <Text size="xs" c="dimmed">⏱ {template.duration}</Text>
          <Text size="xs" c="dimmed">Used {template.usageCount}x</Text>
        </Group>

        <Button
          fullWidth mt="sm" size="xs"
          style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
          rightSection={<IconArrowRight size={13} />}
          onClick={e => { e.stopPropagation(); handleUseTemplate(template); }}
        >
          Use Template
        </Button>
      </Card>
    );
  }

  return (
    <Box className="page-enter" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} style={{ color: DEEP_BLUE, fontWeight: 800 }}>
            Project Templates
          </Title>
          <Text c="dimmed" size="sm" mt={2}>
            Reusable blueprints to kick-start new projects with pre-defined phases and effort patterns
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={15} />}
          style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
        >
          New Template
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={4} spacing="md" mb="lg">
        {[
          { label: 'Total Templates', value: templates.length },
          { label: 'Starred', value: templates.filter(t => t.starred).length },
          { label: 'Most Used', value: templates.sort((a,b) => b.usageCount - a.usageCount)[0]?.name.split(' ').slice(0, 2).join(' ') },
          { label: 'Categories', value: categories.length },
        ].map(stat => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: '#94a3b8' }}>
              {stat.label}
            </Text>
            <Text size="xl" fw={800} mt={4} style={{ color: DEEP_BLUE, fontSize: typeof stat.value === 'number' ? 28 : 18 }}>
              {stat.value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      {/* Filters */}
      <Paper withBorder radius="md" p="md" mb="lg">
        <Group gap="sm">
          <TextInput
            placeholder="Search templates..."
            leftSection={<IconSearch size={15} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
            size="sm"
          />
          <Select
            placeholder="All Categories"
            data={categories}
            value={filterCategory}
            onChange={setFilterCategory}
            clearable
            size="sm"
            style={{ width: 180 }}
          />
        </Group>
      </Paper>

      {/* Starred section */}
      {starred.length > 0 && (
        <Box mb="xl">
          <Group gap="sm" mb="md">
            <IconStarFilled size={16} color="#f59e0b" />
            <Text fw={700} size="sm" tt="uppercase" style={{ letterSpacing: '0.6px', color: '#94a3b8' }}>
              Starred Templates
            </Text>
          </Group>
          <SimpleGrid cols={3} spacing="md">
            {starred.map(t => <TemplateCard key={t.id} template={t} />)}
          </SimpleGrid>
        </Box>
      )}

      {/* All templates */}
      <Box>
        <Text fw={700} size="sm" tt="uppercase" style={{ letterSpacing: '0.6px', color: '#94a3b8' }} mb="md">
          All Templates ({all.length})
        </Text>
        <SimpleGrid cols={3} spacing="md">
          {all.map(t => <TemplateCard key={t.id} template={t} />)}
        </SimpleGrid>
      </Box>

      {/* Detail Modal */}
      <Modal
        opened={detailOpened}
        onClose={closeDetail}
        title={selectedTemplate?.name || ''}
        size="lg"
        radius="md"
      >
        {selectedTemplate && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">{selectedTemplate.description}</Text>

            <SimpleGrid cols={3} spacing="sm">
              {[
                { label: 'Duration', value: selectedTemplate.duration },
                { label: 'Team', value: selectedTemplate.team },
                { label: 'Pattern', value: selectedTemplate.effort },
              ].map(info => (
                <Paper key={info.label} withBorder p="sm" radius="md">
                  <Text size="xs" c="dimmed">{info.label}</Text>
                  <Text size="sm" fw={700} style={{ color: DEEP_BLUE }}>{info.value}</Text>
                </Paper>
              ))}
            </SimpleGrid>

            <Divider label="Project Phases" labelPosition="left" />

            <Stack gap="sm">
              {selectedTemplate.phases.map((phase, i) => (
                <Paper key={i} withBorder p="sm" radius="md"
                  style={{ borderLeft: `3px solid ${AQUA}` }}>
                  <Group justify="space-between" mb={2}>
                    <Text size="sm" fw={700} style={{ color: DEEP_BLUE }}>
                      Phase {i + 1}: {phase.name}
                    </Text>
                    <Badge size="sm" variant="light" color="teal"
                      style={{ border: '1px solid #2DCCD344' }}>
                      {phase.duration}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{phase.description}</Text>
                </Paper>
              ))}
            </Stack>

            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" color="gray" onClick={closeDetail}>Cancel</Button>
              <Button
                leftSection={<IconCopy size={14} />}
                variant="outline"
                color="teal"
              >
                Duplicate
              </Button>
              <Button
                leftSection={<IconCheck size={14} />}
                style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
                onClick={() => { handleUseTemplate(selectedTemplate); closeDetail(); }}
              >
                Use This Template
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
