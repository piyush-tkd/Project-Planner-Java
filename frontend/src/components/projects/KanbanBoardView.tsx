import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Box, Text, Badge, Group, Stack, Tooltip, Avatar,
  ActionIcon, Card, ScrollArea, TextInput,
  Modal, Button,
} from '@mantine/core';
import {
  IconPlus, IconClock, IconX, IconCheck, IconTrash,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA } from '../../brandTokens';

const CUSTOM_LANES_KEY = 'pp_kanban_custom_lanes';
const HIDDEN_LANES_KEY = 'pp_kanban_hidden_lanes';

interface Project {
  id: number;
  name: string;
  status: string;
  priority: string;
  owner?: string;
  targetDate?: string;
  pod?: string;
  defaultPattern?: string;
}

interface KanbanBoardViewProps {
  projects: Project[];
  onProjectClick?: (id: number) => void;
  onStatusChange?: (projectId: number, newStatus: string) => void;
  onDeleteProject?: (id: number) => void;
  /** Called when user clicks "+ Add" inside a column; receives the column's status key */
  onAddProject?: (status: string) => void;
}

const DEFAULT_COLUMNS: { key: string; label: string; color: string; borderColor: string }[] = [
  { key: 'NOT_STARTED',   label: 'Not Started',   color: '#f8fafc', borderColor: '#94a3b8' },
  { key: 'IN_DISCOVERY',  label: 'In Discovery',  color: '#eff6ff', borderColor: '#3b82f6' },
  { key: 'ACTIVE',        label: 'Active',        color: '#f0fdf4', borderColor: '#22c55e' },
  { key: 'ON_HOLD',       label: 'On Hold',       color: '#fefce8', borderColor: '#eab308' },
  { key: 'COMPLETED',     label: 'Completed',     color: '#f0fdf4', borderColor: '#15803d' },
  { key: 'CANCELLED',     label: 'Cancelled',     color: '#fef2f2', borderColor: '#ef4444' },
];

