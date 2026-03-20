import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number | null;
  entityName: string | null;
  action: string;
  changedBy: string;
  changedAt: string;   // ISO instant
  details: string | null;
}

export function useAuditLog(limit = 100) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['audit', 'recent', limit],
    queryFn: () => apiClient.get('/audit/recent', { params: { limit } }).then(r => r.data),
  });
}

export function useEntityAuditLog(entityType: string, entityId: number | null) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['audit', 'entity', entityType, entityId],
    queryFn: () => apiClient.get(`/audit/entity/${entityType}/${entityId}`).then(r => r.data),
    enabled: !!entityId,
  });
}
