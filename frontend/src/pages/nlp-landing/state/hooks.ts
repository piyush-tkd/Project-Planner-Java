import { useCallback, useRef } from 'react';
import { NlpQueryResponse } from '../../../api/nlp';
import { SessionMemoryItem } from './types';

const MAX_SESSION_MEMORY = 5;

export function useSessionMemory() {
  const sessionMemoryRef = useRef<SessionMemoryItem[]>([]);

  const buildSessionContext = useCallback((): string | undefined => {
    const mem = sessionMemoryRef.current;
    if (mem.length === 0) return undefined;
    const lines = mem.map(m => `User: ${m.q}\nAssistant: ${m.a}`).join('\n');
    return `Previous conversation:\n${lines}`;
  }, []);

  const addToSessionMemory = useCallback((q: string, res: NlpQueryResponse) => {
    const answer = res.response?.message || res.intent || 'No response';
    sessionMemoryRef.current = [
      ...sessionMemoryRef.current.slice(-(MAX_SESSION_MEMORY - 1)),
      { q, a: answer, intent: res.intent },
    ];
  }, []);

  return {
    sessionMemoryRef,
    buildSessionContext,
    addToSessionMemory,
  };
}

export function useRecentQueries() {
  const MAX_RECENT = 5;

  const addToRecent = useCallback((setRecentQueries: any) => (text: string) => {
    setRecentQueries((prev: string[]) => {
      const filtered = prev.filter((q: string) => q.toLowerCase() !== text.toLowerCase());
      return [text, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  return { addToRecent };
}
