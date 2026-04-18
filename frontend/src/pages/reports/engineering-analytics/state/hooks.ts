import { useState, useEffect } from 'react';

// Global avatar map — fetched once and shared across all tab components
let _avatarCache: Record<string, string> | null = null;

export async function getAvatarMap(): Promise<Record<string, string>> {
  if (_avatarCache) return _avatarCache;
  try {
    const { default: apiClient } = await import('../../../../api/client');
    const res = await apiClient.get('/engineering-analytics/assignee-avatars');
    _avatarCache = res.data ?? {};
    return _avatarCache!;
  } catch { return {}; }
}

// Hook to load avatar map once
export function useAvatarMap() {
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useEffect(() => { getAvatarMap().then(setAvatars); }, []);
  return avatars;
}
