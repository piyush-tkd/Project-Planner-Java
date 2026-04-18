import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { makeWrapper } from '../../test/helpers';
import { useUpdateBauAssumptions } from '../pods';

const server = setupServer(
  http.put('/api/bau-assumptions', async ({ request }) => {
    const body = await request.json();
    console.log('MSW intercepted PUT /api/bau-assumptions', body);
    return HttpResponse.json(body);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BAU debug', () => {
  it('debug mutation', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    
    let error: unknown = null;
    let saved: unknown = null;
    
    try {
      await act(async () => {
        saved = await result.current.mutateAsync([
          { podId: 1, role: 'DEVELOPER', bauPct: 25 },
        ]);
      });
    } catch(e) {
      error = e;
      console.log('Error caught:', e);
    }
    
    console.log('Error:', error);
    console.log('Saved:', saved);
    console.log('Status:', result.current.status);
    console.log('isSuccess:', result.current.isSuccess);
    console.log('isError:', result.current.isError);
    console.log('failureReason:', result.current.failureReason);
    
    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });
  });
});
