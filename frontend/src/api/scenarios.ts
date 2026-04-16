/**
 * Scenario Planning API client
 * TanStack Query hooks for scenario management and snapshots
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface Scenario {
  id: number;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'ARCHIVED';
  baseDate: string;
  createdAt: string;
  createdBy?: string;
}

export interface ScenarioChange {
  id: number;
  changeType: string;
  entityType: string;
  impactCost?: number;
  impactDescription?: string;
}

export interface ScenarioSnapshot {
  id: number;
  snapshotDate: string;
  totalHeadcount: number;
  totalCost: number;
  demandCoveragePct?: number;
}

export interface CreateScenarioDto {
  name: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'ARCHIVED';
  baseDate?: string;
}

export interface UpdateScenarioDto {
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'ARCHIVED';
}

// ── Query Keys ────────────────────────────────────────────────────────

export const scenarioKeys = {
  all:       ['scenarios'] as const,
  detail:    (id: number) => ['scenarios', id] as const,
  changes:   (id: number) => ['scenarios', id, 'changes'] as const,
  snapshots: (id: number) => ['scenarios', id, 'snapshots'] as const,
};

// ── API Functions ─────────────────────────────────────────────────────

const BASE = '/scenarios';

async function fetchScenarios(): Promise<Scenario[]> {
  const { data } = await apiClient.get(BASE);
  return data;
}

async function fetchScenarioChanges(id: number): Promise<ScenarioChange[]> {
  const { data } = await apiClient.get(`${BASE}/${id}/changes`);
  return data;
}

async function fetchScenarioSnapshots(id: number): Promise<ScenarioSnapshot[]> {
  const { data } = await apiClient.get(`${BASE}/${id}/snapshots`);
  return data;
}

async function createScenario(dto: CreateScenarioDto): Promise<Scenario> {
  const { data } = await apiClient.post(BASE, dto);
  return data;
}

async function updateScenario(id: number, dto: UpdateScenarioDto): Promise<Scenario> {
  const { data } = await apiClient.put(`${BASE}/${id}`, dto);
  return data;
}

async function deleteScenario(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

async function activateScenario(id: number): Promise<Scenario> {
  const { data } = await apiClient.post(`${BASE}/${id}/activate`);
  return data;
}

async function approveScenario(id: number): Promise<Scenario> {
  const { data } = await apiClient.post(`${BASE}/${id}/approve`);
  return data;
}

// ── React Query Hooks ─────────────────────────────────────────────────

export function useScenarios() {
  return useQuery({
    queryKey: scenarioKeys.all,
    queryFn: fetchScenarios,
  });
}

export function useScenarioChanges(id: number | null) {
  return useQuery({
    queryKey: scenarioKeys.changes(id || 0),
    queryFn: () => fetchScenarioChanges(id!),
    enabled: id !== null && id > 0,
  });
}

export function useScenarioSnapshots(id: number | null) {
  return useQuery({
    queryKey: scenarioKeys.snapshots(id || 0),
    queryFn: () => fetchScenarioSnapshots(id!),
    enabled: id !== null && id > 0,
  });
}

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createScenario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}

export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateScenarioDto }) =>
      updateScenario(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteScenario(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}

export function useActivateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateScenario(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}

export function useApproveScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approveScenario(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}
