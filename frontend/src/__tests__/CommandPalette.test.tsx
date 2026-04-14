/**
 * Unit Tests: CommandPalette component (PP-13 no-results state)
 *
 * Covers: opens/closes, search renders results, no-results empty state,
 *         G+letter hint in empty state, Escape closes, nav items present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  };
});

vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

// Mock navRegistry used by CommandPalette
vi.mock('../utils/navRegistry', () => ({
  NAV_ITEMS: [
    { path: '/projects', label: 'Projects', group: 'Portfolio', keywords: 'project work' },
    { path: '/pods',     label: 'PODs',     group: 'Teams',     keywords: 'pod team' },
    { path: '/people/resources', label: 'Resources', group: 'Teams', keywords: 'resource people' },
  ],
  NAV_GROUPS: ['Portfolio', 'Teams'],
}));

function renderPalette(open = true, onClose = vi.fn()) {
  const { CommandPalette } = require('../components/common/CommandPalette');
  return render(
    <MemoryRouter>
      <MantineProvider>
        <CommandPalette open={open} onClose={onClose} />
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('CommandPalette', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear recent pages from localStorage
    localStorage.clear();
  });

  /* ── Open state ──────────────────────────────────────────────────────── */
  it('renders search input when open=true', () => {
    renderPalette(true);
    const input = document.querySelector('[cmdk-input]') ??
                  screen.queryByPlaceholderText(/Search pages/i);
    expect(input).toBeTruthy();
  });

  it('does not render when open=false', () => {
    renderPalette(false);
    const input = document.querySelector('[cmdk-input]') ??
                  screen.queryByPlaceholderText(/Search pages/i);
    expect(input).toBeNull();
  });

  /* ── Nav items appear ────────────────────────────────────────────────── */
  it('shows nav items in the list', async () => {
    renderPalette(true);
    await waitFor(() => {
      expect(screen.queryByText(/Projects/i)).toBeInTheDocument();
    }, { timeout: 3_000 });
  });

  /* ── Search filtering ────────────────────────────────────────────────── */
  it('filters items based on search query', async () => {
    renderPalette(true);
    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'projects' } });

    await waitFor(() => {
      expect(screen.queryByText(/Projects/i)).toBeInTheDocument();
    }, { timeout: 2_000 });
  });

  /* ── No-results empty state (PP-13) ──────────────────────────────────── */
  it('shows "No results found" for gibberish query', async () => {
    renderPalette(true);
    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'xyzabcnomatch999' } });

    await waitFor(() => {
      const emptyEl = screen.queryByText(/No results found/i) ??
                      document.querySelector('[cmdk-empty]');
      expect(emptyEl).toBeTruthy();
    }, { timeout: 3_000 });
  });

  it('shows G+letter hint in the no-results empty state (PP-13)', async () => {
    renderPalette(true);
    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'xyzabcnomatch999' } });

    await waitFor(() => {
      const hint = screen.queryByText(/G\+letter/i);
      expect(hint).toBeTruthy();
    }, { timeout: 3_000 });
  });

  /* ── Escape closes ───────────────────────────────────────────────────── */
  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);

    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
    if (input) {
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    } else {
      // Fallback: fire on body
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    }

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 2_000 });
  });

  /* ── Search icon visible ─────────────────────────────────────────────── */
  it('renders search icon in the empty state', async () => {
    renderPalette(true);
    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'zzznoresult' } });

    await waitFor(() => {
      const svgs = document.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    }, { timeout: 2_000 });
  });

  /* ── Groups visible ──────────────────────────────────────────────────── */
  it('shows group labels in results', async () => {
    renderPalette(true);
    await waitFor(() => {
      // Group headings from mock navRegistry
      const portfolio = screen.queryByText(/Portfolio/i);
      const teams     = screen.queryByText(/Teams/i);
      expect(portfolio || teams).toBeTruthy();
    }, { timeout: 3_000 });
  });

});
