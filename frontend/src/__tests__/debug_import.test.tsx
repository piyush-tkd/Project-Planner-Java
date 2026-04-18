// Debug file: kept for reference but require() is not supported in ESM mode.
// The dynamic import test below validates the module loads correctly.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));
vi.mock('../utils/navRegistry', () => ({
  NAV_ITEMS: [],
  NAV_GROUPS: [],
}));
vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

describe('CP import test', () => {
  it('can import CommandPalette via dynamic import', async () => {
    const mod = await import('../components/common/CommandPalette');
    expect(mod).toBeTruthy();
  });

  // require() is not supported in vitest ESM mode — use dynamic import instead.
  it('can require CommandPalette', async () => {
    const mod = await import('../components/common/CommandPalette');
    expect(mod).toBeTruthy();
  });
});
