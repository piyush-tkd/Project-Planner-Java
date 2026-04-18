import { Group, Select, TextInput, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { WidgetFilter } from '../../state/types';
import { useFieldValues } from '../../state/hooks';
import { FILTER_OPS } from '../constants';

function FilterRow({ filter, source, dimOptions, onChange, onRemove }: {
  filter: WidgetFilter;
  source: string;
  dimOptions: { value: string; label: string }[];
  onChange: (f: WidgetFilter) => void;
  onRemove: () => void;
}) {
  const needsValues = filter.field && !['is_null', 'is_not_null'].includes(filter.op);
  const isSpecial = filter.field === 'label' || (filter.field ?? '').startsWith('cf_');
  const { data: fieldValues = [] } = useFieldValues(
    isSpecial && needsValues ? filter.field : null, source
  );

  return (
    <Group gap={4} wrap="nowrap">
      <Select size="xs" value={filter.field || null} data={dimOptions} searchable
        style={{ flex: 2 }} placeholder="Field"
        onChange={v => onChange({ ...filter, field: v ?? '', value: '' })} />
      <Select size="xs" value={filter.op} data={FILTER_OPS} style={{ flex: 1 }}
        onChange={v => onChange({ ...filter, op: v ?? 'eq' })} />
      {needsValues && (
        isSpecial && fieldValues.length > 0 ? (
          <Select size="xs" value={String(filter.value ?? '')} searchable clearable
            style={{ flex: 2 }} placeholder="Select value..."
            data={fieldValues.map(v => ({ value: v, label: v }))}
            onChange={v => onChange({ ...filter, value: v ?? '' })} />
        ) : (
          <TextInput size="xs" value={String(filter.value ?? '')} style={{ flex: 2 }}
            placeholder="value"
            onChange={e => onChange({ ...filter, value: e.target.value })} />
        )
      )}
      <ActionIcon size="xs" color="red" variant="subtle" onClick={onRemove}
      aria-label="Delete"
    >
        <IconTrash size={12} />
      </ActionIcon>
    </Group>
  );
}

export { FilterRow };
