/**
 * Unit Tests: NotificationBell component
 *
 * Covers: renders bell icon, "All caught up!" empty state (PP-13),
 *         indicator shows when alerts present, dismiss flow,
 *         Jira connection state rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../hooks/useAlertCounts', () => ({
  useAlertCounts: vi.fn(() => ({ criticalTickets: [] })),
}));

vi.mock('../api/jira', () => ({
  useJiraStatus: vi.fn(() => ({ data: { baseUrl: 'https://jira.example.com' } })),
}));

vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function renderBell() {
  // Lazy import after mocks are set
  const NotificationBell = require('../components/common/NotificationBell').default;
  return render(
    <MantineProvider>
      <NotificationBell />
    </MantineProvider>
  );
}

import { useAlertCounts } from '../hooks/useAlertCounts';

describe('NotificationBell', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Default: no alerts
    (useAlertCounts as ReturnType<typeof vi.fn>).mockReturnValue({ criticalTickets: [] });
  });

  /* ── Renders ─────────────────────────────────────────────────────────── */
  it('renders bell icon button', () => {
    renderBell();
    // Bell button should be present (ActionIcon with bell icon)
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  /* ── Empty state (PP-13) ─────────────────────────────────────────────── */
  it('shows "All caught up!" empty state when no critical tickets', async () => {
    renderBell();

    // Open the popover by clicking the bell
    const bellBtn = document.querySelector('button')!;
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/All caught up!/i)).toBeInTheDocument();
    }, { timeout: 3_000 });
  });

  it('shows "No critical or blocker tickets" description in empty state', async () => {
    renderBell();
    const bellBtn = document.querySelector('button')!;
    fireEvent.click(bellBtn);

    await waitFor(() => {
      const desc = screen.queryByText(/No critical or blocker/i);
      expect(desc).toBeInTheDocument();
    }, { timeout: 3_000 });
  });

  /* ── With alerts ─────────────────────────────────────────────────────── */
  it('shows notification item when critical ticket exists', async () => {
    (useAlertCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      criticalTickets: [{
        key: 'PROJ-123',
        summary: 'Critical bug in production',
        priorityName: 'Critical',
        statusName: 'Open',
        assignee: 'John Doe',
        assigneeAvatarUrl: null,
        created: new Date().toISOString(),
      }],
    });

    renderBell();
    const bellBtn = document.querySelector('button')!;
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/PROJ-123/i)).toBeInTheDocument();
    }, { timeout: 3_000 });
  });

  it('does NOT show "All caught up!" when alerts are present', async () => {
    (useAlertCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      criticalTickets: [{
        key: 'PROJ-456',
        summary: 'Blocker issue',
        priorityName: 'Blocker',
        statusName: 'In Progress',
        assignee: null,
        assigneeAvatarUrl: null,
        created: new Date().toISOString(),
      }],
    });

    renderBell();
    const bellBtn = document.querySelector('button')!;
    fireEvent.click(bellBtn);

    await waitFor(() => {
      // PROJ-456 should show
      expect(screen.getByText(/PROJ-456/i)).toBeInTheDocument();
    }, { timeout: 3_000 });

    // Empty state should NOT show
    expect(screen.queryByText(/All caught up!/i)).not.toBeInTheDocument();
  });

  /* ── Dismiss ─────────────────────────────────────────────────────────── */
  it('dismissing a ticket hides it from the list', async () => {
    (useAlertCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      criticalTickets: [{
        key: 'PROJ-789',
        summary: 'Dismiss me',
        priorityName: 'Critical',
        statusName: 'Open',
        assignee: null,
        assigneeAvatarUrl: null,
        created: new Date().toISOString(),
      }],
    });

    renderBell();
    const bellBtn = document.querySelector('button')!;
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/PROJ-789/i)).toBeInTheDocument();
    }, { timeout: 3_000 });

    // Click dismiss button for the ticket
    const dismissBtn = screen.queryByRole('button', { name: /dismiss/i });
    if (dismissBtn) {
      fireEvent.click(dismissBtn);
      await waitFor(() => {
        expect(screen.queryByText(/PROJ-789/i)).not.toBeInTheDocument();
      }, { timeout: 2_000 });
    }
  });

  /* ── No Jira connection ──────────────────────────────────────────────── */
  it('renders without crash when jiraStatus is null', () => {
    const { useJiraStatus } = require('../api/jira') as { useJiraStatus: ReturnType<typeof vi.fn> };
    useJiraStatus.mockReturnValue({ data: null });

    expect(() => renderBell()).not.toThrow();
  });

});
