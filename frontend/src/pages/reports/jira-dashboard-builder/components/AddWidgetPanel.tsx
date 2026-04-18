import { useState } from 'react';
import { Text, Badge, Group, SimpleGrid, Paper, Stack, ScrollArea, TextInput, ThemeIcon } from '@mantine/core';
import { IconFilter } from '@tabler/icons-react';
import { WIDGET_CATALOG } from '../state/constants';
import { AQUA_HEX, COLOR_VIOLET, COLOR_TEAL, COLOR_AMBER_DARK, COLOR_EMERALD, FONT_FAMILY, DEEP_BLUE_TINTS } from '../../../../brandTokens';
import { MiniWidgetPreview } from './MiniWidgetPreview';

export function AddWidgetPanel({
  onAdd,
  onDone,
}: {
  onAdd: (type: string) => void;
  onDone: () => void;
}) {
  const [widgetSearch, setWidgetSearch] = useState('');
  const [widgetCategoryFilter, setWidgetCategoryFilter] = useState<string>('all');

  const filtered = WIDGET_CATALOG.filter(w => {
    const matchesCat = widgetCategoryFilter === 'all' || w.category === widgetCategoryFilter;
    const matchesSearch = !widgetSearch || w.label.toLowerCase().includes(widgetSearch.toLowerCase()) || w.description.toLowerCase().includes(widgetSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cats = ['all', ...Array.from(new Set(WIDGET_CATALOG.map(w => w.category)))];
  const catColors: Record<string, string> = {
    Overview: 'blue', Charts: 'violet', Trends: 'teal', Quality: 'orange', Team: 'pink', Tables: 'gray', Delivery: 'green',
  };

  const catColorsHex: Record<string, string> = {
    Overview: AQUA_HEX, Charts: COLOR_VIOLET, Trends: COLOR_TEAL, Quality: COLOR_AMBER_DARK, Team: '#DB2777', Tables: DEEP_BLUE_TINTS[50], Delivery: COLOR_EMERALD,
  };

  return (
    <Stack gap="md">
      <TextInput
        placeholder="Search widgets…"
        leftSection={<IconFilter size={14} />}
        value={widgetSearch}
        onChange={e => setWidgetSearch(e.target.value)}
        radius="md"
      />
      <ScrollArea scrollbarSize={4} type="hover">
        <Group gap={6} wrap="nowrap" pb={4}>
          {cats.map(cat => (
            <Badge key={cat} size="md" radius="xl"
              variant={widgetCategoryFilter === cat ? 'filled' : 'light'}
              color={cat === 'all' ? 'dark' : (catColors[cat] ?? 'blue')}
              style={{ cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setWidgetCategoryFilter(cat)}>
              {cat === 'all' ? `All (${WIDGET_CATALOG.length})` : `${cat} (${WIDGET_CATALOG.filter(w => w.category === cat).length})`}
            </Badge>
          ))}
        </Group>
      </ScrollArea>

      {!filtered.length ? (
        <Text c="dimmed" ta="center" py="xl">No widgets match "{widgetSearch}"</Text>
      ) : (
        <ScrollArea h={480} scrollbarSize={6}>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            {filtered.map(cat => {
              const accentColor = catColorsHex[cat.category] ?? AQUA_HEX;
              return (
                <Paper key={cat.type} withBorder radius="lg" p={0}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease', overflow: 'hidden', position: 'relative' }}
                  onClick={() => { onAdd(cat.type); onDone(); }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${accentColor}25`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                  <MiniWidgetPreview type={cat.type} color={accentColor} />
                  <Stack gap={4} p="sm">
                    <Group justify="space-between" gap={4}>
                      <Group gap={6}>
                        <ThemeIcon size={20} radius="sm" style={{ background: accentColor + '20', color: accentColor }}>
                          {cat.icon}
                        </ThemeIcon>
                        <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY }} lineClamp={1}>{cat.label}</Text>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>{cat.description}</Text>
                    <Badge size="xs" variant="dot" color={Object.keys(catColors).includes(cat.category) ? undefined : 'gray'} style={{ alignSelf: 'flex-start' }}>
                      {cat.category}
                    </Badge>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        </ScrollArea>
      )}
    </Stack>
  );
}
