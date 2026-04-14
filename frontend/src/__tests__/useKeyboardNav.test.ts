/**
 * Unit Tests: useKeyboardNav hook
 *
 * Covers: G+letter navigation, ? modal trigger, ⌘K palette trigger,
 *         input-field safety, 800ms timeout reset, unknown key no-op.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

// ── Mock react-router-dom navigate ────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ── Helpers ───────────────────────────────────────────────────────────────
function fireKey(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  window.dispatchEvent(event);
}

function fireKeyInInput(key: string) {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'target', { value: input });
  window.dispatchEvent(event);
  document.body.removeChild(input);
}

describe('useKeyboardNav', () => {
  const onOpenCommandPalette = vi.fn();
  const onOpenShortcutsHelp  = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ── Initial state ──────────────────────────────────────────────────── */
  it('returns gPressed=false and showHint=false initially', () => {
    const { result } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    expect(result.current.gPressed).toBe(false);
    expect(result.current.showHint).toBe(false);
  });

  /* ── G key pressed ───────────────────────────────────────────────────── */
  it('sets gPressed=true and showHint=true when G is pressed', () => {
    const { result } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    act(() => { fireKey('g'); });
    expect(result.current.gPressed).toBe(true);
    expect(result.current.showHint).toBe(true);
  });

  /* ── G+letter navigation ─────────────────────────────────────────────── */
  const shortcuts: Array<[string, string]> = [
    ['d', '/'],
    ['p', '/projects'],
    ['r', '/people/resources'],
    ['o', '/pods'],
    ['j', '/jira-actuals'],
    ['c', '/people/capacity'],
    ['b', '/financial-intelligence'],
    ['s', '/settings'],
    ['i', '/nlp'],
    ['e', '/engineering-hub'],
  ];

  for (const [letter, route] of shortcuts) {
    it(`navigates to ${route} on G+${letter.toUpperCase()}`, () => {
      renderHook(() => useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp));
      act(() => {
        fireKey('g');
        fireKey(letter);
      });
      expect(mockNavigate).toHaveBeenCalledWith(route);
    });
  }

  /* ── G+K opens command palette ───────────────────────────────────────── */
  it('calls onOpenCommandPalette on G+K', () => {
    renderHook(() => useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp));
    act(() => {
      fireKey('g');
      fireKey('k');
    });
    expect(onOpenCommandPalette).toHaveBeenCalledOnce();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /* ── ? opens shortcuts modal ─────────────────────────────────────────── */
  it('calls onOpenShortcutsHelp when ? is pressed', () => {
    renderHook(() => useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp));
    act(() => { fireKey('?'); });
    expect(onOpenShortcutsHelp).toHaveBeenCalledOnce();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /* ── 800ms reset ─────────────────────────────────────────────────────── */
  it('resets gPressed after 800ms timeout without second key', () => {
    const { result } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    act(() => { fireKey('g'); });
    expect(result.current.gPressed).toBe(true);

    act(() => { vi.advanceTimersByTime(801); });
    expect(result.current.gPressed).toBe(false);
    expect(result.current.showHint).toBe(false);
  });

  /* ── Unknown key after G ─────────────────────────────────────────────── */
  it('does not navigate for unknown G+key combination', () => {
    renderHook(() => useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp));
    act(() => {
      fireKey('g');
      fireKey('z'); // not in shortcuts map
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /* ── Input field safety ──────────────────────────────────────────────── */
  it('does not trigger navigation when G is pressed inside an INPUT', () => {
    const { result } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    act(() => { fireKeyInInput('g'); });
    // gPressed should remain false because target is INPUT
    expect(result.current.gPressed).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /* ── Ctrl/Meta modifier ignored ─────────────────────────────────────── */
  it('does not set gPressed when Ctrl+G is pressed', () => {
    const { result } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    const event = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: document.body });
    act(() => { window.dispatchEvent(event); });
    expect(result.current.gPressed).toBe(false);
  });

  /* ── Cleanup on unmount ──────────────────────────────────────────────── */
  it('removes event listener on unmount (no navigation after unmount)', () => {
    const { unmount } = renderHook(() =>
      useKeyboardNav(onOpenCommandPalette, onOpenShortcutsHelp)
    );
    unmount();
    act(() => {
      fireKey('g');
      fireKey('p');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

});
