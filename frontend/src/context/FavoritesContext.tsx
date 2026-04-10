/**
 * FavoritesContext — shares one useFavorites instance across the whole app
 * so AppShell and PPPageLayout both read the same state without double-fetching.
 */
import React, { createContext, useContext } from 'react';
import { useFavorites, type FavoriteEntry } from '../hooks/useFavorites';

interface FavoritesContextValue {
  favorites: FavoriteEntry[];
  loading: boolean;
  isFavorite: (path: string) => boolean;
  toggle: (path: string, label: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const value = useFavorites();
  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavoritesContext must be used inside <FavoritesProvider>');
  return ctx;
}
