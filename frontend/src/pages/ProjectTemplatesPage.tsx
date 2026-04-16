import { useState, useMemo } from 'react';
import {
  Box, Text, Group, Badge, Button, Card, SimpleGrid,
  TextInput, ActionIcon, Modal, Stack, Divider,
  Paper, Select, Loader, Center, Alert,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus, IconSearch, IconCopy,
  IconTrash, IconRocket, IconCode, IconChartBar,
  IconBriefcase, IconStar, IconStarFilled, IconCheck,
  IconArrowRight,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useProjectTemplates, useToggleTemplateStar,
  useMarkTemplateUsed, useDeleteTemplate,
  type ProjectTemplateResponse, type TemplatePhase,
} from '../api/projectTemplates';
import { PPPageLayout } from '../components/pp';
import { AQUA, COLOR_BLUE, COLOR_TEAL, COLOR_VIOLET_ALT, COLOR_WARNING, DEEP_BLUE, DEEP_BLUE_TINTS, TEXT_GRAY, TEXT_SUBTLE} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

// Use API type — alias for convenience
type Template = ProjectTemplateResponse & { parsedPhases: TemplatePhase[] };

function parseTemplate(t: ProjectTemplateResponse): Template {
  let parsedPhases: TemplatePhase[] = [];
  try { parsedPhases = JSON.parse(t.phases || '[]'); } catch { /* ignore */ }
  return { ...t, parsedPhases };
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Engineering': <IconCode size={20} />,
  'Analytics':   <IconChartBar size={20} />,
  'Launch':      <IconRocket size={20} />,
  'Standard':    <IconBriefcase size={20} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Engineering': COLOR_BLUE,
  'Analytics':   COLOR_VIOLET_ALT,
  'Launch':      COLOR_TEAL,
  'Standard':    COLOR_WARNING,
};

export default function ProjectTemplatesPage() {
  const isDark = useDarkMode();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  // ── Live data ──
  const { data: rawTemplates = [], isLoading } = useProjectTemplates();
  const toggleStarMutation  = useToggleTemplateStar();
  const markUsedMutation    = useMarkTemplateUsed();
  const deleteMutation      = useDeleteTemplate();

  const templates: Template[] = useMemo(() => rawTemplates.map(parseTemplate), [rawTemplates]);

  const categories = useMemo(() =>
    Array.from(new Set(templates.map(t => t.category))).sort(), [templates]);

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
    toggleStarMutation.mutate(id);
  }

  function handleUseTemplate(template: Template) {
    markUsedMutation.mutate(template.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Template Applied',
          message: `"${template.name}" has been pre-filled into a new project. Review and save to confirm.`,
          color: 'teal',
          icon: <IconCheck size={16} />,
        });
      },
    });
  }

  function TemplateCard({ template }: { template: Template }) {
    const color = CATEGORY_COLORS[template.category] || TEXT_GRAY;
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
              style={{ fontSize: 10, border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e2e8f0' }}>
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

  if (isLoading) {
    return (
      <PPPageLayout title="Project Templates" subtitle="Reusable project blueprints and starter configurations" animate>
        <Center py="xl"><Loader color="teal" /></Center>
      </PPPageLayout>
    );
  }

  return (
    <PPPageLayout
      title="Project Templates"
      subtitle="Reusable project blueprints and starter configurations"
      animate
    >
      {/* Header */}
      <Group justify="flex-end" mb="lg">
        <Button
          leftSection={<IconPlus size={15} />}
          style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}
        >
          New Template
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="lg">
        {[
          { label: 'Total Templates', value: templates.length },
          { label: 'Starred', value: templates.filter(t => t.starred).length },
          { label: 'Most Used', value: templates.sort((a,b) => b.usageCount - a.usageCount)[0]?.name.split(' ').slice(0, 2).join(' ') },
          { label: 'Categories', value: categories.length },
        ].map(stat => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }}>
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
            <IconStarFilled size={16} color={COLOR_WARNING} />
            <Text fw={700} size="sm" tt="uppercase" style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }}>
              Starred Templates
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {starred.map(t => <TemplateCard key={t.id} template={t} />)}
          </SimpleGrid>
        </Box>
      )}

      {/* All templates */}
      <Box>
        <Text fw={700} size="sm" tt="uppercase" style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }} mb="md">
          All Templates ({all.length})
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
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
              {selectedTemplate.parsedPhases.map((phase, i) => (
                <Paper key={i} withBorder p="sm" radius="md"
                  style={{ borderLeft: `3px solid ${AQUA}` }}>
                  <Group justify="space-between" mb={2}>
                    <Text size="sm" fw={700} style={{ color: DEEP_BLUE }}>
                      Phase {i + 1}: {phase.name}
                    </Text>
                    <Badge size="sm" variant="light" color="teal"
                      style={{ border: `1px solid ${isDark ? 'rgba(45,204,211,0.4)' : 'rgba(45,204,211,0.26)'}` }}>
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
    </PPPageLayout>
  );
}
