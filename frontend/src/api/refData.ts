import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface EffortPattern {
  id: number;
  name: string;
  description: string;
  weights: Record<string, number>;
}

export interface EffortPatternRequest {
  name: string;
  description: string;
  weights: Record<string, number>;
}

export interface RoleEffortMix {
  role: string;
  mixPct: number;
}

export interface RoleEffortMixRequest {
  role: string;
  mixPct: number;
}

export interface TshirtSizeConfig {
  id: number;
  name: string;
  baseHours: number;
  displayOrder: number;
}

export interface TshirtSizeRequest {
  name: string;
  baseHours: number;
  displayOrder: number;
}

export function useEffortPatterns() {
  return useQuery<EffortPattern[]>({
    queryKey: ['ref-data', 'effort-patterns'],
    queryFn: () => apiClient.get('/ref-data/effort-patterns').then(r => r.data),
  });
}

export function useCreateEffortPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EffortPatternRequest) =>
      apiClient.post('/ref-data/effort-patterns', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateEffortPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EffortPatternRequest }) =>
      apiClient.put(`/ref-data/effort-patterns/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteEffortPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/ref-data/effort-patterns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useRoleEffortMix() {
  return useQuery<RoleEffortMix[]>({
    queryKey: ['ref-data', 'role-effort-mix'],
    queryFn: () => apiClient.get('/ref-data/role-mix').then(r => r.data),
  });
}

export function useSaveRoleMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleEffortMixRequest) =>
      apiClient.post('/ref-data/role-mix', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteRoleMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: string) => apiClient.delete(`/ref-data/role-mix/${role}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useTshirtSizes() {
  return useQuery<TshirtSizeConfig[]>({
    queryKey: ['ref-data', 'tshirt-sizes'],
    queryFn: () => apiClient.get('/ref-data/tshirt-sizes').then(r => r.data),
  });
}

export function useCreateTshirtSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TshirtSizeRequest) =>
      apiClient.post('/ref-data/tshirt-sizes', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateTshirtSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TshirtSizeRequest }) =>
      apiClient.put(`/ref-data/tshirt-sizes/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteTshirtSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/ref-data/tshirt-sizes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref-data'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
