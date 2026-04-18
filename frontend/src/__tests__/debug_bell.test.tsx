import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import NotificationBell from '../components/common/NotificationBell';

vi.mock('../hooks/useAlertCounts', () => ({
  useAlertCounts: vi.fn(() => ({ criticalTickets: [] })),
}));
vi.mock('../api/jira', () => ({
  useJiraStatus: vi.fn(() => ({ data: { baseUrl: 'https://jira.example.com' } })),
}));
vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

describe('Bell debug', () => {
  it('renders something', () => {
    const errors: Error[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      if (args[0] instanceof Error) errors.push(args[0] as Error);
      origError(...args);
    };
    
    try {
      render(
        <MantineProvider>
          <NotificationBell />
        </MantineProvider>
      );
    } catch(e) {
      console.log('RENDER THREW:', e);
    }
    
    console.error = origError;
    console.log('Console errors:', errors.map(e => e.message));
    console.log('Body:', document.body.innerHTML.replace(/<style[^>]*>.*?<\/style>/gs, '[style]'));
  });
});
