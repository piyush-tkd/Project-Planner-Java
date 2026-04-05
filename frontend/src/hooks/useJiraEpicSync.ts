import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';

interface PushResult {
  epicKey: string;
  projectId: number;
}

interface UsePushToJiraOptions {
  onSuccess?: (result: PushResult) => void;
}

/**
 * Hook for pushing a MANUAL PP project to Jira as an Epic.
 */
export function usePushToJira({ onSuccess }: UsePushToJiraOptions = {}) {
  const queryClient = useQueryClient();
  const [pushing, setPushing] = useState(false);

  const pushToJira = async (projectId: number, jiraProjectKey: string): Promise<PushResult | null> => {
    setPushing(true);
    try {
      const { data } = await apiClient.post<PushResult>(
        `/jira-sync/push/${projectId}`,
        { jiraProjectKey }
      );
      notifications.show({
        title: 'Pushed to Jira',
        message: `Epic ${data.epicKey} created successfully`,
        color: 'teal',
      });
      // Invalidate projects query so the source badge updates
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onSuccess?.(data);
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to push to Jira';
      notifications.show({ title: 'Push failed', message: msg, color: 'red' });
      return null;
    } finally {
      setPushing(false);
    }
  };

  return { pushToJira, pushing };
}

/**
 * Hook for triggering a manual full Jira epic sync.
 */
export function useForceJiraSync() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const forceSync = async () => {
    setSyncing(true);
    try {
      const { data } = await apiClient.post('/jira-sync/run');
      notifications.show({
        title: 'Sync complete',
        message: `Created ${data.created}, updated ${data.updated}${data.failed > 0 ? `, failed ${data.failed}` : ''}`,
        color: data.failed > 0 ? 'orange' : 'teal',
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      notifications.show({ title: 'Sync failed', message: 'Check Jira credentials in Admin Settings', color: 'red' });
    } finally {
      setSyncing(false);
    }
  };

  return { forceSync, syncing };
}
