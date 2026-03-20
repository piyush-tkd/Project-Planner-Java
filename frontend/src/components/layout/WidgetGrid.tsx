/**
 * WidgetGrid — drag-to-reorder + hide/show for page panels.
 *
 * Each widget always shows a visible drag-handle header bar so it's
 * immediately obvious that panels can be repositioned.  Drag by grabbing
 * the ⠿⠿ handle; drop onto any other widget to reorder.  Every change is
 * persisted to the backend (debounced 600 ms).
 *
 * The "Customize layout" overlay lets you re-show hidden widgets and gives
 * a second drag surface for keyboard-accessible reordering.
 */

import React, {
  Children, isValidElement, useCallback, useEffect, useMemo, useState,
  useRef,
} from 'react';
import {
  ActionIcon, Badge, Box, Collapse, Group, Paper, Stack, Text, Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconLayoutDashboard, IconGripVertical, IconEye, IconEyeOff, IconX,
} from '@tabler/icons-react';
import { useWidgetPreferences } from '../../api/widgetPreferences';

// ── Widget props ──────────────────────────────────────────────────────────────

interface WidgetMeta { id: string; title: string; defaultVisible: boolean; }

interface WidgetProps {
  id: string;
  title: string;
  defaultVisible?: boolean;
  children: React.ReactNode;
}

/** Declare a widget slot inside a WidgetGrid. Children = panel content. */
export function Widget({ children }: WidgetProps) {
  return <>{children}</>;
}

// ── WidgetGrid ────────────────────────────────────────────────────────────────

interface WidgetGridProps {
  pageKey: string;
  children: React.ReactNode;
}

