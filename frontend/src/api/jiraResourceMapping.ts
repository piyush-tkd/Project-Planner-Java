import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface ResourceMappingResponse {
  id: number | null;
  jiraDisplayName: string;
  jiraAccountId: string | null;
  resourceId: number | null;
  resourceName: string | null;
  resourceRole: string | null;
  resourceEmail: string | null;
  mappingType: string; // AUTO | MANUAL | EXCLUDED
  confidence: number | null;
  confirmed: boolean;
  issueCount: number;
  hoursLogged: number;
  resourceCategory: string; // MAX_BILLING | BUFFER | EXTERNAL
}

export interface MappingStats {
  totalJiraNames: number;
  autoMatched: number;
  manuallyMapped: number;
  excluded: number;
  unmatched: number;
  confirmed: number;
  totalBillableResources: number;
  maxBillingCount: number;
  maxBillingMapped: number;
  bufferCount: number;
}

export interface UnmappedResource {
  id: number;
  name: string;
  role: string;
  email: string | null;
}

export interface JiraNameInfo {
  displayName: string;
  accountId: string | null;
  issueCount: number;
  hoursLogged: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────

const MAPPING_KEY = ['jira-resource-mappings'];

export function useResourceMappings() {
  return useQuery<ResourceMappingResponse[]>({
    queryKey: MAPPING_KEY,
    queryFn: () => apiClient.get('/jira/resource-mappings').then(r => r.data),
  });
}

export function useUnmappedResources() {
  return useQuery<UnmappedResource[]>({
    queryKey: [...MAPPING_KEY, 'unmapped-resources'],
    queryFn: () => apiClient.get('/jira/resource-mappings/unmapped-resources').then(r => r.data),
  });
}

export function useResourceMappingStats() {
  return useQuery<MappingStats>({
    queryKey: [...MAPPING_KEY, 'stats'],
    queryFn: () => apiClient.get('/jira/resource-mappings/stats').then(r => r.data),
  });
}

export function useScanJiraNames() {
  return useQuery<JiraNameInfo[]>({
    queryKey: [...MAPPING_KEY, 'scan'],
    queryFn: () => apiClient.get('/jira/resource-mappings/scan').then(r => r.data),
    enabled: false, // manual trigger only
  });
}

export function useAutoMatch() {
  const qc = useQueryClient();
  return useMutation<ResourceMappingResponse[]>({
    mutationFn: () => apiClient.post('/jira/resource-mappings/auto-match').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useSaveResourceMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jiraDisplayName, resourceId, mappingType }: {
      jiraDisplayName: string;
      resourceId: number | null;
      mappingType: string;
    }) => apiClient.put(`/jira/resource-mappings/${encodeURIComponent(jiraDisplayName)}`, {
      resourceId,
      mappingType,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useDeleteResourceMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/jira/resource-mappings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useClearResourceMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => apiClient.delete(`/jira/resource-mappings/by-resource/${resourceId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useBulkAcceptMappings() {
  const qc = useQueryClient();
  return useMutation<{ accepted: number }, Error, { minConfidence: number }>({
    mutationFn: (body) => apiClient.post('/jira/resource-mappings/bulk-accept', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}
