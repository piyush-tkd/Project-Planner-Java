import { useState, useRef } from 'react';
import {
  Title,
  Text,
  Stack,
  Button,
  Group,
  Badge,
  Card,
  Avatar,
  ThemeIcon,
  Box,
  Modal,
  TextInput,
  Textarea,
  Select,
  Skeleton,
  Loader,
  Center,
  ActionIcon,
  Menu,
  Image,
  Paper,
  Tooltip,
  Alert,
} from '@mantine/core';
import {
  IconThumbUp, IconPlus, IconEdit, IconTrash, IconDots,
  IconUpload, IconX, IconFileTypePdf, IconPaperclip, IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { DEEP_BLUE, DEEP_BLUE_HEX, AQUA, AQUA_HEX, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

interface IdeaCard {
  id: string;
  title: string;
  description: string;
  submitterName: string;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'IN_PROGRESS';
  tags?: string;
  votes: number;
  estimatedEffort?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  linkedProjectId?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
}

interface CreateIdeaPayload {
  title: string;
  description: string;
  submitterName: string;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'IN_PROGRESS';
  tags?: string;
  estimatedEffort?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  linkedProjectId?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
}

/** Convert a File to a base64 data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({
  url,
  name,
  type,
  onDelete,
}: {
  url: string;
  name: string;
  type: string;
  onDelete?: () => void;
}) {
  const isPdf = type?.includes('pdf');
  return (
    <Paper withBorder radius="sm" p="xs" style={{ position: 'relative', display: 'inline-block', maxWidth: 220 }}>
      {isPdf ? (
        <Group gap={8}>
          <IconFileTypePdf size={32} color="#ef4444" />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Text>
            <Text size="xs" c="dimmed">PDF document</Text>
          </Stack>
        </Group>
      ) : (
        <Box>
          <Image
            src={url}
            alt={name}
            radius="sm"
            style={{ maxHeight: 120, objectFit: 'contain' }}
          />
          <Text size="xs" c="dimmed" mt={4} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </Text>
        </Box>
      )}
      {onDelete && (
        <ActionIcon
          size="xs"
          color="red"
          variant="filled"
          radius="xl"
          style={{ position: 'absolute', top: -8, right: -8 }}
          onClick={onDelete}
          title="Remove attachment"
        >
          <IconX size={10} />
        </ActionIcon>
      )}
    </Paper>
  );
}

export default function IdeasBoardPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateIdeaPayload>({
    title: '',
    description: '',
    submitterName: '',
    status: 'SUBMITTED',
    tags: '',
    estimatedEffort: 'M',
    attachmentUrl: null,
    attachmentName: null,
    attachmentType: null,
  });
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch ideas
  const { data: ideas = [], isLoading, isError } = useQuery({
    queryKey: ['ideas'],
    queryFn: async () => {
      const res = await apiClient.get('/ideas');
      return res.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateIdeaPayload) => {
      const res = await apiClient.post('/ideas', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      notifications.show({ color: 'green', title: 'Success', message: 'Idea submitted successfully' });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to submit idea' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: CreateIdeaPayload) => {
      if (!editingId) throw new Error('No ID provided');
      const res = await apiClient.put(`/ideas/${editingId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      notifications.show({ color: 'green', title: 'Success', message: 'Idea updated successfully' });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to update idea' });
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ id, upvote }: { id: string; upvote: boolean }) => {
      const res = await apiClient.patch(`/ideas/${id}/vote`, { upvote });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (err: any) => {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to vote' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ideas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      notifications.show({ color: 'green', title: 'Success', message: 'Idea deleted successfully' });
    },
    onError: (err: any) => {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to delete idea' });
    },
  });

  const resetForm = () => {
    setFormData({ title: '', description: '', submitterName: '', status: 'SUBMITTED', tags: '', estimatedEffort: 'M', attachmentUrl: null, attachmentName: null, attachmentType: null });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (idea: IdeaCard) => {
    setFormData({
      title: idea.title,
      description: idea.description,
      submitterName: idea.submitterName,
      status: idea.status,
      tags: idea.tags || '',
      estimatedEffort: idea.estimatedEffort || 'M',
      linkedProjectId: idea.linkedProjectId,
      attachmentUrl: idea.attachmentUrl ?? null,
      attachmentName: idea.attachmentName ?? null,
      attachmentType: idea.attachmentType ?? null,
    });
    setEditingId(idea.id);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      notifications.show({ color: 'yellow', title: 'Validation', message: 'Title is required' });
      return;
    }
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this idea?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleUpvote = (id: string) => {
    voteMutation.mutate({ id, upvote: true });
  };

  // ── Attachment handlers ────────────────────────────────────────────────

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      notifications.show({ color: 'red', title: 'File too large', message: 'Maximum file size is 5 MB' });
      return;
    }
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      notifications.show({ color: 'red', title: 'Invalid file type', message: 'Only images (PNG, JPG, GIF, WebP) and PDFs are supported' });
      return;
    }
    setAttachmentLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData(prev => ({ ...prev, attachmentUrl: dataUrl, attachmentName: file.name, attachmentType: file.type }));
    } catch {
      notifications.show({ color: 'red', title: 'Error', message: 'Failed to read file' });
    } finally {
      setAttachmentLoading(false);
    }
  };

  const removeAttachment = () => {
    setFormData(prev => ({ ...prev, attachmentUrl: null, attachmentName: null, attachmentType: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ──────────────────────────────────────────────────────────────────────

  const tagColors: Record<string, string> = {
    AI: AQUA, Mobile: '#2563eb', Automation: '#7c3aed', Integration: '#db2777', UX: '#f59e0b',
  };

  const columns = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'IN_PROGRESS'] as const;
  const columnLabels: Record<typeof columns[number], string> = {
    SUBMITTED: 'Submitted',
    IN_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    IN_PROGRESS: 'In Progress',
  };

  const IdeaCardComponent = ({ idea }: { idea: IdeaCard }) => {
    const isDark = useDarkMode();
    return (
    <Card
      padding="md"
      radius="md"
      withBorder
      style={{
        borderColor: 'rgba(12, 35, 64, 0.1)',
        background: isDark ? '#1e1e1e' : 'white',
        boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: '180px',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(12, 35, 64, 0.10)'; e.currentTarget.style.borderColor = AQUA; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(12, 35, 64, 0.06)'; e.currentTarget.style.borderColor = 'rgba(12, 35, 64, 0.1)'; }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between">
          <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, flex: 1 }}>
            {idea.title}
          </Text>
          <Menu shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => openEditModal(idea)}>Edit</Menu.Item>
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => handleDelete(idea.id)}>Delete</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>{idea.description}</Text>

        {/* Attachment thumbnail on card */}
        {idea.attachmentUrl && (
          <Box>
            {idea.attachmentType?.includes('pdf') ? (
              <Group gap={4}>
                <IconFileTypePdf size={16} color="#ef4444" />
                <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {idea.attachmentName}
                </Text>
              </Group>
            ) : (
              <Image
                src={idea.attachmentUrl}
                alt={idea.attachmentName}
                radius="sm"
                style={{ maxHeight: 80, objectFit: 'cover', width: '100%' }}
              />
            )}
          </Box>
        )}

        {idea.tags && (
          <Group gap="xs">
            {idea.tags.split(',').map((tag, idx) => (
              <Badge key={idx} color={tagColors[tag.trim()] || '#888'} variant="light" style={{ fontFamily: FONT_FAMILY }}>
                {tag.trim()}
              </Badge>
            ))}
          </Group>
        )}

        {idea.estimatedEffort && (
          <Badge color="gray" variant="light" size="sm" style={{ fontFamily: FONT_FAMILY }}>{idea.estimatedEffort}</Badge>
        )}
      </Stack>

      <Group justify="space-between" align="flex-end" mt="auto" pt="md">
        <Group gap={8}>
          <Avatar size={24} name={idea.submitterName?.charAt(0).toUpperCase()} color={AQUA} style={{ fontFamily: FONT_FAMILY }} />
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{idea.submitterName}</Text>
        </Group>
        <Group gap={4}>
          <ThemeIcon size={24} variant="light" color={AQUA} radius="md" style={{ cursor: 'pointer' }} onClick={() => handleUpvote(idea.id)}>
            <IconThumbUp size={14} />
          </ThemeIcon>
          <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{idea.votes}</Text>
        </Group>
      </Group>
    </Card>
  );
  };

  if (isLoading) {
    return <Stack gap="xs" p="md">{[...Array(6)].map((_, i) => <Skeleton key={i} height={120} radius="sm" />)}</Stack>;
  }

  return (
    <Stack gap="lg" p="md">
      {isError && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" radius="md">
          Failed to load ideas. Please try again or refresh the page.
        </Alert>
      )}
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 }}>Ideas Board</Title>
          <Text c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>Capture, refine, and promote ideas to projects</Text>
        </div>
        <Button
          color={AQUA}
          leftSection={<IconPlus size={18} />}
          onClick={openCreateModal}
          styles={{ root: { backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontFamily: FONT_FAMILY, fontWeight: 600 } }}
        >
          Submit Idea
        </Button>
      </Group>

      {/* Kanban Columns */}
      <Box style={{ overflowX: 'auto', paddingBottom: '20px' }}>
        <Group align="flex-start" gap="lg" style={{ minWidth: 'max-content' }}>
          {columns.map(columnName => {
            const columnIdeas = ideas.filter((idea: IdeaCard) => idea.status === columnName);
            return (
              <Box key={columnName} style={{ minWidth: '320px', flex: '0 0 320px' }}>
                <Group justify="space-between" mb="md">
                  <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{columnLabels[columnName]}</Text>
                  <Badge color="blue" variant="light" size="sm">{columnIdeas.length}</Badge>
                </Group>
                <Stack gap="md">
                  {columnIdeas.map((idea: IdeaCard) => (
                    <IdeaCardComponent key={idea.id} idea={idea} />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Group>
      </Box>

      {/* Submit / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingId ? 'Edit Idea' : 'Submit New Idea'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Give your idea a catchy title"
            required
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            placeholder="Describe the idea in detail"
            rows={4}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.currentTarget.value })}
          />
          <TextInput
            label="Submitter Name"
            placeholder="Your name"
            value={formData.submitterName}
            onChange={e => setFormData({ ...formData, submitterName: e.currentTarget.value })}
          />
          <TextInput
            label="Tags"
            placeholder="Comma-separated (e.g., AI, Mobile, UX)"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.currentTarget.value })}
          />
          <Select
            label="Estimated Effort"
            placeholder="How much effort to implement?"
            data={[
              { value: 'XS', label: 'Extra Small' },
              { value: 'S', label: 'Small' },
              { value: 'M', label: 'Medium' },
              { value: 'L', label: 'Large' },
              { value: 'XL', label: 'Extra Large' },
            ]}
            value={formData.estimatedEffort}
            onChange={val => setFormData({ ...formData, estimatedEffort: val as any })}
          />
          <Select
            label="Status"
            placeholder="Select status"
            data={[
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'IN_REVIEW', label: 'Under Review' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
            ]}
            value={formData.status}
            onChange={val => setFormData({ ...formData, status: val as any })}
          />

          {/* ── Attachment section ── */}
          <Box>
            <Text size="sm" fw={500} mb={6}>Attachment <Text component="span" size="xs" c="dimmed">(image or PDF, max 5 MB)</Text></Text>

            {formData.attachmentUrl ? (
              <AttachmentPreview
                url={formData.attachmentUrl}
                name={formData.attachmentName ?? 'attachment'}
                type={formData.attachmentType ?? ''}
                onDelete={removeAttachment}
              />
            ) : (
              <Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="light"
                  leftSection={attachmentLoading ? <Loader size={14} /> : <IconUpload size={14} />}
                  disabled={attachmentLoading}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                >
                  {attachmentLoading ? 'Reading file…' : 'Upload image or PDF'}
                </Button>
              </Box>
            )}
          </Box>

          <Group justify="flex-end">
            <Button variant="light" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ background: AQUA_HEX, color: DEEP_BLUE_HEX }}
            >
              {editingId ? 'Update' : 'Submit'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