export default function WidgetGrid({ pageKey, children }: WidgetGridProps) {
  const { prefs, isLoading, save } = useWidgetPreferences(pageKey);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // ── widget metadata from JSX children ─────────────────────────────────────
  const allWidgets = useMemo<WidgetMeta[]>(() => {
    const metas: WidgetMeta[] = [];
    Children.forEach(children, child => {
      if (!isValidElement(child)) return;
      const p = child.props as WidgetProps;
      if (p.id) metas.push({ id: p.id, title: p.title ?? p.id, defaultVisible: p.defaultVisible !== false });
    });
    return metas;
  }, [children]);

  // ── order + visibility from persisted prefs ────────────────────────────────
  const [order,  setOrder]  = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading) return;
    const savedOrder  = prefs.order  ?? [];
    const savedHidden = prefs.hidden ?? [];
    const known = new Set(savedOrder);
    const merged = [
      ...savedOrder.filter(id => allWidgets.some(w => w.id === id)),
      ...allWidgets.filter(w => !known.has(w.id)).map(w => w.id),
    ];
    setOrder(merged);
    setHidden(new Set([
      ...savedHidden,
      ...allWidgets.filter(w => !w.defaultVisible && !savedOrder.includes(w.id)).map(w => w.id),
    ]));
  }, [isLoading, prefs, allWidgets]);

  // ── debounced persist ─────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((o: string[], h: Set<string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save({ order: o, hidden: [...h] }), 600);
  }, [save]);

  // ── DnD (HTML5, correct pattern) ──────────────────────────────────────────
  // • dragStart  → record source id + set dataTransfer (required by Firefox)
  // • dragOver   → e.preventDefault() to signal valid drop + set highlight
  // • dragLeave  → clear highlight (guard against child-element events)
  // • drop       → do the reorder here, on the target element
  // • dragEnd    → clear all visual state on the source

  const [dragging, setDragging] = useState<string | null>(null); // source id
  const [dragOver, setDragOver] = useState<string | null>(null); // target id

  const handleDragStart = useCallback((id: string, e: React.DragEvent) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id); // required for Firefox
  }, []);

  const handleDragOver = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(id);
  }, []);

  const handleDragLeave = useCallback((id: string, e: React.DragEvent) => {
    // Only clear if truly leaving this element (not moving to a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver(prev => (prev === id ? null : prev));
    }
  }, []);

  const handleDrop = useCallback((toId: string, e: React.DragEvent) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    setDragging(null);
    setDragOver(null);
    if (!fromId || fromId === toId) return;
    setOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(fromId);
      const ti = next.indexOf(toId);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, fromId);
      persist(next, hidden);
      return next;
    });
  }, [hidden, persist]);

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDragOver(null);
  }, []);

  // ── visibility ────────────────────────────────────────────────────────────
  const toggleHide = useCallback((id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persist(order, next);
      return next;
    });
  }, [order, persist]);

  // ── widget content map ────────────────────────────────────────────────────
  const widgetMap = useMemo<Map<string, React.ReactNode>>(() => {
    const map = new Map<string, React.ReactNode>();
    Children.forEach(children, child => {
      if (!isValidElement(child)) return;
      const p = child.props as WidgetProps;
      if (p.id) map.set(p.id, p.children);
    });
    return map;
  }, [children]);

  const hiddenCount  = allWidgets.filter(w => hidden.has(w.id)).length;
  const visibleOrder = order.filter(id => !hidden.has(id));

  return (
    <Stack gap="md">

      {/* ── top-right controls ───────────────────────────────────────────── */}
      <Group justify="flex-end" gap="xs">
        <Tooltip label="Show hidden widgets / reorder">
          <UnstyledButton onClick={() => setCustomizeOpen(o => !o)}>
            <Group gap={6}>
              <IconLayoutDashboard size={15} style={{ opacity: 0.55 }} />
              <Text size="xs" c="dimmed">Customize layout</Text>
              {hiddenCount > 0 && (
                <Badge size="xs" variant="light" color="gray">{hiddenCount} hidden</Badge>
              )}
            </Group>
          </UnstyledButton>
        </Tooltip>
      </Group>

      {/* ── customize overlay (hidden widgets + secondary drag list) ─────── */}
      <Collapse in={customizeOpen}>
        <Paper withBorder radius="md" p="sm" mb="xs"
               style={{ background: 'var(--mantine-color-gray-0)' }}
               onDragOver={e => e.preventDefault()}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>All widgets — drag to reorder, eye to hide/show</Text>
            <ActionIcon size="xs" variant="subtle" onClick={() => setCustomizeOpen(false)}>
              <IconX size={13} />
            </ActionIcon>
          </Group>
          <Stack gap={4}>
            {order.map(id => {
              const meta = allWidgets.find(w => w.id === id);
              if (!meta) return null;
              const isHidden = hidden.has(id);
              const isOver   = dragOver === `panel:${id}`;
              return (
                <Group
                  key={id}
                  gap="xs"
                  draggable
                  onDragStart={e => handleDragStart(id, e)}
                  onDragOver={e  => handleDragOver(`panel:${id}`, e)}
                  onDragLeave={e => handleDragLeave(`panel:${id}`, e)}
                  onDrop={e      => handleDrop(id, e)}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: '6px 8px', borderRadius: 6, cursor: 'grab',
                    userSelect: 'none',
                    background: isOver ? 'var(--mantine-color-blue-1)' : 'var(--mantine-color-default)',
                    border: isOver
                      ? '1px solid var(--mantine-color-blue-4)'
                      : '1px solid var(--mantine-color-default-border)',
                    opacity: dragging === id ? 0.4 : isHidden ? 0.5 : 1,
                    transition: 'background 80ms, border-color 80ms',
                  }}
                >
                  <IconGripVertical size={14} style={{ opacity: 0.45, flexShrink: 0 }} />
                  <Text size="sm" style={{ flex: 1 }}>{meta.title}</Text>
                  <Tooltip label={isHidden ? 'Show widget' : 'Hide widget'}>
                    <ActionIcon
                      size="xs" variant="subtle" color={isHidden ? 'gray' : 'blue'}
                      onClick={e => { e.stopPropagation(); toggleHide(id); }}
                    >
                      {isHidden ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                    </ActionIcon>
                  </Tooltip>
                </Group>
              );
            })}
          </Stack>
        </Paper>
      </Collapse>

      {/* ── rendered widgets with always-visible drag headers ────────────── */}
      {visibleOrder.map(id => {
        const content = widgetMap.get(id);
        if (content == null) return null;
        const meta     = allWidgets.find(w => w.id === id);
        const isTarget = dragOver === id;
        const isDragged = dragging === id;

        return (
          <Box
            key={id}
            onDragOver={e  => handleDragOver(id, e)}
            onDragLeave={e => handleDragLeave(id, e)}
            onDrop={e      => handleDrop(id, e)}
            style={{
              borderRadius: 10,
              outline: isTarget ? '2px solid var(--mantine-color-blue-5)' : '2px solid transparent',
              outlineOffset: 2,
              opacity: isDragged ? 0.38 : 1,
              transition: 'outline-color 100ms, opacity 120ms',
              background: isTarget ? 'var(--mantine-color-blue-0)' : undefined,
            }}
          >
            {/* ── Always-visible drag handle bar ── */}
            <Group
              draggable
              onDragStart={e => handleDragStart(id, e)}
              onDragEnd={handleDragEnd}
              gap="xs"
              justify="space-between"
              style={{
                padding: '5px 10px 5px 8px',
                borderRadius: '8px 8px 0 0',
                cursor: 'grab',
                userSelect: 'none',
                background: isTarget
                  ? 'var(--mantine-color-blue-1)'
                  : 'var(--mantine-color-gray-1)',
                borderBottom: '1px solid var(--mantine-color-default-border)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => {
                if (!isDragged)
                  (e.currentTarget as HTMLElement).style.background =
                    'var(--mantine-color-gray-2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = isTarget
                  ? 'var(--mantine-color-blue-1)'
                  : 'var(--mantine-color-gray-1)';
              }}
            >
              <Group gap={6}>
                <IconGripVertical
                  size={15}
                  style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}
                />
                <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '0.02em' }}>
                  {meta?.title}
                </Text>
              </Group>
              <Tooltip label="Hide this widget" position="left">
                <ActionIcon
                  size="xs" variant="subtle" color="gray"
                  onClick={e => { e.stopPropagation(); toggleHide(id); }}
                >
                  <IconEyeOff size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {/* ── Widget content ── */}
            <Box p="md" style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              {content}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
