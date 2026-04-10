/**
 * Global G+letter keyboard shortcuts for navigation.
 * Press G, then within 800ms press a letter to navigate.
 *
 * G+D → /dashboard
 * G+P → /projects
 * G+R → /people/resources
 * G+O → /pods
 * G+J → /jira-actuals
 * G+C → /people/capacity
 * G+B → /financial-intelligence
 * G+S → /settings
 * G+K → opens ⌘K palette
 * ? → opens shortcuts help modal
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS: Record<string, string> = {
  'd': '/',
  'p': '/projects',
  'r': '/people/resources',
  'o': '/pods',
  'j': '/jira-actuals',
  'c': '/people/capacity',
  'b': '/financial-intelligence',
  's': '/settings',
  'i': '/nlp',
  'e': '/engineering-hub',
};

export function useKeyboardNav(onOpenCommandPalette?: () => void, onOpenShortcutsHelp?: () => void) {
  const navigate = useNavigate();
  const [gPressed, setGPressed] = useState(false);
  const [showHint, setShowHint] = useState(false); // "G pressed — type destination"

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((target as any).contentEditable === 'true') return;

      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcutsHelp?.();
        return;
      }

      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setGPressed(true);
        setShowHint(true);
        clearTimeout(timer);
        timer = setTimeout(() => {
          setGPressed(false);
          setShowHint(false);
        }, 800);
        return;
      }

      if (gPressed) {
        clearTimeout(timer);
        setGPressed(false);
        setShowHint(false);
        const key = e.key.toLowerCase();
        if (key === 'k') {
          e.preventDefault();
          onOpenCommandPalette?.();
          return;
        }
        const route = SHORTCUTS[key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(timer);
    };
  }, [gPressed, navigate, onOpenCommandPalette, onOpenShortcutsHelp]);

  return { showHint, gPressed };
}