const CUSTOM_COLUMN_COLORS = [
  { color: '#faf5ff', borderColor: '#a855f7' },
  { color: '#fff1f2', borderColor: '#f43f5e' },
  { color: '#f0f9ff', borderColor: '#0ea5e9' },
  { color: '#fefce8', borderColor: '#f59e0b' },
  { color: '#f0fdf4', borderColor: '#10b981' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'P0': { label: 'P0', color: '#dc2626', bg: '#fef2f2' },
  'P1': { label: 'P1', color: '#ea580c', bg: '#fff7ed' },
  'P2': { label: 'P2', color: '#2563eb', bg: '#eff6ff' },
  'P3': { label: 'P3', color: '#16a34a', bg: '#f0fdf4' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, color: '#64748b', bg: '#f8fafc' };
  return (
    <Box
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '1px 7px', borderRadius: 20,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}33`,
      }}
    >
      {cfg.label}
    </Box>
  );
}

// Vibrant gradient palettes per priority for the card header strip
const CARD_PALETTE: Record<string, { gradient: string; accent: string; textColor: string }> = {
  P0: { gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', accent: '#ee5a24', textColor: '#fff' },
  P1: { gradient: 'linear-gradient(135deg, #fd9644 0%, #e67e22 100%)', accent: '#e67e22', textColor: '#fff' },
  P2: { gradient: 'linear-gradient(135deg, #4dabf7 0%, #228be6 100%)', accent: '#228be6', textColor: '#fff' },
  P3: { gradient: 'linear-gradient(135deg, #adb5bd 0%, #868e96 100%)', accent: '#868e96', textColor: '#fff' },
};

function KanbanCard({
  project,
  onClick,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  project: Project;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const initials = project.owner
    ? project.owner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const palette = CARD_PALETTE[project.priority] ?? CARD_PALETTE['P3'];

  return (
    <Card
      className="kanban-card"
      draggable
      onDragStart={e => { setDragging(true); onDragStart?.(e); }}
      onDragEnd={e => { setDragging(false); onDragEnd?.(e); }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        position: 'relative',
        opacity: dragging ? 0.45 : 1,
        transform: dragging ? 'rotate(2deg) scale(0.97)' : undefined,
        transition: 'opacity 0.1s, transform 0.1s, box-shadow 0.15s',
        boxShadow: hovered && !dragging
          ? `0 4px 16px ${palette.accent}33, 0 1px 4px rgba(0,0,0,0.08)`
          : '0 1px 4px rgba(0,0,0,0.06)',
        borderLeft: `3px solid ${palette.accent}`,
        padding: 0,
        overflow: 'hidden',
      }}
      radius="md"
      withBorder
    >
      {/* Coloured header strip */}
      <Box
        style={{
          background: palette.gradient,
          padding: '7px 10px 6px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <Text
          size="xs"
          fw={700}
          lineClamp={2}
          style={{ color: palette.textColor, flex: 1, lineHeight: 1.35, fontSize: 12 }}
        >
          {project.name}
        </Text>
        <Box
          style={{
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 800,
            color: palette.textColor,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {project.priority}
        </Box>
      </Box>

      {/* Card body */}
      <Box p="xs" style={{ background: 'var(--mantine-color-body)' }}>
        {/* Delete button — appears on hover */}
        {onDelete && hovered && (
          <ActionIcon
            size="xs"
            variant="filled"
            color="red"
            style={{ position: 'absolute', top: 34, right: 6, zIndex: 2 }}
            onClick={e => { e.stopPropagation(); onDelete(e); }}
            title="Delete project"
          >
            <IconTrash size={11} />
          </ActionIcon>
        )}

        {project.pod && (
          <Text size="xs" c="dimmed" mb={4}>{project.pod}</Text>
        )}

        <Group justify="space-between" mt={2}>
          {project.targetDate ? (
            <Group gap={3}>
              <IconClock size={11} color="#94a3b8" />
              <Text size="xs" c="dimmed">{project.targetDate}</Text>
            </Group>
          ) : <Box />}
          {project.owner && (
            <Tooltip label={project.owner} withArrow>
              <Avatar
                size={20}
                radius="xl"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: palette.gradient,
                  color: '#fff',
                  border: `2px solid ${palette.accent}44`,
                }}
              >
                {initials}
              </Avatar>
            </Tooltip>
          )}
        </Group>
      </Box>
    </Card>
  );
}

export default function KanbanBoardView({ projects, onProjectClick, onStatusChange, onDeleteProject, onAddProject }: KanbanBoardViewProps) {
  // Custom lanes — persisted to localStorage so they survive refreshes
  const [customLanes, setCustomLanes] = useState<{ key: string; label: string; color: string; borderColor: string }[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_LANES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  // Hidden default lanes — default columns the user has dismissed, persisted to localStorage
  const [hiddenDefaultLanes, setHiddenDefaultLanes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_LANES_KEY);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const [addLaneOpen, setAddLaneOpen] = useState(false);
  const [newLaneName, setNewLaneName] = useState('');
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<Project | null>(null);

  // Persist custom lanes whenever they change
  useEffect(() => {
    try { localStorage.setItem(CUSTOM_LANES_KEY, JSON.stringify(customLanes)); } catch {}
  }, [customLanes]);

  // Persist hidden default lanes
  useEffect(() => {
    try { localStorage.setItem(HIDDEN_LANES_KEY, JSON.stringify([...hiddenDefaultLanes])); } catch {}
  }, [hiddenDefaultLanes]);

  // Drag state
  const draggingProjectId = useRef<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Optimistic status for immediate visual feedback while API is in flight
  const [optimisticStatus, setOptimisticStatus] = useState<Record<number, string>>({});

  // Combine default + custom lanes, filtering out hidden defaults
  const allColumns = useMemo(() => {
    const visibleDefaults = DEFAULT_COLUMNS.filter(c => !hiddenDefaultLanes.has(c.key));
    const knownKeys = new Set([...DEFAULT_COLUMNS.map(c => c.key), ...customLanes.map(c => c.key)]);
    const extraStatuses = projects
      .map(p => (p.status || 'NOT_STARTED').toUpperCase())
      .filter(s => !knownKeys.has(s) && !hiddenDefaultLanes.has(s));
    const uniqueExtra = [...new Set(extraStatuses)];

    const extraCols = uniqueExtra.map((s, i) => ({
      key: s,
      label: s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      ...CUSTOM_COLUMN_COLORS[i % CUSTOM_COLUMN_COLORS.length],
    }));

    return [...visibleDefaults, ...customLanes, ...extraCols];
  }, [customLanes, projects, hiddenDefaultLanes]);

  const columns = useMemo(() => {
    return allColumns.map(col => ({
      ...col,
      items: projects.filter(p => {
        const s = optimisticStatus[p.id] ?? (p.status || 'NOT_STARTED');
        return s.toUpperCase() === col.key;
      }),
    }));
  }, [allColumns, projects, optimisticStatus]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, projectId: number) => {
    draggingProjectId.current = projectId;
    setDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(projectId));
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingProjectId.current = null;
    setDragging(false);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(colKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    const rel = e.relatedTarget as Node | null;
    if (rel && (e.currentTarget as HTMLElement).contains(rel)) return;
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const projectId = draggingProjectId.current;
    if (projectId == null) return;

    const project = projects.find(p => p.id === projectId);
    const currentStatus = (project?.status || 'NOT_STARTED').toUpperCase();
    if (currentStatus === colKey) return;

    // Optimistic update
    setOptimisticStatus(prev => ({ ...prev, [projectId]: colKey }));
    setDragOverColumn(null);

    // Notify parent (triggers API call)
    onStatusChange?.(projectId, colKey);
  }, [projects, onStatusChange]);

  // ── Add custom lane ────────────────────────────────────────────────────────

  const handleAddLane = () => {
    const key = newLaneName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!key) return;

    // If this matches a previously-hidden default lane, just unhide it
    if (hiddenDefaultLanes.has(key)) {
      setHiddenDefaultLanes(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setAddLaneOpen(false);
      setNewLaneName('');
      return;
    }

    // Don't add duplicates of currently-visible lanes
    if (allColumns.some(c => c.key === key)) {
      setAddLaneOpen(false);
      setNewLaneName('');
      return;
    }

    const colorIdx = customLanes.length % CUSTOM_COLUMN_COLORS.length;
    setCustomLanes(prev => [
      ...prev,
      { key, label: newLaneName.trim(), ...CUSTOM_COLUMN_COLORS[colorIdx] },
    ]);
    setAddLaneOpen(false);
    setNewLaneName('');
  };

  const handleDeleteLane = (key: string) => {
    const isDefaultLane = DEFAULT_COLUMNS.some(d => d.key === key);
    if (isDefaultLane) {
      // Hide it — added to the hidden-defaults set so it disappears from allColumns
      setHiddenDefaultLanes(prev => new Set([...prev, key]));
    } else {
      // Remove custom / auto-discovered lane from the list
      setCustomLanes(prev => prev.filter(l => l.key !== key));
    }
    // Move any projects that were in this lane to NOT_STARTED
    const affectedProjects = projects.filter(p => {
      const s = optimisticStatus[p.id] ?? (p.status || 'NOT_STARTED');
      return s.toUpperCase() === key;
    });
    for (const p of affectedProjects) {
      setOptimisticStatus(prev => ({ ...prev, [p.id]: 'NOT_STARTED' }));
      onStatusChange?.(p.id, 'NOT_STARTED');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollArea type="auto" offsetScrollbars>
        <Box
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            paddingBottom: 16,
            minWidth: 'max-content',
          }}
        >
          {columns.map(col => {
            const isOver = dragOverColumn === col.key;
            // Deletable = any lane except NOT_STARTED (the fallback bucket must always exist)
            const isDeletable = col.key !== 'NOT_STARTED';
            return (
              <Box
                key={col.key}
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.key)}
                style={{
                  minWidth: 280,
                  background: isOver ? `${col.borderColor}18` : col.color,
                  borderRadius: 8,
                  padding: 12,
                  border: isOver
                    ? `2px solid ${col.borderColor}`
                    : `1px solid ${col.borderColor}44`,
                  transition: 'border 0.15s, background 0.15s',
                }}
              >
                {/* Column header */}
                <Box
                  style={{
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: `2px solid ${col.borderColor}`,
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap={6}>
                      <Box
                        style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: col.borderColor,
                        }}
                      />
                      <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.7px', color: col.borderColor }}>
                        {col.label}
                      </Text>
                    </Group>
                    <Group gap={4}>
                      <Badge
                        size="sm"
                        variant="light"
                        style={{
                          background: col.color,
                          color: col.borderColor,
                          border: `1px solid ${col.borderColor}44`,
                          fontSize: 11, fontWeight: 700,
                        }}
                      >
                        {col.items.length}
                      </Badge>
                      {isDeletable && (
                        <Tooltip label={col.items.length > 0 ? `Remove lane (${col.items.length} project${col.items.length !== 1 ? 's' : ''} → Not Started)` : 'Remove lane'} withArrow>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteLane(col.key)}
                            title="Remove lane"
                          >
                            <IconX size={11} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>
                </Box>

                {/* Cards */}
                <Stack gap={8} style={{ minHeight: 60 }}>
                  {col.items.length === 0 ? (
                    <Box
                      style={{
                        padding: '24px 16px', textAlign: 'center',
                        color: isOver ? col.borderColor : '#94a3b8',
                        fontSize: 12,
                        border: `2px dashed ${isOver ? col.borderColor : '#e2e8f0'}`,
                        borderRadius: 8,
                        transition: 'all 0.15s',
                      }}
                    >
                      {isOver && dragging ? 'Drop here' : 'No projects'}
                    </Box>
                  ) : (
                    <>
                      {col.items.map(project => (
                        <KanbanCard
                          key={project.id}
                          project={project}
                          onClick={() => onProjectClick?.(project.id)}
                          onDelete={onDeleteProject ? () => setDeleteProjectConfirm(project) : undefined}
                          onDragStart={e => handleDragStart(e, project.id)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                      {/* Drop indicator at bottom when dragging over non-empty column */}
                      {isOver && dragging && (
                        <Box
                          style={{
                            height: 4,
                            borderRadius: 4,
                            background: col.borderColor,
                            opacity: 0.7,
                            transition: 'all 0.15s',
                          }}
                        />
                      )}
                    </>
                  )}

                  {/* ── Per-column Add project button ── */}
                  {onAddProject && (
                    <Box
                      onClick={() => onAddProject(col.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: `1.5px dashed ${col.borderColor}66`,
                        color: col.borderColor,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: 0.75,
                        transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
                        marginTop: col.items.length > 0 ? 4 : 0,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '1';
                        (e.currentTarget as HTMLElement).style.background = `${col.borderColor}12`;
                        (e.currentTarget as HTMLElement).style.borderColor = col.borderColor;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '0.75';
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.borderColor = `${col.borderColor}66`;
                      }}
                    >
                      <IconPlus size={13} />
                      Add project
                    </Box>
                  )}
                </Stack>
              </Box>
            );
          })}

          {/* Add lane button */}
          <Box
            onClick={() => setAddLaneOpen(true)}
            style={{
              minWidth: 180,
              height: 80,
              borderRadius: 8,
              border: '2px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-color 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            className="kanban-add-lane"
          >
            <IconPlus size={16} />
            Add Lane
          </Box>
        </Box>
      </ScrollArea>

      {/* Delete project confirmation modal */}
      <Modal
        opened={!!deleteProjectConfirm}
        onClose={() => setDeleteProjectConfirm(null)}
        title={<Text fw={700} c="red" size="sm">Delete Project?</Text>}
        size="xs"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{deleteProjectConfirm?.name}</strong>? This cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setDeleteProjectConfirm(null)}>Cancel</Button>
            <Button
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => {
                if (deleteProjectConfirm) {
                  onDeleteProject?.(deleteProjectConfirm.id);
                  setDeleteProjectConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add lane modal */}
      <Modal
        opened={addLaneOpen}
        onClose={() => { setAddLaneOpen(false); setNewLaneName(''); }}
        title="New swimlane"
        size="xs"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Lane name"
            placeholder="e.g. Awaiting Approval"
            value={newLaneName}
            onChange={e => setNewLaneName(e.currentTarget.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddLane()}
            data-autofocus
          />
          <Text size="xs" c="dimmed">
            Moving a card into this lane will save that name as the project's status in the database.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => { setAddLaneOpen(false); setNewLaneName(''); }}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={14} />}
              disabled={!newLaneName.trim()}
              onClick={handleAddLane}
              style={{ background: DEEP_BLUE }}
            >
              Add Lane
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
