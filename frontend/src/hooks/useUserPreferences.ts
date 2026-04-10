/**
 * useUserPreferences — DL-15
 *
 * Persistent user preferences stored in localStorage.
 * All keys are namespaced under `pp_prefs_v1`.
 *
 * Usage:
 *   const { prefs, setDensity, setAnimations } = useUserPreferences();
 */
import { useState, useCallback, useEffect } from 'react';

// ── Preference schema ──────────────────────────────────────────────────────

export type TableDensity  = 'comfortable' | 'compact' | 'spacious';
export type ColorScheme   = 'dark' | 'light' | 'system';
export type SidebarWidth  = 'default' | 'narrow' | 'wide';

export interface UserPreferences {
  /** Dark / light / follow-OS */
  colorScheme: ColorScheme;
  /** Table row density */
  tableDensity: TableDensity;
  /** Whether page-entrance animations play */
  animations: boolean;
  /** Sidebar width */
  sidebarWidth: SidebarWidth;
  /** Show metric card sparklines */
  showSparklines: boolean;
  /** Compact sidebar (hide labels, just icons) */
  sidebarCompact: boolean;
  /** Default landing page after login */
  defaultPage: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: UserPreferences = {
  colorScheme:    'dark',
  tableDensity:   'comfortable',
  animations:     true,
  sidebarWidth:   'default',
  showSparklines: true,
  sidebarCompact: false,
  defaultPage:    '/dashboard',
};

// ── Storage helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = 'pp_prefs_v1';

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePrefs(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useUserPreferences() {
  const [prefs, setPrefsState] = useState<UserPreferences>(loadPrefs);

  // Persist on every change
  useEffect(() => {
    savePrefs(prefs);
    // Apply CSS class helpers so components can react
    const root = document.documentElement;
    root.setAttribute('data-density',   prefs.tableDensity);
    root.setAttribute('data-sidebar',   prefs.sidebarWidth);
    if (!prefs.animations) {
      root.classList.add('no-animations');
    } else {
      root.classList.remove('no-animations');
    }
  }, [prefs]);

  const update = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    setPrefsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setPrefsState({ ...DEFAULT_PREFERENCES });
  }, []);

  return {
    prefs,
    update,
    reset,
    // Convenience setters
    setColorScheme:   (v: ColorScheme)  => update('colorScheme',  v),
    setTableDensity:  (v: TableDensity) => update('tableDensity', v),
    setAnimations:    (v: boolean)      => update('animations',   v),
    setSidebarWidth:  (v: SidebarWidth) => update('sidebarWidth', v),
    setShowSparklines:(v: boolean)      => update('showSparklines',v),
    setSidebarCompact:(v: boolean)      => update('sidebarCompact',v),
    setDefaultPage:   (v: string)       => update('defaultPage',  v),
  };
}

export default useUserPreferences;
