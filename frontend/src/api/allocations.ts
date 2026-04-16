/**
 * Resource Allocation API client
 * Sprint 3: PP-303 — Hybrid Team Model REST integration
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface AllocationType {
  id: number;
  name: string;
  maxPercentage: number;
  description?: string;
}

export interface TeamType {
  id: number;
  name: string;
  description?: string;
  isPermanent: boolean;
}

export interface ResourceAllocation {
  id: number;
  resourceId: number;
  teamId: number;
  allocationTypeId: number;
  percentage: number;
  startDate: string;
  endDate?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  allocationType?: AllocationType;
}

export interface AllocationTotal {
  totalPercentage: number;
  available: number;
}

export interface CreateAllocationDto {
  resourceId: number;
  teamId: number;
  allocationTypeId: number;
  percentage: number;
  startDate?: string;
  endDate?: string;
  isPrimary?: boolean;
  notes?: string;
}

// ── Query Keys ────────────────────────────────────────────────────────

export const allocationKeys = {
  all:         ['allocations'] as const,
  byResource:  (id: number) => ['allocations', 'resource', id] as const,
  activeByResource: (id: number) => ['allocations', 'resource', id, 'active'] as const,
  byTeam:      (id: number) => ['allocations', 'team', id] as const,
  totalFor:    (id: number) => ['allocations', 'total', id] as const,
  types:       ['allocation-types'] as const,
  teamTypes:   ['team-types'] as const,
};

// ── API Functions ─────────────────────────────────────────────────────

const BASE = '/allocations';

async function fetchAllocationsForResource(resourceId: number): Promise<ResourceAllocation[]> {
  const { data } = await apiClient.get(`${BASE}/resource/${resourceId}`);
  return data;
}

async function fetchActiveAllocationsForResource(resourceId: number): Promise<ResourceAllocation[]> {
  const { data } = await apiClient.get(`${BASE}/resource/${resourceId}/active`);
  return data;
}

async function fetchAllocationsForTeam(teamId: number): Promise<ResourceAllocation[]> {
  const { data } = await apiClient.get(`${BASE}/team/${teamId}`);
  return data;
}

async function fetchTotalAllocation(resourceId: number): Promise<AllocationTotal> {
  const { data } = await apiClient.get(`${BASE}/resource/${resourceId}/total`);
  return data;
}

async function fetchAllocationTypes(): Promise<AllocationType[]> {
  const { data } = await apiClient.get(`${BASE}/types`);
  return data;
}

async function fetchTeamTypes(): Promise<TeamType[]> {
  const { data } = await apiClient.get(`${BASE}/team-types`);
  return data;
}

async function createAllocation(dto: CreateAllocationDto): Promise<ResourceAllocation> {
  const { data } = await apiClient.post(BASE, dto);
  return data;
}

async function updateAllocation(id: number, dto: Partial<CreateAllocationDto>): Promise<ResourceAllocation> {
  const { data } = await apiClient.put(`${BASE}/${id}`, dto);
  return data;
}

async function deleteAllocation(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ── React Query Hooks ─────────────────────────────────────────────────

export function useResourceAllocations(resourceId: number) {
  return useQuery({
    queryKey: allocationKeys.byResource(resourceId),
    queryFn:  () => fetchAllocationsForResource(resourceId),
    enabled:  resourceId > 0,
  });
}

export function useActiveResourceAllocations(resourceId: number) {
  return useQuery({
    queryKey: allocationKeys.activeByResource(resourceId),
    queryFn:  () => fetchActiveAllocationsForResource(resourceId),
    enabled:  resourceId > 0,
  });
}

export function useTeamAllocations(teamId: number) {
  return useQuery({
    queryKey: allocationKeys.byTeam(teamId),
    queryFn:  () => fetchAllocationsForTeam(teamId),
    enabled:  teamId > 0,
  });
}

export function useAllocationTotal(resourceId: number) {
  return useQuery({
    queryKey: allocationKeys.totalFor(resourceId),
    queryFn:  () => fetchTotalAllocation(resourceId),
    enabled:  resourceId > 0,
  });
}

export function useAllocationTypes() {
  return useQuery({
    queryKey: allocationKeys.types,
    queryFn:  fetchAllocationTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeamTypes() {
  return useQuery({
    queryKey: allocationKeys.teamTypes,
    queryFn:  fetchTeamTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAllocation,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: allocationKeys.byResource(data.resourceId) });
      qc.invalidateQueries({ queryKey: allocationKeys.byTeam(data.teamId) });
      qc.invalidateQueries({ queryKey: allocationKeys.totalFor(data.resourceId) });
    },
  });
}

export function useUpdateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateAllocationDto> }) =>
      updateAllocation(id, dto),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: allocationKeys.byResource(data.resourceId) });
      qc.invalidateQueries({ queryKey: allocationKeys.byTeam(data.teamId) });
      qc.invalidateQueries({ queryKey: allocationKeys.totalFor(data.resourceId) });
    },
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAllocation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allocationKeys.all });
    },
  });
}
