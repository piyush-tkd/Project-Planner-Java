/**
 * Unit Tests: EmptyState component
 *
 * Covers: renders, action callbacks, secondary action, tips, size variants,
 *         href link wrapping, icon rendering, no-description branch.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconBriefcase } from '@tabler/icons-react';
import EmptyState from '../components/common/EmptyState';

// Wrap component in MantineProvider for theme context
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Mock useDarkMode so tests don't depend on window.matchMedia
vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

describe('EmptyState', () => {

  /* ── Render ─────────────────────────────────────────────────────────── */
  it('renders title text', () => {
    renderWithMantine(<EmptyState title="No data found" />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    renderWithMantine(
      <EmptyState title="Title" description="Try adding some items to get started." />
    );
    expect(screen.getByText(/Try adding some items/i)).toBeInTheDocument();
  });

  it('does not render description element when omitted', () => {
    renderWithMantine(<EmptyState title="No items" />);
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it('renders a custom icon', () => {
    renderWithMantine(
      <EmptyState
        title="Empty"
        icon={<IconBriefcase data-testid="custom-icon" size={40} />}
      />
    );
    // Icon renders inside the component — check the SVG is present
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  /* ── Primary action ─────────────────────────────────────────────────── */
  it('renders primary action button with correct label', () => {
    renderWithMantine(
      <EmptyState
        title="No projects"
        action={{ label: 'Create Project', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
  });

  it('calls primary action onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithMantine(
      <EmptyState
        title="No projects"
        action={{ label: 'Create Project', onClick }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  /* ── Secondary action ───────────────────────────────────────────────── */
  it('renders secondary action button', () => {
    renderWithMantine(
      <EmptyState
        title="No data"
        action={{ label: 'Primary', onClick: vi.fn() }}
        secondaryAction={{ label: 'Import', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('calls secondary action onClick when clicked', () => {
    const onSecondary = vi.fn();
    renderWithMantine(
      <EmptyState
        title="No data"
        secondaryAction={{ label: 'Go to Settings', onClick: onSecondary }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to Settings' }));
    expect(onSecondary).toHaveBeenCalledOnce();
  });

  /* ── href link wrapping ─────────────────────────────────────────────── */
  it('wraps primary action in anchor when href is provided', () => {
    renderWithMantine(
      <EmptyState
        title="No data"
        action={{ label: 'Open Docs', onClick: vi.fn(), href: 'https://example.com' }}
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  /* ── Tips ───────────────────────────────────────────────────────────── */
  it('renders tips section with all tip texts', () => {
    renderWithMantine(
      <EmptyState
        title="Empty"
        tips={['Tip one here', 'Tip two here', 'Tip three here']}
      />
    );
    expect(screen.getByText('Tip one here')).toBeInTheDocument();
    expect(screen.getByText('Tip two here')).toBeInTheDocument();
    expect(screen.getByText('Tip three here')).toBeInTheDocument();
    // Tips header
    expect(screen.getByText('Tips')).toBeInTheDocument();
  });

  it('does not render tips section when tips is empty array', () => {
    renderWithMantine(<EmptyState title="Empty" tips={[]} />);
    expect(screen.queryByText('Tips')).not.toBeInTheDocument();
  });

  /* ── Size variants ──────────────────────────────────────────────────── */
  it('renders with size="sm" without crashing', () => {
    renderWithMantine(<EmptyState title="Small" size="sm" />);
    expect(screen.getByText('Small')).toBeInTheDocument();
  });

  it('renders with size="lg" without crashing', () => {
    renderWithMantine(<EmptyState title="Large" size="lg" />);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  /* ── No actions ─────────────────────────────────────────────────────── */
  it('renders cleanly with no action or secondaryAction', () => {
    renderWithMantine(<EmptyState title="Bare state" />);
    expect(screen.getByText('Bare state')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /* ── Custom color ───────────────────────────────────────────────────── */
  it('accepts custom color prop without crashing', () => {
    renderWithMantine(<EmptyState title="Colored" color="teal" />);
    expect(screen.getByText('Colored')).toBeInTheDocument();
  });

  /* ── Pulse animation style injected ─────────────────────────────────── */
  it('injects pulse animation style tag', () => {
    renderWithMantine(<EmptyState title="Animated" />);
    const styles = document.querySelectorAll('style');
    const hasPulse = Array.from(styles).some(s => s.textContent?.includes('pp-empty-pulse'));
    expect(hasPulse).toBeTruthy();
  });

});
