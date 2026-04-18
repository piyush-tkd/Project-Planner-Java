import { Priority, ProjectStatus } from '../../types';
import type { ProjectResponse } from '../../types';
import { applyAdvancedFilters } from '../../components/common/AdvancedFilterPanel';
import type { AdvancedFilters } from '../../components/common/AdvancedFilterPanel';

/**
 * Classify a project for the status tabs.
 * Jira-synced projects store the raw Jira status string in `status` and
 * may have `jiraStatusCategory` set. Older imports may have category=null,
 * so we fall back to keyword matching on the raw status string.
 */
export function projectMatchesTab(
  p: { status: string; jiraStatusCategory?: string | null; sourceType?: string | null },
  tab: string,
): boolean {
  const cat = p.jiraStatusCategory;
  const raw = (p.status ?? '').toUpperCase();
  const isJira = p.sourceType === 'JIRA_SYNCED' || p.sourceType === 'PUSHED_TO_JIRA';

  switch (tab) {
    case ProjectStatus.ACTIVE:
      return (
        p.status === ProjectStatus.ACTIVE ||
        cat === 'indeterminate' ||
        (isJira && cat == null && /ACTIVE|IN.PROGRESS|IN.DEV|DEVELOPMENT|TESTING|REVIEW|ONGOING|IMPLEMENTATION|WIP|STARTED|PROGRES/.test(raw))
      );

    case ProjectStatus.COMPLETED:
      return (
        p.status === ProjectStatus.COMPLETED ||
        cat === 'done' ||
        (isJira && cat == null && /DONE|COMPLET|CLOSED|RELEASED|SHIPPED|RESOLVED|FINISH/.test(raw))
      );

    case ProjectStatus.NOT_STARTED:
      return (
        p.status === ProjectStatus.NOT_STARTED ||
        cat === 'new' ||
        (isJira && cat == null && /NOT.START|NEW|BACKLOG|OPEN|TODO|TO.DO|FUNNEL|DRAFT/.test(raw))
      );

    case ProjectStatus.ON_HOLD:
      return (
        p.status === ProjectStatus.ON_HOLD ||
        /HOLD|PAUSED|BLOCKED|DEFERRED|PARKED|SUSPEND|WAIT/.test(raw)
      );

    case ProjectStatus.CANCELLED:
      return (
        p.status === ProjectStatus.CANCELLED ||
        /CANCEL|REJECT|ABANDON|SCRAP/.test(raw)
      );

    case ProjectStatus.IN_DISCOVERY:
      return (
        p.status === ProjectStatus.IN_DISCOVERY ||
        /DISCOVERY|PLANNING|SCOPING|INCEPTION|ASSESS/.test(raw)
      );

    default:
      return p.status === tab;
  }
}

export function mapJiraPriorityToPP(jiraPriority?: string): Priority {
  switch ((jiraPriority ?? '').trim().toUpperCase()) {
    case 'HIGHEST':
    case 'CRITICAL':
    case 'BLOCKER':
      return Priority.HIGHEST;
    case 'HIGH':
      return Priority.HIGH;
    case 'LOW':
      return Priority.LOW;
    case 'LOWEST':
    case 'TRIVIAL':
      return Priority.LOWEST;
    default:
      return Priority.MEDIUM;
  }
}

