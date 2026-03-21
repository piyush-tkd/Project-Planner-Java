import { useState, useMemo, useEffect } from 'react';
import {
  Menu, Button, ActionIcon, Popover, TextInput, Group, Stack, Text, Badge,
} from '@mantine/core';
import { IconBookmark, IconX, IconPlus } from '@tabler/icons-react';
import { AQUA } from '../../brandTokens';

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
}

const STORAGE_KEY = (key: string) => `pp_saved_views_${key}`;
const MAX_VIEWS = 10;

export default function SavedViews({ pageKey, currentFilters, onApply }: SavedViewsProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Load saved views from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(pageKey));
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse saved views', e);
      }
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

    setSavedViews(prev => {
      const updated = [newView, ...prev];
      return updated.slice(0, MAX_VIEWS);
    });

    setNewViewName('');
    setPopoverOpen(false);
  };

  const handleDeleteView = (id: string) => {
    setSavedViews(prev => prev.filter(v => v.id !== id));
  };

  const handleApplyView = (view: SavedView) => {
    onApply(view.filters);
  };

  // Check if current filters match any saved view
  const isCurrentlySaved = useMemo(() => {
    return savedViews.some(view =>
      JSON.stringify(view.filters) === JSON.stringify(currentFilters),
    );
  }, [savedViews, currentFilters]);

  return (
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
          <Menu.Item disabled c="dimmed">
            No saved views yet
          </Menu.Item>
        ) : (
          savedViews.map(view => (
            <Menu.Item
              key={view.id}
              onClick={() => handleApplyView(view)}
              rightSection={
                <ActionIcon
                  size="xs"
                  color="red"
                  variant="subtle"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteView(view.id);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              }
            >
              <Group gap={8}>
                <Text size="sm">{view.name}</Text>
                {isCurrentlySaved && view.filters === currentFilters && (
                  <Badge size="xs" color={AQUA}>active</Badge>
                )}
              </Group>
            </Menu.Item>
          ))
        )}

        <Menu.Divider />

        <Menu.Item disabled>
          <Popover opened={popoverOpen} onClose={() => setPopoverOpen(false)} position="right" withArrow>
            <Popover.Target>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={e => {
                  e.preventDefault();
                  setPopoverOpen(true);
                }}
                fullWidth
                justify="flex-start"
              >
                Save current view
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap={8} style={{ minWidth: 200 }}>
                <Text size="sm" fw={500}>Name this view</Text>
                <TextInput
                  placeholder="e.g., Active Developers"
                  value={newViewName}
                  onChange={e => setNewViewName(e.currentTarget.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSaveView();
                    }
                  }}
                  autoFocus
                  size="sm"
                />
                <Group gap={6}>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => {
                      setNewViewName('');
                      setPopoverOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleSaveView}
                    disabled={!newViewName.trim() || savedViews.length >= MAX_VIEWS}
                  >
                    Save
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
