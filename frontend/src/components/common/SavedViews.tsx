import { useState, useMemo, useEffect } from 'react';
import {
  Menu, Button, ActionIcon, Popover, TextInput, Group, Stack, Text, Badge, UnstyledButton,
  Tooltip,
} from '@mantine/core';
import { IconBookmark, IconX, IconPlus, IconStar, IconStarFilled } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string | null>;
  createdAt: number;
}

interface SavedViewsProps {
  pageKey: string;
  currentFilters: Record<string, string | null>;
  onApply: (filters: Record<string, string | null>) => void;
  /** When true, renders saved views as pill tabs below the filter bar */
  variant?: 'dropdown' | 'tabs';
  /** The view id that is currently active (for tabs variant) */
  activeViewId?: string | null;
  onActiveViewChange?: (id: string | null) => void;
}

const STORAGE_KEY = (key: string) => `pp_saved_views_${key}`;
const MAX_VIEWS = 12;

export default function SavedViews({
  pageKey,
  currentFilters,
  onApply,
  variant = 'dropdown',
  activeViewId,
  onActiveViewChange,
}: SavedViewsProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Load saved views from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(pageKey));
    if (stored) {
      try { setSavedViews(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [pageKey]);

  // Persist to localStorage whenever savedViews changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(pageKey), JSON.stringify(savedViews));
  }, [savedViews, pageKey]);

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name: newViewName.trim(),
      filters: { ...currentFilters },
      createdAt: Date.now(),
    };
    setSavedViews(prev => [newView, ...prev].slice(0, MAX_VIEWS));
    setNewViewName('');
    setPopoverOpen(false);
    onActiveViewChange?.(newView.id);
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedViews(prev => prev.filter(v => v.id !== id));
    if (activeViewId === id) onActiveViewChange?.(null);
  };

  const handleApplyView = (view: SavedView) => {
    onApply(view.filters);
    onActiveViewChange?.(view.id);
  };

  // Check if current filters match any saved view
  const matchedViewId = useMemo(() => {
    const current = JSON.stringify(currentFilters);
    return savedViews.find(v => JSON.stringify(v.filters) === current)?.id ?? null;
  }, [savedViews, currentFilters]);

  /* ── Save-button popover (shared across variants) ──────────────────── */
  const savePopover = (
    <Popover opened={popoverOpen} onClose={() => setPopoverOpen(false)} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <Tooltip label="Save current filters as a named view">
          <ActionIcon
            variant="light"
            color="teal"
            size="sm"
            onClick={() => setPopoverOpen(o => !o)}
            aria-label="Save current view"
          >
            <IconStar size={14} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={8} style={{ minWidth: 220 }}>
          <Text size="xs" fw={600} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Name this view</Text>
          <TextInput
            placeholder="e.g. Active Developers"
            value={newViewName}
            onChange={e => setNewViewName(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); }}
            autoFocus
            size="xs"
          />
          <Group gap={6}>
            <Button variant="default" size="xs" onClick={() => { setNewViewName(''); setPopoverOpen(false); }}>
              Cancel
            </Button>
            <Button
              size="xs"
              color="teal"
              onClick={handleSaveView}
              disabled={!newViewName.trim() || savedViews.length >= MAX_VIEWS}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );

  /* ── TABS variant ──────────────────────────────────────────────────── */
  if (variant === 'tabs') {
    return (
      <Group gap={6} align="center" wrap="wrap">
        {/* "All" pill — resets to no view */}
        <UnstyledButton
          onClick={() => { onApply(Object.fromEntries(Object.keys(currentFilters).map(k => [k, null]))); onActiveViewChange?.(null); }}
          style={{
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            background: activeViewId === null ? AQUA : 'transparent',
            color: activeViewId === null ? '#fff' : 'var(--mantine-color-dimmed)',
            border: `1px solid ${activeViewId === null ? AQUA : 'var(--mantine-color-default-border)'}`,
            transition: 'all 0.15s',
            cursor: 'pointer',
          }}
        >
          All
        </UnstyledButton>

        {savedViews.map(view => {
          const isActive = activeViewId === view.id || matchedViewId === view.id;
          return (
            <Group key={view.id} gap={0} wrap="nowrap" style={{ position: 'relative' }}>
              <UnstyledButton
                onClick={() => handleApplyView(view)}
                style={{
                  padding: '3px 10px',
                  paddingRight: 28,
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  background: isActive ? AQUA : 'transparent',
                  color: isActive ? '#fff' : 'inherit',
                  border: `1px solid ${isActive ? AQUA : 'var(--mantine-color-default-border)'}`,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {view.name}
              </UnstyledButton>
              <ActionIcon
                size={14}
                variant="transparent"
                color={isActive ? 'white' : 'gray'}
                onClick={e => handleDeleteView(view.id, e)}
                aria-label={`Remove view ${view.name}`}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
              >
                <IconX size={9} />
              </ActionIcon>
            </Group>
          );
        })}

        {/* Save current view button */}
        {savePopover}
      </Group>
    );
  }

  /* ── DROPDOWN variant (original) ──────────────────────────────────── */
  return (
    <Group gap={6}>
      <Menu shadow="md">
        <Menu.Target>
          <Button
            variant="subtle"
            leftSection={<IconBookmark size={16} style={{ color: AQUA }} />}
            size="sm"
            fw={500}
          >
            Saved Views
            {savedViews.length > 0 && <Badge size="sm" ml={6}>{savedViews.length}</Badge>}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          {savedViews.length === 0 ? (
            <Menu.Item disabled c="dimmed">No saved views yet</Menu.Item>
          ) : (
            savedViews.map(view => (
              <Menu.Item
                key={view.id}
                onClick={() => handleApplyView(view)}
                rightSection={
                  <ActionIcon
                    size="xs" color="red" variant="subtle"
                    onClick={e => handleDeleteView(view.id, e)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                }
              >
                <Group gap={8}>
                  <Text size="sm">{view.name}</Text>
                  {matchedViewId === view.id && <Badge size="xs" color="teal">active</Badge>}
                </Group>
              </Menu.Item>
            ))
          )}

          <Menu.Divider />
          <Menu.Item>
            <Group gap={6}>
              <IconStarFilled size={14} style={{ color: AQUA }} />
              <Text size="sm" onClick={() => setPopoverOpen(true)} style={{ cursor: 'pointer' }}>
                Save current view
              </Text>
            </Group>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {popoverOpen && savePopover}
    </Group>
  );
}
