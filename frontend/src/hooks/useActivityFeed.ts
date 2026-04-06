/**
 * useActivityFeed
 *
 * Polls /api/projects/activity every 30 seconds to surface recent project changes.
 * Falls back gracefully when the endpoint isn't available (returns empty list).
 *
 * The backend endpoint is expected to return ActivityItem[]. Until it is wired up,
 * this hook generates synthetic feed entries from the cached project list so the
 * UI always shows something useful.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useProjects } from '../api/projects';
import { useMemo } from 'react';

export interface ActivityItem {
  id: string;
  type: 'status_change' | 'created' | 'updated' | 'deleted' | 'flagged' | 'risk_added' | 'automation_fired';
  entityType: 'project' | 'resource' | 'pod' | 'rule';
  entityId: number;
  entityName: string;
  actor: string;
  message: string;
  timestamp: string; // ISO
  metadata?: Record<string, unknown>;
}

const THIRTY_SECONDS = 30_000;

/** Fetches live activity from the backend (when endpoint exists). */
function useLiveActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ['activity-feed'],
    queryFn: () => apiClient.get('/activity').then(r => r.data),
    refetchInterval: THIRTY_SECONDS,
    retry: false,
    // Don't throw on 404 — endpoint may not be deployed yet
    throwOnError: false,
  });
}

/** Derives synthetic feed items from recently-updated projects (client-side fallback). */
function useSyntheticFeed(): ActivityItem[] {
  const { data: projects } = useProjects();

  return useMemo(() => {
    if (!projects?.length) return [];

    const STATUS_LABELS: Record<string, string> = {
      ACTIVE: 'Active', NOT_STARTED: 'Not Started', ON_HOLD: 'On Hold',
      COMPLETED: 'Completed', CANCELLED: 'Cancelled', IN_DISCOVERY: 'In Discovery',
    };

    // Take the 10 most-recently created projects as synthetic feed
    return [...projects]
      .sort((a, b) => {
        const ta = a.createdAt ?? '';
        const tb = b.createdAt ?? '';
        return tb.localeCompare(ta);
      })
      .slice(0, 10)
      .map(p => ({
        id:         `syn-${p.id}`,
        type:       'created' as const,
        entityType: 'project' as const,
        entityId:   p.id,
        entityName: p.name,
        actor:      p.owner ?? 'System',
        message:    `Project created with status "${STATUS_LABELS[p.status] ?? p.status}"`,
        timestamp:  p.createdAt ?? new Date().toISOString(),
        metadata:   { status: p.status, priority: p.priority },
      }));
  }, [projects]);
}

export function useActivityFeed(): { items: ActivityItem[]; isLive: boolean; refetch: () => void } {
  const live = useLiveActivity();
  const synthetic = useSyntheticFeed();

  const isLive   = !live.isError && !!live.data?.length;
  const items    = isLive ? (live.data ?? []) : synthetic;

  return { items, isLive, refetch: live.refetch };
}