export function mapJiraStatusToPP(statusName?: string, categoryKey?: string): ProjectStatus {
  const s = (statusName ?? '').trim().toUpperCase();
  switch (s) {
    case 'BACKLOG':
    case 'FUNNEL':
    case 'READY':
    case 'TO DO':
    case 'TODO':
    case 'OPEN':
    case 'SELECTED FOR DEVELOPMENT':
    case 'READY FOR DEV':
    case 'READY FOR DEVELOPMENT':
    case 'READY TO START':
    case 'PLANNING':
    case 'PROPOSED':
    case 'DISCOVERY':
    case 'IDEATION':
    case 'DRAFT':
    case 'NEW':
    case 'IN SCOPING':
      return ProjectStatus.NOT_STARTED;
    case 'IN PROGRESS':
    case 'IN-PROGRESS':
    case 'REVIEW':
    case 'IN DEVELOPMENT':
    case 'IN REVIEW':
    case 'IN-REVIEW':
    case 'CODE REVIEW':
    case 'TESTING':
    case 'IN TESTING':
    case 'QA':
    case 'IN QA':
    case 'UAT':
    case 'ACTIVE':
    case 'UNDER REVIEW':
    case 'PEER REVIEW':
    case 'TECH REVIEW':
    case 'STEERING COMMITTEE REVIEW':
    case 'TECHNOLOGY REVIEW':
    case 'COMPLIANCE REVIEW':
    case 'ONGOING':
    case 'DEVELOPMENT':
    case 'IMPLEMENTATION':
    case 'READY FOR QA':
    case 'READY FOR REVIEW':
      return ProjectStatus.ACTIVE;
    case 'DONE':
    case 'CLOSED':
    case 'RESOLVED':
    case 'COMPLETED':
    case 'RELEASED':
    case 'DEPLOYED':
    case 'MERGED':
    case 'FINISHED':
      return ProjectStatus.COMPLETED;
    case 'BLOCKED':
    case 'ON HOLD':
    case 'ON-HOLD':
    case 'HOLD':
    case 'HOLD/PAUSED':
    case 'ON PAUSE':
    case 'PAUSED':
    case 'WAITING':
    case 'DEFERRED':
    case 'PARKED':
    case 'SUSPENDED':
    case 'PENDING':
      return ProjectStatus.ON_HOLD;
    case 'CANCELLED':
    case 'CANCELED':
    case 'REJECTED':
    case 'WONT DO':
    case 'ABANDONED':
    case 'WITHDRAWN':
      return ProjectStatus.CANCELLED;
    default:
      break;
  }
  // Fall back to category key
  switch ((categoryKey ?? '').toLowerCase()) {
    case 'new':
      return ProjectStatus.NOT_STARTED;
    case 'done':
      return ProjectStatus.COMPLETED;
    default:
      return ProjectStatus.ACTIVE;
  }
}

export function filterProjects(
  projects: ProjectResponse[],
  {
    cardFilter,
    statusFilter,
    search,
    ownerFilter,
    priorityFilter,
    sourceFilter,
    advFilters,
  }: {
    cardFilter: string | null;
    statusFilter: string;
    search: string;
    ownerFilter: string | null;
    priorityFilter: string | null;
    sourceFilter: string;
    advFilters: AdvancedFilters;
  },
): ProjectResponse[] {
  let list = projects;

  // Source filter: ARCHIVED shows only archived; others hide archived by default
  if (sourceFilter === 'ARCHIVED') {
    list = list.filter(p => p.archived);
  } else {
    list = list.filter(p => !p.archived);
    if (sourceFilter !== 'ALL') {
      list = list.filter(p => p.sourceType === sourceFilter);
    }
  }

  if (cardFilter === 'CRITICAL') {
    list = list.filter(
      p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER,
    );
  } else if (statusFilter !== 'ALL') {
    list = list.filter(p => projectMatchesTab(p, statusFilter));
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }

  if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
  if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);

  // Apply advanced AND/OR filters last
  list = applyAdvancedFilters(list as unknown as Record<string, unknown>[], advFilters) as unknown as typeof list;

  return list;
}

export function filterBoardProjects(
  projects: ProjectResponse[],
  {
    cardFilter,
    search,
    ownerFilter,
    priorityFilter,
    advFilters,
  }: {
    cardFilter: string | null;
    search: string;
    ownerFilter: string | null;
    priorityFilter: string | null;
    advFilters: AdvancedFilters;
  },
): ProjectResponse[] {
  // Board view ignores the status segment filter — columns already group by status.
  // Only apply search + owner + priority filters so all status columns show correctly.
  let list = projects;

  if (cardFilter === 'CRITICAL') {
    list = list.filter(
      p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER,
    );
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }

  if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
  if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);

  list = applyAdvancedFilters(list as unknown as Record<string, unknown>[], advFilters) as unknown as typeof list;

  return list;
}

export function calculateProjectStats(
  projects: ProjectResponse[],
): { total: number; active: number; onHold: number; p0p1: number; avgDuration: number } {
  // Exclude archived projects
  const all = projects.filter(p => !p.archived);
  const active = all.filter(p => projectMatchesTab(p, ProjectStatus.ACTIVE)).length;
  const onHold = all.filter(p => projectMatchesTab(p, ProjectStatus.ON_HOLD)).length;
  const critical = all.filter(
    p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER,
  ).length;
  const avgDuration = all.length > 0 ? Math.round((all.reduce((s, p) => s + p.durationMonths, 0) / all.length) * 10) / 10 : 0;

  return { total: all.length, active, onHold, p0p1: critical, avgDuration };
}
