import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleDefinition {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  system: boolean;
  color: string;
  createdAt: string;
}

export interface CreateRolePayload {
  name: string;
  displayName: string;
  description?: string;
  color?: string;
}

export interface UpdateRolePayload {
  displayName?: string;
  description?: string;
  color?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Fetch all role definitions, ordered: system roles first, then alpha. */
export function useRoles() {
  return useQuery<RoleDefinition[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<RoleDefinition[]>('/roles').then(r => r.data),
    staleTime: 60_000,
  });
}

/** Create a new custom role. */
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) =>
      apiClient.post<RoleDefinition>('/roles', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

/** Update a role's display name, description or color. */
export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, payload }: { name: string; payload: UpdateRolePayload }) =>
      apiClient.put<RoleDefinition>(`/roles/${name}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

/** Delete a non-system role. */
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.delete(`/roles/${name}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert roles array to Mantine Select data format. */
export function rolesToSelectOptions(roles: RoleDefinition[]) {
  return roles.map(r => ({ value: r.name, label: r.displayName }));
}
