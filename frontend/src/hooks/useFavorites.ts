/**
 * useFavorites — backend-synced page favorites (starred pages).
 *
 * Reads from GET /api/favorites on mount.
 * Falls back to localStorage (`pp_sidebar_favs`) if the API is unavailable.
 * toggle(path, label) adds or removes a favorite and immediately updates the
 * backend plus the local cache.
 *
 * Usage:
 *   const { favorites, isFavorite, toggle, loading } = useFavorites();
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

const LS_KEY = 'pp_sidebar_favs';

export interface FavoriteEntry {
  id?: number;
  pagePath: string;
  pageLabel: string;
  sortOrder: number;
}

interface FavoritesState {
  /** Ordered list of favorited pages */
  favorites: FavoriteEntry[];
  /** Whether the initial fetch is in-flight */
  loading: boolean;
  /** Returns true if the given path is favorited */
  isFavorite: (path: string) => boolean;
  /** Toggle a page favorite on/off */
  toggle: (path: string, label: string) => Promise<void>;
}

function readLocalStorage(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const paths: string[] = JSON.parse(raw);
    // Legacy format: array of paths only
    if (Array.isArray(paths) && typeof paths[0] === 'string') {
      return paths.map((p, i) => ({ pagePath: p, pageLabel: p, sortOrder: i }));
    }
    // New format: array of FavoriteEntry objects
    return paths as unknown as FavoriteEntry[];
  } catch {
    return [];
  }
}

function writeLocalStorage(entries: FavoriteEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries.map(e => e.pagePath)));
  } catch { /* ignore */ }
}

export function useFavorites(): FavoritesState {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(readLocalStorage);
  const [loading, setLoading] = useState(true);

  // Initial fetch from backend
  useEffect(() => {
    let cancelled = false;
    apiClient.get<FavoriteEntry[]>('/favorites')
      .then(res => {
        if (!cancelled) {
          setFavorites(res.data);
          // Keep localStorage in sync as fallback
          writeLocalStorage(res.data);
        }
      })
      .catch(() => {
        // API unavailable — stay with localStorage fallback
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isFavorite = useCallback(
    (path: string) => favorites.some(f => f.pagePath === path),
    [favorites],
  );

  const toggle = useCallback(async (path: string, label: string) => {
    const already = favorites.some(f => f.pagePath === path);

    if (already) {
      // Optimistic remove
      setFavorites(prev => {
        const next = prev.filter(f => f.pagePath !== path);
        writeLocalStorage(next);
        return next;
      });
      try {
        await apiClient.delete('/favorites', { params: { path } });
      } catch {
        // Re-fetch on error to resync
        try {
          const res = await apiClient.get<FavoriteEntry[]>('/favorites');
          setFavorites(res.data);
          writeLocalStorage(res.data);
        } catch { /* stay with optimistic state */ }
      }
    } else {
      // Optimistic add
      const newEntry: FavoriteEntry = {
        pagePath: path,
        pageLabel: label,
        sortOrder: favorites.length,
      };
      setFavorites(prev => {
        const next = [...prev, newEntry];
        writeLocalStorage(next);
        return next;
      });
      try {
        const res = await apiClient.post<FavoriteEntry>('/favorites', {
          pagePath: path,
          pageLabel: label,
        });
        // Update with server-assigned id / sortOrder
        setFavorites(prev =>
          prev.map(f => f.pagePath === path ? { ...f, id: res.data.id, sortOrder: res.data.sortOrder } : f),
        );
      } catch {
        /* stay with optimistic state */
      }
    }
  }, [favorites]);

  return { favorites, loading, isFavorite, toggle };
}
