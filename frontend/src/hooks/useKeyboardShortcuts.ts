/**
 * useKeyboardShortcuts — centralized keyboard shortcut registration (DL-10)
 *
 * Registers a list of shortcuts for the lifetime of the calling component.
 * Shortcuts are only fired when the user is NOT in a text input.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: 'n', meta: true, description: 'New project', action: () => openNew() },
 *   ]);
 */
import { useEffect } from 'react';

export interface Shortcut {
  /** Key character, e.g. 'k', '/', 'n' */
  key: string;
  /** Requires ⌘ (Mac) / Ctrl (Win) */
  meta?: boolean;
  /** Requires Shift */
  shift?: boolean;
  /** Requires Alt / Option */
  alt?: boolean;
  /** Human-readable description shown in the shortcut panel */
  description: string;
  /** Callback fired when the shortcut matches */
  action: () => void;
  /** Only fire when not in a text input (default true) */
  ignoreWhenTyping?: boolean;
}

/**
 * Registers shortcuts for the lifetime of the calling component.
 * Each shortcut fires when the matching key combination is pressed.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const ignoreWhenTyping = shortcut.ignoreWhenTyping ?? true;
        if (ignoreWhenTyping && isTyping) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey || true; // shift is opt-in
        const altMatch = shortcut.alt ? e.altKey : true;

        // Strict: if meta required, it must be pressed; if not required, it must NOT be pressed
        const metaStrict = shortcut.meta
          ? (e.metaKey || e.ctrlKey)
          : !(e.metaKey || e.ctrlKey);

        if (keyMatch && metaStrict && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

export default useKeyboardShortcuts;
