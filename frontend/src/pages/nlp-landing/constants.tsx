import {
  IconChartBar, IconAlertTriangle, IconPlayerPlay, IconBriefcase,
  IconChartAreaLine, IconCalendarStats, IconUsers, IconUser, IconNotes,
  IconRoute, IconForms, IconBulb, IconHelp, IconHexagons,   IconDownload, IconArrowsSplit, IconListCheck,
  IconRocket, } from '@tabler/icons-react';

export const QUICK_ACTIONS = [
  { label: 'Show capacity gaps', query: 'show me the capacity gap report', icon: <IconChartBar size={16} /> },
  { label: 'Which pods are over capacity?', query: 'which pods are over capacity?', icon: <IconAlertTriangle size={16} /> },
  { label: 'Go to Sprint Planner', query: 'open sprint planner', icon: <IconPlayerPlay size={16} /> },
  { label: 'Create a new project', query: 'create a new project', icon: <IconBriefcase size={16} /> },
  { label: 'Show utilization heatmap', query: 'show utilization heatmap', icon: <IconChartAreaLine size={16} /> },
  { label: 'View team calendar', query: 'go to team calendar', icon: <IconCalendarStats size={16} /> },
  { label: 'Add a new resource', query: 'add a new resource', icon: <IconUsers size={16} /> },
  { label: 'Lookup a resource', query: 'who is ', icon: <IconUser size={16} /> },
  { label: 'Look up a Jira ticket', query: 'tell me about ', icon: <IconNotes size={16} /> },
];

export const INTENT_ICONS: Record<string, React.ReactNode> = {
  NAVIGATE: <IconRoute size={20} />,
  FORM_PREFILL: <IconForms size={20} />,
  DATA_QUERY: <IconChartBar size={20} />,
  INSIGHT: <IconBulb size={20} />,
  HELP: <IconHelp size={20} />,
};

export const INTENT_LABELS: Record<string, string> = {
  NAVIGATE: 'Navigation',
  FORM_PREFILL: 'Form Pre-fill',
  DATA_QUERY: 'Data Query',
  INSIGHT: 'Insight',
  HELP: 'Help',
  UNKNOWN: 'Unknown',
};

export const STATUS_COLORS: Record<string, string> = {
  'Active': 'teal',
  'Completed': 'gray',
  'In Discovery': 'blue',
  'Not Started': 'orange',
  'On Hold': 'yellow',
  'Cancelled': 'red',
  'Upcoming': 'blue',
  'Released': 'green',
  'Code Frozen': 'cyan',
};

export const ROLE_COLORS: Record<string, string> = {
  'Developer': 'indigo',
  'DEVELOPER': 'indigo',
  'QA': 'orange',
  'BSA': 'cyan',
  'Tech Lead': 'red',
  'TECH_LEAD': 'red',
};

export const LOCATION_COLORS: Record<string, string> = {
  'INDIA': 'violet',
  'India': 'violet',
  'US': 'blue',
  'USA': 'blue',
  'Houston': 'blue',
};

export const ENTITY_SIGNATURES: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  RESOURCE_PROFILE: { icon: <IconUser size={16} />, color: 'blue', label: 'Resource' },
  PROJECT_PROFILE: { icon: <IconBriefcase size={16} />, color: 'teal', label: 'Project' },
  POD_PROFILE: { icon: <IconHexagons size={16} />, color: 'grape', label: 'POD' },
  SPRINT_PROFILE: { icon: <IconPlayerPlay size={16} />, color: 'orange', label: 'Sprint' },
  RELEASE_PROFILE: { icon: <IconRocket size={16} />, color: 'cyan', label: 'Release' },
  COMPARISON: { icon: <IconArrowsSplit size={16} />, color: 'indigo', label: 'Comparison' },
  LIST: { icon: <IconListCheck size={16} />, color: 'teal', label: 'List' },
  EXPORT: { icon: <IconDownload size={16} />, color: 'green', label: 'Export' },
  RISK_SUMMARY: { icon: <IconAlertTriangle size={16} />, color: 'red', label: 'Risk' },
  RESOURCE_ANALYTICS: { icon: <IconChartBar size={16} />, color: 'blue', label: 'Analytics' },
  CAPABILITIES: { icon: <IconHelp size={16} />, color: 'gray', label: 'Help' },
  PROJECT_ESTIMATES: { icon: <IconChartBar size={16} />, color: 'teal', label: 'Estimates' },
  SPRINT_ALLOCATIONS: { icon: <IconCalendarStats size={16} />, color: 'orange', label: 'Allocations' },
  JIRA_ISSUE_PROFILE: { icon: <IconNotes size={16} />, color: 'blue', label: 'Jira Issue' },
};

export const MAX_RECENT_QUERIES = 5;
export const MAX_SESSION_MEMORY = 5;
export const NLP_LIST_PAGE_SIZE = 5;

export const ROLE_BADGE_COLORS: Record<string, string> = {
  Dev: 'indigo',
  QA: 'orange',
  BSA: 'cyan',
  TL: 'red',
};

export const WITTY_EMPTY_STATES = [
  { emoji: '🔍', title: 'Looked everywhere — nada.', sub: 'Even checked under the couch cushions.' },
  { emoji: '🕵️', title: 'The search party came back empty-handed.', sub: 'Sherlock would be stumped too.' },
  { emoji: '🏜️', title: 'It\'s a desert out here.', sub: 'Not a single result in sight.' },
  { emoji: '👻', title: 'Ghost town.', sub: 'Whatever you\'re looking for isn\'t haunting our database.' },
  { emoji: '🧊', title: 'Cold case.', sub: 'No matches found in the system.' },
  { emoji: '🪄', title: 'Poof — nothing appeared.', sub: 'Even magic has its limits.' },
  { emoji: '🗺️', title: 'X marks the spot… but the treasure isn\'t here.', sub: 'Time to redraw the map.' },
  { emoji: '🎣', title: 'Cast the line, but no bites today.', sub: 'Try different bait — rephrase your query!' },
  { emoji: '🛸', title: 'Beam me up — there\'s nothing here.', sub: 'This search returned from another dimension… empty.' },
  { emoji: '🧩', title: 'Missing piece.', sub: 'We couldn\'t find what fits this puzzle.' },
];

export const SSE_PHASE_MAP: Record<string, number> = {
  thinking: 0,
  searching: 1,
  matched: 2,
  analyzing: 2,
  finalizing: 3,
};
