import _React, { useState } from 'react';
import { Box, ActionIcon, Tooltip, Text, Group, Button, NumberInput } from '@mantine/core';
import { IconLayoutGrid } from '@tabler/icons-react';
import { Widget } from '../../state/types';
import { parsePosition } from '../helpers';

const SIZE_PRESETS = [
  { label: '¼',   w: 3,  h: 3, title: 'Small (3×3)' },
  { label: '⅓',   w: 4,  h: 4, title: 'Narrow (4×4)' },
  { label: '½',   w: 6,  h: 4, title: 'Half width (6×4)' },
  { label: '⅔',   w: 8,  h: 4, title: 'Wide (8×4)' },
  { label: 'Full',w: 12, h: 5, title: 'Full width (12×5)' },
  { label: 'Tall',w: 6,  h: 7, title: 'Tall half (6×7)' },
];

function WidgetLayoutPopover({ widget, dark, onReposition }: {
  widget: Widget; dark: boolean;
  onReposition: (pos: { x: number; y: number; w: number; h: number }) => void;
}) {
  const pos = parsePosition(widget.position);
  const [localPos, setLocalPos] = useState({ x: pos.x ?? 0, y: pos.y ?? 0, w: pos.w ?? 6, h: pos.h ?? 4 });
  const [open, setOpen] = useState(false);

  const apply = (p: typeof localPos) => {
    setLocalPos(p);
    onReposition(p);
    setOpen(false);
  };

  return (
    <Tooltip label="Layout & Size">
      <Box style={{ position: 'relative', display: 'inline-block' }}>
        <ActionIcon size="xs" variant="subtle"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      aria-label="Grid layout"
    >
          <IconLayoutGrid size={13} />
        </ActionIcon>
        {open && (
          <Box
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 22, right: 0, zIndex: 1000,
              width: 280, padding: 12, borderRadius: 8,
              backgroundColor: dark ? '#1a1a2e' : '#fff',
              border: `1px solid ${dark ? '#333' : '#e0e0e0'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
            <Text size="xs" fw={700} c="dimmed" mb={8}>SIZE PRESETS</Text>
            <Group gap={4} mb={12} wrap="wrap">
              {SIZE_PRESETS.map(p => (
                <Tooltip key={p.label} label={p.title}>
                  <Button size="xs" variant="light"
                    onClick={() => apply({ ...localPos, w: p.w, h: p.h })}>
                    {p.label}
                  </Button>
                </Tooltip>
              ))}
            </Group>

            <Text size="xs" fw={700} c="dimmed" mb={6}>MANUAL POSITION</Text>
            <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <NumberInput size="xs" label="Column (x)" min={0} max={11}
                value={localPos.x} onChange={v => setLocalPos(p => ({ ...p, x: Number(v ?? 0) }))} />
              <NumberInput size="xs" label="Row (y)" min={0} max={50}
                value={localPos.y} onChange={v => setLocalPos(p => ({ ...p, y: Number(v ?? 0) }))} />
              <NumberInput size="xs" label="Width (cols)" min={1} max={12}
                value={localPos.w} onChange={v => setLocalPos(p => ({ ...p, w: Number(v ?? 1) }))} />
              <NumberInput size="xs" label="Height (rows)" min={1} max={20}
                value={localPos.h} onChange={v => setLocalPos(p => ({ ...p, h: Number(v ?? 1) }))} />
            </Box>

            <Group justify="flex-end" mt={10} gap={6}>
              <Button size="xs" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="xs" onClick={() => apply(localPos)}>Apply</Button>
            </Group>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

export default WidgetLayoutPopover;
