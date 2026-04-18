import { Group, TextInput, Select, ActionIcon, Tooltip, Menu, Checkbox } from '@mantine/core';
import { IconSearch, IconX, IconAdjustments, IconColumns } from '@tabler/icons-react';
import type { AdvancedFilters, FilterField } from '../../../components/common/AdvancedFilterPanel';
import type { Density, ColKey } from '../types';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  ownerFilter: string | null;
  onOwnerFilterChange: (v: string | null) => void;
  ownerOptions: { value: string; label: string }[];
  priorityFilter: string | null;
  onPriorityFilterChange: (v: string | null) => void;
  priorityOptions: { value: string; label: string }[];
  advFilters: AdvancedFilters;
  onAdvFiltersChange: (v: AdvancedFilters) => void;
  projectFilterFields: FilterField[];
  onClearAllFilters: () => void;
  filteredCount: number;
  totalCount: number;
  density: Density;
  onDensityChange: (v: Density) => void;
  visibleColsArray: ColKey[];
  onToggleCol: (col: ColKey) => void;
  visibleCols: Set<ColKey>;
}

const COL_LABELS: ColKey[] = ['#', 'Priority', 'Owner', 'Start', 'End', 'Duration', 'Pattern', 'Status', 'Budget', 'Health', 'Created'];

export default function FilterBar({
  search, onSearchChange,
  ownerFilter, onOwnerFilterChange, ownerOptions,
  priorityFilter, onPriorityFilterChange, priorityOptions,
  onClearAllFilters,
  density, onDensityChange,
  visibleCols, onToggleCol,
}: FilterBarProps) {
  const hasActiveFilters = !!search || !!ownerFilter || !!priorityFilter;

  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder="Search projects…"
        leftSection={<IconSearch size={14} />}
        rightSection={search ? (
          <ActionIcon size="xs" variant="transparent" onClick={() => onSearchChange('')} aria-label="Clear search">
            <IconX size={12} />
          </ActionIcon>
        ) : null}
        value={search}
        onChange={e => onSearchChange(e.currentTarget.value)}
        style={{ flex: 1, minWidth: 180 }}
      />

      <Select
        placeholder="Owner"
        data={ownerOptions}
        value={ownerFilter}
        onChange={onOwnerFilterChange}
        clearable
        style={{ width: 150 }}
      />

      <Select
        placeholder="Priority"
        data={priorityOptions}
        value={priorityFilter}
        onChange={onPriorityFilterChange}
        clearable
        style={{ width: 140 }}
      />

      {hasActiveFilters && (
        <Tooltip label="Clear all filters">
          <ActionIcon variant="subtle" color="red" onClick={onClearAllFilters} aria-label="Clear all filters">
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      <Tooltip label="Row density">
        <Select
          data={[
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'comfortable', label: 'Comfortable' },
          ]}
          value={density}
          onChange={v => v && onDensityChange(v as Density)}
          style={{ width: 130 }}
        />
      </Tooltip>

      <Menu shadow="md" width={180}>
        <Menu.Target>
          <Tooltip label="Toggle columns">
            <ActionIcon variant="subtle" aria-label="Toggle columns"><IconColumns size={16} /></ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          {COL_LABELS.map(col => (
            <Menu.Item key={col} onClick={() => onToggleCol(col)}>
              <Group gap="xs">
                <Checkbox
                  size="xs"
                  checked={visibleCols.has(col)}
                  onChange={() => onToggleCol(col)}
                  aria-label={`Toggle ${col} column`}
                  readOnly
                />
                {col}
              </Group>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Tooltip label="Advanced filters">
        <ActionIcon variant="subtle" aria-label="Advanced filters">
          <IconAdjustments size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
