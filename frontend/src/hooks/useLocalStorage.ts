import { useState, useCallback } from 'react';

/**
 * useState that persists its value to localStorage.
 * Falls back to initialValue if the key doesn't exist or JSON.parse fails.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setRaw] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setRaw(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // quota exceeded or private mode — silently ignore
      }
      return next;
    });
  }, [key]);

  return [state, setState];
}
