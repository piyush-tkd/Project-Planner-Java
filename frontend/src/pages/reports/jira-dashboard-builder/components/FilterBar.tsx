import { Paper, Text, Menu, Button, MultiSelect, Loader, ActionIcon } from '@mantine/core';
import { IconCalendarStats, IconTrash, IconSettings, IconPlus, IconTemplate, IconDeviceFloppy, IconDots } from '@tabler/icons-react';
import { AQUA_HEX, BORDER_STRONG, FONT_FAMILY } from '../../../../brandTokens';

interface FilterBarProps {
  dark: boolean;
  months: number;
  datePreset: string;
  onDatePreset: (preset: string) => void;
  podOptions: any[];
  combinedPodSelection: string[];
  onPodsChange: (selected: string[]) => void;
  versionOptions: any[];
  selectedVersions: string[];
  onVersionsChange: (selected: string[]) => void;
  typeOptions: any[];
  selectedTypes: string[];
  onTypesChange: (selected: string[]) => void;
  onClearFilters: () => void;
  isFetching: boolean;
  editMode: boolean;
  onEditMode: () => void;
  dirty: boolean;
  onSave: () => void;
  onAddWidget: () => void;
  onTemplates: () => void;
  onMenuNewDashboard: () => void;
  onMenuLoadDashboard: () => void;
  onMenuClone?: () => void;
  onMenuExport: () => void;
  onMenuRefresh: () => void;
  onMenuSync: () => void;
  syncRunning?: boolean;
}

export function FilterBar({
  dark,
  months,
  datePreset,
  onDatePreset,
  podOptions,
  combinedPodSelection,
  onPodsChange,
  versionOptions,
  selectedVersions,
  onVersionsChange,
  typeOptions,
  selectedTypes,
  onTypesChange,
  onClearFilters,
  isFetching,
  editMode,
  onEditMode,
  dirty,
  onSave,
  onAddWidget,
  onTemplates,
  onMenuNewDashboard,
  onMenuLoadDashboard,
  onMenuClone,
  onMenuExport,
  onMenuRefresh,
  onMenuSync,
  syncRunning,
}: FilterBarProps) {
  const activeFilterCount = combinedPodSelection.length + selectedVersions.length + selectedTypes.length;
  const dateLabel =
    datePreset === 'week'
      ? 'This Week'
      : datePreset === 'month'
      ? 'This Month'
      : datePreset === 'quarter'
      ? 'This Quarter'
      : datePreset === 'year'
      ? 'This Year'
      : datePreset === 'last30'
      ? 'Last 30d'
      : datePreset === 'last90'
      ? 'Last 90d'
      : `${months}mo`;

  return (
    <Paper
      radius={0}
      px="md"
      py={8}
      style={{
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : BORDER_STRONG}`,
        background: dark ? '#1a2635' : '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconCalendarStats size={14} color={AQUA_HEX} />
        <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
          Period:
        </Text>
        <Menu shadow="md" width={240}>
          <Menu.Target>
            <Button size="xs" variant="light" color="teal" radius="xl" rightSection={<span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>}>
              {dateLabel}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Quick ranges</Menu.Label>
            {[['week', 'This Week'], ['month', 'This Month'], ['quarter', 'This Quarter'], ['year', 'This Year']].map(([v, l]) => (
              <Menu.Item key={v} onClick={() => onDatePreset(v)} style={{ fontWeight: datePreset === v ? 700 : 400, color: datePreset === v ? AQUA_HEX : undefined }}>
                {l}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item onClick={() => onDatePreset('last30')} style={{ fontWeight: datePreset === 'last30' ? 700 : 400, color: datePreset === 'last30' ? AQUA_HEX : undefined }}>
              Last 30 Days
            </Menu.Item>
            <Menu.Item onClick={() => onDatePreset('last90')} style={{ fontWeight: datePreset === 'last90' ? 700 : 400, color: datePreset === 'last90' ? AQUA_HEX : undefined }}>
              Last 90 Days
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>

      <div style={{ width: 1, height: 20, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG }} />

      {podOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
            POD:
          </Text>
          <MultiSelect data={podOptions} value={combinedPodSelection} onChange={onPodsChange} placeholder="All PODs" size="xs" clearable searchable maxDropdownHeight={250} style={{ minWidth: 160, maxWidth: 240 }} styles={{ input: { borderRadius: 20, fontSize: 11 } }} />
        </div>
      )}

      {versionOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
            Release:
          </Text>
          <MultiSelect data={versionOptions} value={selectedVersions} onChange={onVersionsChange} placeholder="All Versions" size="xs" clearable searchable maxDropdownHeight={200} style={{ minWidth: 140, maxWidth: 200 }} styles={{ input: { borderRadius: 20, fontSize: 11 } }} />
        </div>
      )}

      {typeOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
            Type:
          </Text>
          <MultiSelect data={typeOptions} value={selectedTypes} onChange={onTypesChange} placeholder="All Types" size="xs" clearable maxDropdownHeight={200} style={{ minWidth: 120, maxWidth: 180 }} styles={{ input: { borderRadius: 20, fontSize: 11 } }} />
        </div>
      )}

      {activeFilterCount > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG }} />
          <Button size="xs" variant="subtle" color="red" radius="xl" leftSection={<IconTrash size={11} />} onClick={onClearFilters}>
            Clear filters ({activeFilterCount})
          </Button>
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {isFetching && <Loader size="xs" color={AQUA_HEX} />}
        <div style={{ width: 1, height: 18, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG, marginRight: 2 }} />
        <Button variant={editMode ? 'filled' : 'subtle'} size="xs" color={editMode ? 'orange' : 'gray'} leftSection={<IconSettings size={13} />} onClick={onEditMode}>
          {editMode ? 'Done' : 'Edit Layout'}
        </Button>
        {editMode && (
          <>
            <Button variant="subtle" size="xs" color="green" leftSection={<IconPlus size={13} />} onClick={onAddWidget}>
              Add Widget
            </Button>
            <Button variant="subtle" size="xs" color="cyan" leftSection={<IconTemplate size={13} />} onClick={onTemplates}>
              Templates
            </Button>
          </>
        )}
        <Button variant="subtle" size="xs" color={dirty ? 'orange' : 'gray'} leftSection={<IconDeviceFloppy size={13} />} onClick={onSave}>
          {dirty ? 'Save*' : 'Save'}
        </Button>
        <Menu shadow="md" width={220}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm"
      aria-label="More options"
    >
              <IconDots size={15} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onMenuNewDashboard}>New Dashboard</Menu.Item>
            <Menu.Item onClick={onMenuLoadDashboard}>My Dashboards</Menu.Item>
            {onMenuClone && <Menu.Item onClick={onMenuClone}>Clone This Dashboard</Menu.Item>}
            <Menu.Divider />
            <Menu.Item onClick={onMenuExport}>Export as CSV</Menu.Item>
            <Menu.Item onClick={onMenuRefresh}>Refresh Data</Menu.Item>
            <Menu.Item onClick={onMenuSync} disabled={syncRunning}>
              {syncRunning ? 'Sync Running…' : 'Sync from Jira'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </Paper>
  );
}
