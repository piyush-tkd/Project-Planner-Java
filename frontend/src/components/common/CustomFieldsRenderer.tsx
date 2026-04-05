import { TextInput, NumberInput, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { FONT_FAMILY } from '../../brandTokens';

export interface FieldDefinition {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
  optionsJson?: string | null;
  required: boolean;
  sortOrder: number;
  active: boolean;
}

interface Props {
  definitions: FieldDefinition[];
  values: Record<string, string>;
  onChange: (fieldName: string, value: string) => void;
  readOnly?: boolean;
}

export default function CustomFieldsRenderer({ definitions, values, onChange, readOnly = false }: Props) {
  return (
    <>
      {definitions.map(def => {
        const value = values[def.fieldName] ?? '';

        if (def.fieldType === 'select') {
          let options: string[] = [];
          try { options = def.optionsJson ? JSON.parse(def.optionsJson) : []; } catch {}
          return (
            <Select
              key={def.fieldName}
              label={def.fieldLabel}
              data={options}
              value={value || null}
              onChange={v => onChange(def.fieldName, v ?? '')}
              required={def.required}
              clearable
              disabled={readOnly}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          );
        }

        if (def.fieldType === 'number') {
          return (
            <NumberInput
              key={def.fieldName}
              label={def.fieldLabel}
              value={value !== '' ? Number(value) : undefined}
              onChange={v => onChange(def.fieldName, v !== undefined && v !== '' ? String(v) : '')}
              required={def.required}
              disabled={readOnly}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          );
        }

        if (def.fieldType === 'date') {
          return (
            <DateInput
              key={def.fieldName}
              label={def.fieldLabel}
              value={value ? new Date(value) : null}
              onChange={v => onChange(def.fieldName, v ? v.toISOString().slice(0, 10) : '')}
              required={def.required}
              disabled={readOnly}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          );
        }

        // Default: text
        return (
          <TextInput
            key={def.fieldName}
            label={def.fieldLabel}
            value={value}
            onChange={e => onChange(def.fieldName, e.currentTarget.value)}
            required={def.required}
            disabled={readOnly}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
        );
      })}
    </>
  );
}
