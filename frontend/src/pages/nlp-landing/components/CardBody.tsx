import {
  Paper, Group, Stack, Badge, Text, ThemeIcon, SimpleGrid,   } from '@mantine/core';
import {
  IconUser, IconBriefcase, IconStatusChange, IconFlag, IconHexagons,
  IconCalendarStats, IconClock, IconRocket, IconSnowflake, IconLock,
  IconPlayerPlay, IconPercentage, IconCheck, IconX,   IconDownload, IconAlertTriangle, IconUsers, IconCurrencyDollar,
  IconCalendarEvent, IconMapPin, IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { NlpQueryResponse } from '../../../api/nlp';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../../brandTokens';
import {
  STATUS_COLORS, ROLE_COLORS, LOCATION_COLORS,
} from '../constants';
import { str } from '../utils';
import {
  InfoTile, DrillDownButton, BadgeListSection, SummaryRow, WittyEmptyState, NotesBox,
  } from './SubComponents';
import { NumberedItemList } from './NumberedItemList';
import { ComparisonCard, ComparisonTable } from './ComparisonComponents';

export function CardBody({
  result,
  onNavigate,
  onNavigateWithToast,
  onFormPrefill,
  isDark,
}: {
  result: NlpQueryResponse;
  onNavigate: (route: string) => void;
  onNavigateWithToast: (route: string, entityName?: string) => void;
  onFormPrefill: (route: string, formData: Record<string, unknown>) => void;
  isDark: boolean;
}) {
  const d = result.response.data;

  // ── Navigation action ──
  if (result.intent === 'NAVIGATE' && result.response.route) {
    return (
      <DrillDownButton route={result.response.route} onNavigate={onNavigate} label={`Go to ${result.response.route}`} />
    );
  }

  // ── Form prefill action ──
  if (result.intent === 'FORM_PREFILL' && result.response.route && result.response.formData) {
    return (
      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Pre-filled fields</Text>
        <Group gap="xs">
          {Object.entries(result.response.formData).map(([key, val]) => (
            <Badge key={key} variant="light" radius="sm" size="sm" style={{ textTransform: 'none', backgroundColor: AQUA }}>
              {key}: {String(val)}
            </Badge>
          ))}
        </Group>
        <DrillDownButton
          route={result.response.route}
          onNavigate={() => onFormPrefill(result.response.route!, result.response.formData!)}
          label="Open form with pre-filled data"
        />
      </Stack>
    );
  }

  if (!d) {
    return (
      <Stack gap="sm">
        <WittyEmptyState message={result.response.message} />
        {result.response.drillDown && (
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View details" />
        )}
      </Stack>
    );
  }

  const shape = result.response.shape ?? String(d._shape ?? '');
  if (shape === 'COMPARISON') {
    return (
      <ComparisonCard
        nameA={String(d.nameA ?? 'A')}
        nameB={String(d.nameB ?? 'B')}
        entityType={String(d.entityType ?? 'item')}
        left={d.left as Record<string, unknown> ?? {}}
        right={d.right as Record<string, unknown> ?? {}}
        isDark={isDark}
        onNavigate={onNavigate}
        drillDown={result.response.drillDown}
      />
    );
  }

  const type = String(d._type ?? '');

  // ── Resource Profile ──
  if (type === 'RESOURCE_PROFILE') {
    const isEnriched = d.Role != null || d.POD != null || d.Location != null;
    if (isEnriched) {
      return (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <InfoTile icon={<IconUsers size={16} />} label="Role" value={str(d.Role)} accent={ROLE_COLORS[str(d.Role)] ?? 'blue'} />
            <InfoTile icon={<IconHexagons size={16} />} label="POD" value={str(d.POD)} accent="teal" />
            <InfoTile icon={<IconMapPin size={16} />} label="Location" value={str(d.Location)} accent={LOCATION_COLORS[str(d.Location)] ?? 'grape'} />
            <InfoTile icon={<IconCurrencyDollar size={16} />} label="Billing Rate" value={str(d['Billing Rate'])} accent="orange" />
            <InfoTile icon={<IconUser size={16} />} label="FTE" value={str(d.FTE)} accent="indigo" />
          </SimpleGrid>
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Resources page" />
        </Stack>
      );
    }
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={36} variant="light" radius="md" style={{ backgroundColor: AQUA, color: AQUA }}>
              <IconUser size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{str(d.entityName || d.Name)}</Text>
              <Text size="xs" c="dimmed">Click below to view full resource profile</Text>
            </div>
          </Group>
        </Paper>
        <DrillDownButton route={result.response.drillDown ?? `/resources`} onNavigate={onNavigate} label="View on Resources page" />
      </Stack>
    );
  }

  // ── Project Profile ──
  if (type === 'PROJECT_PROFILE') {
    const isEnriched = d.Priority != null || d.Owner != null || d.Status != null;
    if (isEnriched) {
      return (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <InfoTile icon={<IconFlag size={16} />} label="Priority" value={str(d.Priority)} accent="red" />
            <InfoTile icon={<IconUser size={16} />} label="Owner" value={str(d.Owner)} accent="blue" />
            <InfoTile icon={<IconStatusChange size={16} />} label="Status" value={str(d.Status)} accent={STATUS_COLORS[str(d.Status)] ?? 'teal'} />
            <InfoTile icon={<IconHexagons size={16} />} label="Assigned PODs" value={str(d['Assigned PODs'] ?? d['Assigned Pods'])} accent="grape" />
            <InfoTile icon={<IconCalendarStats size={16} />} label="Timeline" value={str(d.Timeline)} accent="orange" />
            <InfoTile icon={<IconClock size={16} />} label="Duration" value={str(d.Duration)} accent="indigo" />
            {d.Client != null && (
              <InfoTile icon={<IconBuildingSkyscraper size={16} />} label="Client" value={str(d.Client)} accent="cyan" />
            )}
          </SimpleGrid>
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Projects page" />
        </Stack>
      );
    }
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={36} variant="light" radius="md" style={{ backgroundColor: AQUA, color: AQUA }}>
              <IconBriefcase size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{str(d.entityName || d.Name)}</Text>
              <Text size="xs" c="dimmed">Click below to view full project details</Text>
            </div>
          </Group>
        </Paper>
        <DrillDownButton route={result.response.drillDown ?? `/projects`} onNavigate={onNavigate} label="View on Projects page" />
      </Stack>
    );
  }

  // ── POD Profile ──
  if (type === 'POD_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <InfoTile icon={<IconUsers size={16} />} label="Members" value={str(d.Members)} accent="blue" />
          <InfoTile icon={<IconBriefcase size={16} />} label="Projects" value={str(d.Projects)} accent="teal" />
          <InfoTile icon={<IconPercentage size={16} />} label="Avg BAU" value={str(d['Avg BAU'])} accent="orange" />
          <InfoTile
            icon={d.Active === 'Yes' ? <IconCheck size={16} /> : <IconX size={16} />}
            label="Active"
            value={str(d.Active)}
            accent={d.Active === 'Yes' ? 'green' : 'red'}
          />
        </SimpleGrid>
        <BadgeListSection label="Team Members" items={str(d.Team)} color="blue" />
        <BadgeListSection label="Assigned Projects" items={str(d['Project List'])} color="teal" />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on PODs page" />
      </Stack>
    );
  }

  // ── Sprint Profile ──
  if (type === 'SPRINT_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          <InfoTile icon={<IconPlayerPlay size={16} />} label="Type" value={str(d.Type)} accent="blue" />
          <InfoTile icon={<IconCalendarEvent size={16} />} label="Start Date" value={str(d['Start Date'])} accent="teal" />
          <InfoTile icon={<IconCalendarEvent size={16} />} label="End Date" value={str(d['End Date'])} accent="grape" />
          {d['Lock-in Date'] != null && (
            <InfoTile icon={<IconLock size={16} />} label="Lock-in Date" value={str(d['Lock-in Date'])} accent="orange" />
          )}
          <InfoTile
            icon={<IconStatusChange size={16} />}
            label="Status"
            value={str(d.Status)}
            accent={STATUS_COLORS[str(d.Status)] ?? 'gray'}
          />
        </SimpleGrid>
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Sprint Calendar" />
      </Stack>
    );
  }

  // ── Release Profile ──
  if (type === 'RELEASE_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          <InfoTile icon={<IconRocket size={16} />} label="Release Date" value={str(d['Release Date'])} accent="teal" />
          <InfoTile icon={<IconSnowflake size={16} />} label="Code Freeze" value={str(d['Code Freeze'])} accent="blue" />
          <InfoTile icon={<IconPlayerPlay size={16} />} label="Type" value={str(d.Type)} accent="grape" />
          <InfoTile
            icon={<IconStatusChange size={16} />}
            label="Status"
            value={str(d.Status)}
            accent={STATUS_COLORS[str(d.Status)] ?? 'orange'}
          />
        </SimpleGrid>
        {d.Notes != null && <NotesBox text={str(d.Notes)} />}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Release Calendar" />
      </Stack>
    );
  }

  // ── Comparison (type-based) ──
  if (type === 'COMPARISON') {
    return (
      <Stack gap="sm">
        <Group gap="xs" mb={4}>
          <Badge variant="filled" size="sm" style={{ backgroundColor: DEEP_BLUE }}>{str(d.entityA)}</Badge>
          <Text size="xs" c="dimmed" fw={700}>vs</Text>
          <Badge variant="filled" size="sm" style={{ backgroundColor: AQUA }}>{str(d.entityB)}</Badge>
        </Group>
        <ComparisonTable data={d} />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
      </Stack>
    );
  }

  // ── LIST card ──
  if (type === 'LIST') {
    const itemCount = Object.keys(d).filter(k => /^#\d+$/.test(k)).length;
    const hasNoItems = itemCount === 0 && str(d.Count) === '0';

    return (
      <Stack gap="sm">
        <SummaryRow data={d} excludeKeys={['Members', 'Projects', 'listType']} />
        {hasNoItems ? (
          <WittyEmptyState message={result.response.message} searchTerm={str(d['Search Term']) || undefined} />
        ) : (
          <NumberedItemList data={d} onNavigate={onNavigateWithToast} />
        )}
        <BadgeListSection label="Members" items={str(d.Members)} color="blue" />
        {d.Projects != null && d.listType === 'PROJECTS' && (
          <BadgeListSection label="Projects" items={str(d.Projects)} color="teal" />
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View details" />
      </Stack>
    );
  }

  // ── EXPORT ──
  if (type === 'EXPORT') {
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={40} variant="light" radius="md" style={{ backgroundColor: AQUA, color: AQUA }}>
              <IconDownload size={22} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                {str(d.label) || 'Data'} Export
              </Text>
              <Text size="xs" c="dimmed">Click to download as CSV</Text>
            </div>
          </Group>
        </Paper>
        {/* Note: Intentionally simplified to avoid Button imports - user should adapt */}
        <DrillDownButton route={str(d.exportUrl) || '#'} onNavigate={() => window.open(str(d.exportUrl), '_blank')} label="Download CSV" />
      </Stack>
    );
  }

  // ── RISK_SUMMARY / INSIGHT ──
  if ((type === 'RISK_SUMMARY' && result.intent === 'INSIGHT') || (result.intent === 'INSIGHT' && d)) {
    const summaryEntries = Object.entries(d)
      .filter(([k, v]) => !k.startsWith('_') && !k.startsWith('#') && typeof v === 'string' && (v as string).length < 40);
    const numberedItems = Object.entries(d)
      .filter(([k]) => /^#\d+$/.test(k))
      .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
    const statusEntry = d['Status'] as string | undefined;

    return (
      <Stack gap="sm">
        {summaryEntries.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            {summaryEntries.map(([label, value]) => {
              const numVal = Number(value);
              let accent = 'blue';
              const lower = label.toLowerCase();
              if (lower.includes('over') || lower.includes('p0') || lower.includes('risk') || lower.includes('strained')) accent = numVal > 0 ? 'red' : 'green';
              else if (lower.includes('under') || lower.includes('idle') || lower.includes('unassigned')) accent = numVal > 0 ? 'orange' : 'green';
              else if (lower.includes('hold') || lower.includes('need')) accent = numVal > 0 ? 'yellow' : 'green';
              else if (lower.includes('high') || lower.includes('load')) accent = numVal > 0 ? 'orange' : 'green';
              else if (lower.includes('total') || lower.includes('active')) accent = 'blue';

              return <InfoTile key={label} icon={<IconAlertTriangle size={16} />} label={label} value={str(value)} accent={accent} />;
            })}
          </SimpleGrid>
        )}
        {numberedItems.length > 0 && (
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em' }}>Details</Text>
            {numberedItems.map(([key, value]) => (
              <Paper key={key} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: `3px solid ${AQUA}` }}>
                <Group gap="sm" wrap="nowrap">
                  <Badge size="sm" radius="sm" variant="filled" style={{ backgroundColor: DEEP_BLUE, minWidth: 28, textAlign: 'center' }}>
                    {key}
                  </Badge>
                  <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{str(value)}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        {statusEntry && numberedItems.length === 0 && (
          <Paper p="sm" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-green-5)` }}>
            <Group gap="sm">
              <IconCheck size={16} color="var(--mantine-color-green-6)" />
              <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{statusEntry}</Text>
            </Group>
          </Paper>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
      </Stack>
    );
  }

  // Generic fallback
  const summaryData = Object.entries(d)
    .filter(([k]) => !k.startsWith('_') && !k.startsWith('#'))
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  const hasNumberedItems = Object.keys(d).some(k => /^#\d+$/.test(k));

  if (summaryData.length === 0 && !hasNumberedItems) {
    return (
      <Stack gap="sm">
        <WittyEmptyState message={result.response.message} />
        {result.response.drillDown && (
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View details" />
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <SummaryRow data={d} excludeKeys={[]} />
      {hasNumberedItems && <NumberedItemList data={d} onNavigate={onNavigateWithToast} />}
      <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
    </Stack>
  );
}
