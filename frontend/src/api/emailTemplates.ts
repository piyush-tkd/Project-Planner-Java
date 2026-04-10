/**
 * Email Template Overrides — API hooks for admin-configurable email templates.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EmailTemplateDto {
  templateName: string;
  description:  string;
  customized:   boolean;
  subject:      string | null;
  htmlBody:     string | null;
  updatedAt:    string | null;
}

export interface SaveEmailTemplateRequest {
  subject:  string | null;
  htmlBody: string | null;
}

const QK = ['email-templates'] as const;

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useEmailTemplates() {
  return useQuery<EmailTemplateDto[]>({
    queryKey: QK,
    queryFn: async () => {
      const r = await apiClient.get('/settings/email-templates');
      return r.data;
    },
    staleTime: 2 * 60_000,
  });
}

export function useEmailTemplate(name: string) {
  return useQuery<EmailTemplateDto>({
    queryKey: [...QK, name],
    queryFn: async () => {
      const r = await apiClient.get(`/settings/email-templates/${name}`);
      return r.data;
    },
    enabled: !!name,
    staleTime: 60_000,
  });
}

export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: SaveEmailTemplateRequest }) =>
      apiClient.put(`/settings/email-templates/${name}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useResetEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.delete(`/settings/email-templates/${name}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export async function previewEmailTemplate(
  name: string,
  draft: { subject?: string; htmlBody?: string },
): Promise<string> {
  const r = await apiClient.post(`/settings/email-templates/${name}/preview`, draft);
  return r.data.html as string;
}
