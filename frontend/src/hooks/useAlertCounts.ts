/**
 * useAlertCounts — computes alert badge counts for nav items.
 * All queries use DB-backed or cached data so there's no extra Jira API cost.
 */
import { useMemo } from 'react';
import { useJiraStatus, useSupportSnapshot, useSupportBoards, SupportTicket } from '../api/jira';
import { useExecutiveSummary } from '../api/reports';

export interface AlertCounts {
  /** Stale support tickets (orange/red badge on Support Queue nav) */
  supportStale: number;
  /** POD-months in deficit (badge on Reports nav) */
  reportsDeficit: number;
  /** Blocker/Critical open tickets for the notification bell */
  criticalTickets: SupportTicket[];
}

const CRITICAL_PRIORITIES = new Set(['Blocker', 'Critical', 'Highest']);

export function useAlertCounts(): AlertCounts {
  const { data: jiraStatus } = useJiraStatus();
  const { data: supportBoards = [] } = useSupportBoards();
  const hasConfiguredBoards = supportBoards.some(b => b.enabled);

  const { data: supportSnapshot } = useSupportSnapshot(
    jiraStatus?.configured === true && hasConfiguredBoards,
  );
  const { data: summary } = useExecutiveSummary();

  return useMemo(() => {
    const allTickets = (supportSnapshot?.boards ?? []).flatMap(b => b.tickets);
    const supportStale = allTickets.filter(t => t.stale).length;
    const reportsDeficit = summary?.podMonthsInDeficit ?? 0;
    const criticalTickets = allTickets.filter(
      t => CRITICAL_PRIORITIES.has(t.priority ?? '') &&
           t.status?.toLowerCase() !== 'done' &&
           t.statusCategory?.toLowerCase() !== 'done',
    );
    return { supportStale, reportsDeficit, criticalTickets };
  }, [supportSnapshot, summary]);
}
