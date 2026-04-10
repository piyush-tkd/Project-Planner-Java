import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import { COLOR_ERROR_DEEP, COLOR_GREEN_DARK, COLOR_ORANGE_DARK, SURFACE_RED_FAINT, SURFACE_SUBTLE, TEXT_DIM} from '../brandTokens';

// ── Types ──────────────────────────────────────────────────────────────────

export type RagStatus = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

export interface ProjectHealthDto {
  projectId:     number;
  projectName:   string;
  projectStatus: string;
  ragStatus:     RagStatus;
  overallScore:  number | null;
  scheduleScore: number | null;
  scheduleLabel: string | null;
  budgetScore:   number | null;
  budgetLabel:   string | null;
  riskScore:     number | null;
  riskLabel:     string | null;
  criticalRisks: number;
  highRisks:     number;
  targetDate:    string | null;
}

// ── Query keys ─────────────────────────────────────────────────────────────

export const HEALTH_QK = ['projects', 'health'] as const;

// ── Hooks ──────────────────────────────────────────────────────────────────

/** Fetches health scorecards for all non-archived projects. Refreshes every 5 minutes. */
export function useProjectsHealth() {
  return useQuery<ProjectHealthDto[]>({
    queryKey: HEALTH_QK,
    queryFn: async () => {
      const r = await apiClient.get('/projects/health');
      return r.data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Fetches the health scorecard for a single project. */
export function useProjectHealth(projectId: number | undefined) {
  return useQuery<ProjectHealthDto>({
    queryKey: [...HEALTH_QK, projectId],
    queryFn: async () => {
      const r = await apiClient.get(`/projects/${projectId}/health`);
      return r.data;
    },
    enabled: projectId != null,
    staleTime: 5 * 60_000,
  });
}

// ── Colour helpers (used in multiple components) ───────────────────────────

export const RAG_COLORS: Record<RagStatus, string> = {
  GREEN: COLOR_GREEN_DARK,
  AMBER: COLOR_ORANGE_DARK,
  RED:   COLOR_ERROR_DEEP,
  GREY:  TEXT_DIM,
};

export const RAG_BG: Record<RagStatus, string> = {
  GREEN: '#ebfbee',
  AMBER: '#fff9db',
  RED:   SURFACE_RED_FAINT,
  GREY:  SURFACE_SUBTLE,
};

export const RAG_MANTINE: Record<RagStatus, string> = {
  GREEN: 'green',
  AMBER: 'orange',
  RED:   'red',
  GREY:  'gray',
};

export const RAG_LABEL: Record<RagStatus, string> = {
  GREEN: 'Healthy',
  AMBER: 'At Risk',
  RED:   'Critical',
  GREY:  'Closed',
};
