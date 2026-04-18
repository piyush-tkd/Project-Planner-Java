import { NlpQueryResponse } from '../../../api/nlp';

// Type for session memory tracking
export interface SessionMemoryItem {
  q: string;
  a: string;
  intent: string;
}

// Type for conversation metadata
export interface ConversationMeta {
  id: string;
  title: string;
  lastMessageAt?: string;
  messageCount: number;
  pinned: boolean;
}

// Type for insight cards
export interface InsightCard {
  id: string;
  title: string;
  description: string;
  query: string;
  icon: string;
  color: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
}

// Type for NLP health status
export interface NlpHealthStatus {
  tier: 'FULL' | 'DB_ONLY' | 'REGEX_ONLY';
}

// Main page state
export interface NlpLandingPageState {
  query: string;
  result: NlpQueryResponse | null;
  showResult: boolean;
  recentQueries: string[];
  inputFocused: boolean;
  isListening: boolean;
  loadingPhase: number;
  isStreaming: boolean;
  historyOpen: boolean;
}
