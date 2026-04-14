/**
 * CommandPalette — ⌘K global command palette for Portfolio Planner.
 *
 * Features:
 *  - All 70+ nav pages indexed with group + keyword aliases
 *  - Quick-action shortcuts (Create project, Go to dashboard, etc.)
 *  - Recently visited pages (persisted in localStorage)
 *  - Keyboard-first: ⌘K to open, Esc to close, ↑/↓ to navigate, Enter to select
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { Command } from 'cmdk';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconSearch, IconLayoutDashboard, IconUsers, IconBriefcase,
  IconBolt, IconBrain, IconSettings, IconCalendar, IconChartBar,
  IconHexagons, IconPackage, IconTool, IconUserCog, IconDatabaseStar,
  IconKey, IconSparkles,
} from '@tabler/icons-react';
import { NAV_ITEMS, NAV_GROUPS } from '../../utils/navRegistry';
import { AQUA, DEEP_BLUE } from '../../brandTokens';
import apiClient from '../../api/client';

// ── Local recent pages ─────────────────────────────────────────────────────
const RECENT_KEY = 'pp_cmd_recent';
const MAX_RECENT = 6;

function loadRecent(): Array<{ path: string; label: string }> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecent(path: string, label: string) {
  const existing = loadRecent().filter(r => r.path !== path);
  const updated = [{ path, label }, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

// ── Group → icon map ───────────────────────────────────────────────────────
const GROUP_ICONS: Record<string, React.ElementType> = {
  Home:     IconLayoutDashboard,
  Portfolio: IconBriefcase,
  People:   IconUsers,
  Calendar: IconCalendar,
  Delivery: IconHexagons,
  Jira:     IconPackage,
  Admin:    IconBolt,
  Settings: IconSettings,
};

// ── Quick actions ──────────────────────────────────────────────────────────
interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  keywords: string;
  onSelect: (navigate: ReturnType<typeof useNavigate>) => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'go-dashboard',
    label: 'Go to Dashboard',
    icon: IconLayoutDashboard,
    keywords: 'dashboard home overview',
    onSelect: nav => nav('/'),
  },
  {
    id: 'go-sprints',
    label: 'Go to Sprint Planner',
    icon: IconCalendar,
    keywords: 'sprint planning sprints',
    onSelect: nav => nav('/sprint-planner'),
  },
  {
    id: 'go-resources',
    label: 'Go to Resources',
    icon: IconUsers,
    keywords: 'people resources team',
    onSelect: nav => nav('/people/resources'),
  },
  {
    id: 'go-projects',
    label: 'Go to Projects',
    icon: IconBriefcase,
    keywords: 'projects list all projects',
    onSelect: nav => nav('/projects'),
  },
  {
    id: 'ask-ai',
    label: 'Ask AI',
    icon: IconBrain,
    keywords: 'ai nlp assistant ask question',
    onSelect: nav => nav('/nlp'),
  },
  {
    id: 'go-settings',
    label: 'Open Settings',
    icon: IconSettings,
    keywords: 'settings config preferences',
    onSelect: nav => nav('/settings/org'),
  },
];

// ── Styles ─────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(4px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '15vh',
};

const panelStyle: React.CSSProperties = {
  background: '#13131e',
  border: '1px solid #2a2a3e',
  borderRadius: '14px',
  width: '600px',
  maxWidth: '90vw',
  maxHeight: '70vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(45,204,211,0.12)',
  animation: 'ppCmdEnter 180ms cubic-bezier(0.4,0,0.2,1)',
};

const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 18px',
  borderBottom: '1px solid #1e1e2e',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  color: '#e2e4eb',
  fontSize: '15px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  padding: '8px 0',
  flex: 1,
};

const groupHeadStyle: React.CSSProperties = {
  padding: '6px 16px 4px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#4a4a64',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 16px',
  cursor: 'pointer',
  borderRadius: '8px',
  margin: '0 8px',
  fontSize: '13px',
  color: '#b0b3c1',
  transition: 'background 120ms, color 120ms',
};

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid #1e1e2e',
  padding: '8px 18px',
  display: 'flex',
  gap: '16px',
  fontSize: '11px',
  color: '#4a4a64',
};

const kbdStyle: React.CSSProperties = {
  background: '#1a1a2a',
  border: '1px solid #2a2a3e',
  borderRadius: '4px',
  padding: '1px 5px',
  fontSize: '10px',
  marginRight: '4px',
  color: '#6a6a80',
};

// ── Settings shortcuts ────────────────────────────────────────────────────
const SETTINGS_SHORTCUTS = [
  { label: 'Jira Settings', path: '/settings/jira', icon: IconPackage },
  { label: 'Cost Rates', path: '/settings/cost-rates', icon: IconDatabaseStar },
  { label: 'Custom Fields', path: '/settings/custom-fields', icon: IconKey },
  { label: 'User Management', path: '/settings/user-management', icon: IconUserCog },
];

// ── Component ──────────────────────────────────────────────────────────────
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// Minimal project type for search results
interface ProjectSearchHit {
  id: number;
  name: string;
  status: string;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [recent, setRecent] = useState(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProjects, setAllProjects] = useState<ProjectSearchHit[]>([]);

  // Refresh recent list and pre-fetch projects when palette opens
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setSearchQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
      // Fetch project list for search (lightweight: just id, name, status)
      apiClient.get<ProjectSearchHit[]>('/projects?size=500&fields=id,name,status')
        .then(r => setAllProjects(r.data ?? []))
        .catch(() => { /* suppress — search degrades gracefully */ });
    }
  }, [open]);

  const goTo = useCallback((path: string, label: string) => {
    saveRecent(path, label);
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  if (!open) return null;

  const groupedItems = NAV_GROUPS.map(group => ({
    group,
    icon: GROUP_ICONS[group] ?? IconTool,
    items: NAV_ITEMS.filter(i => i.group === group),
  }));

  return (
    <div style={overlayStyle} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <Command label="Portfolio Planner Command Palette" loop>
          {/* Search input */}
          <div style={inputWrapStyle}>
            <IconSearch size={16} color="#4a4a64" />
            <Command.Input
              ref={inputRef}
              placeholder="Search pages, projects, actions…"
              onValueChange={setSearchQuery}
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            />
          </div>

          <Command.List style={listStyle}>
            {/* PP-13 §7: informative no-results state */}
            <Command.Empty style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <IconSearch size={28} color="#6b7280" strokeWidth={1.5} />
                <div style={{ fontSize: 14, fontWeight: 500, color: '#4a4a64' }}>No results found</div>
                <div style={{ fontSize: 12, color: '#8b9ab3', lineHeight: 1.5, maxWidth: 280 }}>
                  Try different keywords, or use <strong>G+letter</strong> shortcuts to navigate directly.
                </div>
              </div>
            </Command.Empty>

            {/* Recent pages */}
            {recent.length > 0 && (
              <Command.Group heading={<span style={groupHeadStyle}>Recent</span>}>
                {recent.map(r => {
                  const GI = GROUP_ICONS[
                    NAV_ITEMS.find(n => n.path === r.path)?.group ?? ''
                  ] ?? IconLayoutDashboard;
                  return (
                    <Command.Item
                      key={`recent-${r.path}`}
                      value={`recent ${r.label} ${r.path}`}
                      onSelect={() => goTo(r.path, r.label)}
                      style={itemStyle}
                    >
                      <GI size={14} color={AQUA} />
                      <span>{r.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#3a3a52' }}>Recent</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Ask AI Shortcut */}
            <Command.Group heading={<span style={groupHeadStyle}>AI Assistant</span>}>
              <Command.Item
                key="ask-ai-spotlight"
                value="ask-ai nlp assistant ai ask question"
                onSelect={() => { navigate('/nlp'); onClose(); }}
                style={itemStyle}
              >
                <IconSparkles size={14} color={AQUA} />
                <span style={{ fontWeight: 500 }}>Ask AI Assistant</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#3a3a52' }}>⌘K+AI</span>
              </Command.Item>
            </Command.Group>

            {/* Projects — shown when user types a query */}
            {searchQuery.trim().length >= 1 && (() => {
              const q = searchQuery.trim().toLowerCase();
              const hits = allProjects
                .filter(p => p.name.toLowerCase().includes(q))
                .slice(0, 8);
              if (hits.length === 0) return null;
              return (
                <Command.Group heading={<span style={groupHeadStyle}>Projects</span>}>
                  {hits.map(proj => (
                    <Command.Item
                      key={`proj-${proj.id}`}
                      value={`project ${proj.name} ${proj.id}`}
                      onSelect={() => goTo(`/projects/${proj.id}`, proj.name)}
                      style={itemStyle}
                    >
                      <IconBriefcase size={14} color={AQUA} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proj.name}
                      </span>
                      <span style={{ fontSize: '10px', color: '#4a4a64', flexShrink: 0 }}>
                        {proj.status?.replace(/_/g, ' ')}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })()}

            {/* Quick actions */}
            <Command.Group heading={<span style={groupHeadStyle}>Quick Actions</span>}>
              {QUICK_ACTIONS.map(action => {
                const AI = action.icon;
                return (
                  <Command.Item
                    key={action.id}
                    value={`action ${action.label} ${action.keywords}`}
                    onSelect={() => { action.onSelect(navigate); onClose(); }}
                    style={itemStyle}
                  >
                    <AI size={14} color="#6a6a80" />
                    <span>{action.label}</span>
                    {action.id === 'go-dashboard' && (
                      <span style={{ marginLeft: 'auto' }}>
                        <kbd style={kbdStyle}>G</kbd><kbd style={kbdStyle}>D</kbd>
                      </span>
                    )}
                    {action.id === 'go-sprints' && (
                      <span style={{ marginLeft: 'auto' }}>
                        <kbd style={kbdStyle}>G</kbd><kbd style={kbdStyle}>S</kbd>
                      </span>
                    )}
                    {action.id === 'go-resources' && (
                      <span style={{ marginLeft: 'auto' }}>
                        <kbd style={kbdStyle}>G</kbd><kbd style={kbdStyle}>R</kbd>
                      </span>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Settings Shortcuts */}
            <Command.Group heading={<span style={groupHeadStyle}>Settings</span>}>
              {SETTINGS_SHORTCUTS.map(setting => {
                const SI = setting.icon;
                return (
                  <Command.Item
                    key={`settings-${setting.path}`}
                    value={`settings ${setting.label} ${setting.path}`}
                    onSelect={() => goTo(setting.path, setting.label)}
                    style={itemStyle}
                  >
                    <SI size={14} color="#6a6a80" />
                    <span>{setting.label}</span>
                    {location.pathname === setting.path && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: AQUA }}>Current</span>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* All pages, grouped */}
            {groupedItems.map(({ group, icon: GIcon, items }) => (
              <Command.Group key={group} heading={<span style={groupHeadStyle}>{group}</span>}>
                {items.map(item => (
                  <Command.Item
                    key={item.path}
                    value={`${item.label} ${item.group} ${(item.keywords ?? []).join(' ')}`}
                    onSelect={() => goTo(item.path, item.label)}
                    style={itemStyle}
                  >
                    <GIcon size={14} color="#5a5a74" />
                    <span>{item.label}</span>
                    {location.pathname === item.path && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: AQUA }}>Current</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer hint */}
          <div style={footerStyle}>
            <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> open</span>
            <span><kbd style={kbdStyle}>Esc</kbd> close</span>
            <span style={{ marginLeft: 'auto', color: '#3a3a52', fontSize: '10px' }}>
              Type to search pages &amp; projects
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
