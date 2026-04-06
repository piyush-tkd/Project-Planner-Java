/**
 * Notification Preferences — API hooks for per-user notification settings.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotificationPreference {
  id:                  number;
  username:            string;
  onStatusChange:      boolean;
  onRiskAdded:         boolean;
  onCommentMention:    boolean;
  onSprintStart:       boolean;
  onAutomationFired:   boolean;
  onTargetDatePassed:  boolean;
  emailEnabled:        boolean;
  emailDigest:         'NONE' | 'DAILY' | 'WEEKLY';
  quietStartHour:      number | null;
  quietEndHour:        number | null;
}

const QK = ['notification-preferences'] as const;

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useNotificationPreferences() {
  return useQuery<NotificationPreference>({
    queryKey: QK,
    queryFn: async () => {
      const r = await apiClient.get('/notification-preferences');
      return r.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pref: Partial<NotificationPreference>) =>
      apiClient.put('/notification-preferences', pref).then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(QK, updated);
    },
  });
}
