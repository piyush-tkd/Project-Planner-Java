import { useState } from 'react';
import { DateInput } from '@mantine/dates';
import { useDarkMode } from '../hooks/useDarkMode';
import {
  Text,
  Stack,
  Center,
  Paper,
  Tabs,
  Button,
  Group,
  Badge,
  Table,
  SimpleGrid,
  Modal,
  TextInput,
  Textarea,
  Select,
  Skeleton,
  ActionIcon,
  Menu,
  NumberInput,
  Tooltip,
  Alert,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { IconAlertTriangle, IconListCheck, IconHelp, IconEdit, IconTrash, IconDots } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { PageInsightCard } from '../components/common/PageInsightCard';
import { DEEP_BLUE, AQUA, AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY, SURFACE_FAINT, SURFACE_BG, COLOR_ERROR_DARK, UX_WARNING, COLOR_ORANGE_DARK, DEEP_BLUE_TINTS } from '../brandTokens';

interface Risk {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  probability?: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'MITIGATED' | 'CLOSED';
  dueDate?: string;
  mitigationPlan?: string;
  itemType: 'RISK' | 'ISSUE' | 'DECISION';
}

interface RiskSummary {
  totalRisks: number;
  totalIssues: number;
  totalDecisions: number;
  openItems: number;
  criticalItems: number;
}

interface CreateRiskPayload {
  title: string;
  description?: string;
  itemType: 'RISK' | 'ISSUE' | 'DECISION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  probability?: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'MITIGATED' | 'CLOSED';
  owner?: string;
  mitigationPlan?: string;
  dueDate?: string;
}

export default function RiskRegisterPage() {
  const dark = useDarkMode();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [formData, setFormData] = useState<CreateRiskPayload>({
    title: '',
    description: '',
    itemType: 'RISK',
    severity: 'HIGH',
    probability: 'MEDIUM',
    status: 'OPEN',
    owner: '',
    mitigationPlan: '',
    dueDate: '',
  });

  // Fetch summary
  const { data: summary, isError: summaryError } = useQuery({
    queryKey: ['risks-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/risks/summary');
      return res.data as RiskSummary;
    },
  });

  // Fetch risks based on tab
  const { data: risks = [], isLoading, isError } = useQuery({
    queryKey: ['risks', activeTab],
    queryFn: async () => {
      let params: Record<string, string> = {};
      if (activeTab === 'risks') params = { type: 'RISK' };
      else if (activeTab === 'issues') params = { type: 'ISSUE' };
      else if (activeTab === 'decisions') params = { type: 'DECISION' };

      const res = await apiClient.get('/risks/all', { params });
      return res.data as Risk[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateRiskPayload) => {
      const res = await apiClient.post('/risks', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-all'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Risk logged successfully',
      });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to log risk',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: CreateRiskPayload) => {
      if (!editingId) throw new Error('No ID provided');
      const res = await apiClient.put(`/risks/${editingId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-all'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Risk updated successfully',
      });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update risk',
      });
    },
  });

  // Inline update mutation
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const res = await apiClient.put(`/risks/${id}`, { [field]: value });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-all'] });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update risk',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/risks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['risks-all'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Risk deleted successfully',
      });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to delete risk',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      itemType: 'RISK',
      severity: 'HIGH',
      probability: 'MEDIUM',
      status: 'OPEN',
      owner: '',
      mitigationPlan: '',
      dueDate: '',
    });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (risk: Risk) => {
    setFormData({
      title: risk.title,
      description: risk.description || '',
      itemType: risk.itemType,
      severity: risk.severity,
      probability: risk.probability || 'MEDIUM',
      status: risk.status,
      owner: risk.owner || '',
      mitigationPlan: risk.mitigationPlan || '',
      dueDate: risk.dueDate || '',
    });
    setEditingId(risk.id);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      notifications.show({
        color: 'yellow',
        title: 'Validation',
        message: 'Title is required',
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteMutation.mutate(id);
    }
  };

  const severityColors: Record<string, string> = {
    CRITICAL: COLOR_ERROR_DARK,
    HIGH: COLOR_ORANGE_DARK,
    MEDIUM: UX_WARNING,
    LOW: DEEP_BLUE_TINTS[60],
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <Center py={80}>
      <Stack align="center" gap="md">
        <Icon size={64} color={DEEP_BLUE} opacity={0.2} />
        <Stack gap={4} align="center">
          <Text fw={600} size="lg" style={{ fontFamily: FONT_FAMILY }}>
            {title}
          </Text>
          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
            {description}
          </Text>
        </Stack>
      </Stack>
    </Center>
  );

  if (isLoading && !summary) {
    return (
      <Stack gap="xs" p="md">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}</Stack>
    );
  }

  return (
    <PPPageLayout
      title="Risk & Issues"
      subtitle="Proactive risk management across projects and PODs"
      animate
      actions={
        <Button
          onClick={openCreateModal}
          variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontFamily: FONT_FAMILY, fontWeight: 600 }}
        >
          Log Risk
        </Button>
      }
    >
      {(isError || summaryError) && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" mb="md" mx="md" radius="md">
          Failed to load risk data. Please try again or refresh the page.
        </Alert>
      )}
      <PageInsightCard pageKey="risks" data={risks} />

      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 3, xs: 3, sm: 3 }} spacing="md">
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: AQUA,
            background: dark ? 'rgba(255,255,255,0.04)' : SURFACE_BG,
            boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
          }}
        >
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Total Risks
          </Text>
          <Text fw={700} size="xl" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
            {summary?.totalRisks ?? 0}
          </Text>
        </Paper>
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: AQUA,
            background: dark ? 'rgba(255,255,255,0.04)' : SURFACE_BG,
            boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
          }}
        >
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Open Items
          </Text>
          <Text fw={700} size="xl" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
            {summary?.openItems ?? 0}
          </Text>
        </Paper>
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: AQUA,
            background: dark ? 'rgba(255,255,255,0.04)' : SURFACE_BG,
            boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
          }}
        >
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Critical Items
          </Text>
          <Text fw={700} size="xl" style={{ color: COLOR_ERROR_DARK, fontFamily: FONT_FAMILY }}>
            {summary?.criticalItems ?? 0}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          tab: {
            fontFamily: FONT_FAMILY,
            color: DEEP_BLUE,
            '&[data-active]': {
              color: AQUA,
              borderBottomColor: AQUA,
            },
          },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="risks">Risks</Tabs.Tab>
          <Tabs.Tab value="issues">Issues</Tabs.Tab>
          <Tabs.Tab value="decisions">Decisions</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="all" pt="xl">
          {risks.length === 0 ? (
            <EmptyState
              icon={IconAlertTriangle}
              title="No items logged"
              description="Start by logging risks, issues, or decisions to track project impacts."
            />
          ) : (
            <Paper
              withBorder
              radius="md"
              style={{
                borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(12, 35, 64, 0.1)',
                overflow: 'hidden',
              }}
            >
              <Table striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: dark ? 'var(--mantine-color-dark-7)' : SURFACE_FAINT }}>
                  <Table.Tr>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Title
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Type
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Severity
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Status
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Owner
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Due Date
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Actions
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {risks.map((risk: Risk) => (
                    <Table.Tr key={risk.id}>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'title' ? (
                          <TextInput
                            autoFocus
                            defaultValue={risk.title}
                            size="xs"
                            style={{ fontFamily: FONT_FAMILY }}
                            onBlur={(e) => {
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'title', value: e.currentTarget.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Enter') {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'title', value: e.currentTarget.value });
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'title' })}>
                            {risk.title}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>{risk.itemType}</Table.Td>
                      <Table.Td>
                        {editingCell?.id === risk.id && editingCell?.field === 'severity' ? (
                          <Select
                            size="xs"
                            data={[
                              { value: 'CRITICAL', label: 'Critical' },
                              { value: 'HIGH', label: 'High' },
                              { value: 'MEDIUM', label: 'Medium' },
                              { value: 'LOW', label: 'Low' },
                            ]}
                            defaultValue={risk.severity}
                            onBlur={(e) => {
                              const val = e.currentTarget.value || risk.severity;
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'severity', value: val });
                              setEditingCell(null);
                            }}
                            onChange={(val) => {
                              if (val) {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'severity', value: val });
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Badge
                            color={severityColors[risk.severity]}
                            variant="filled"
                            style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                            onClick={() => setEditingCell({ id: risk.id, field: 'severity' })}
                          >
                            {risk.severity}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'status' ? (
                          <Select
                            size="xs"
                            data={[
                              { value: 'OPEN', label: 'Open' },
                              { value: 'IN_PROGRESS', label: 'In Progress' },
                              { value: 'MITIGATED', label: 'Mitigated' },
                              { value: 'CLOSED', label: 'Closed' },
                            ]}
                            defaultValue={risk.status}
                            onBlur={(e) => {
                              const val = e.currentTarget.value || risk.status;
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'status', value: val });
                              setEditingCell(null);
                            }}
                            onChange={(val) => {
                              if (val) {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'status', value: val });
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'status' })}>
                            {risk.status}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'owner' ? (
                          <TextInput
                            autoFocus
                            defaultValue={risk.owner || ''}
                            size="xs"
                            style={{ fontFamily: FONT_FAMILY }}
                            onBlur={(e) => {
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'owner', value: e.currentTarget.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Enter') {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'owner', value: e.currentTarget.value });
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'owner' })}>
                            {risk.owner || '-'}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'dueDate' ? (
                          <TextInput
                            autoFocus
                            defaultValue={risk.dueDate || ''}
                            size="xs"
                            placeholder="yyyy-MM-dd"
                            style={{ fontFamily: FONT_FAMILY }}
                            onBlur={(e) => {
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'dueDate', value: e.currentTarget.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Enter') {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'dueDate', value: e.currentTarget.value });
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'dueDate' })}>
                            {risk.dueDate || '-'}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => handleDelete(risk.id)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="risks" pt="xl">
          {risks.length === 0 ? (
            <EmptyState
              icon={IconAlertTriangle}
              title="No risks logged"
              description="Document and track risks here to stay on top of project threats."
            />
          ) : (
            <Paper
              withBorder
              radius="md"
              style={{
                borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(12, 35, 64, 0.1)',
                overflow: 'hidden',
              }}
            >
              <Table striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: dark ? 'var(--mantine-color-dark-7)' : SURFACE_FAINT }}>
                  <Table.Tr>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Title
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Severity
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Status
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Owner
                    </Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 600 }}>
                      Actions
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {risks.map((risk: Risk) => (
                    <Table.Tr key={risk.id}>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'title' ? (
                          <TextInput
                            autoFocus
                            defaultValue={risk.title}
                            size="xs"
                            style={{ fontFamily: FONT_FAMILY }}
                            onBlur={(e) => {
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'title', value: e.currentTarget.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Enter') {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'title', value: e.currentTarget.value });
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'title' })}>
                            {risk.title}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {editingCell?.id === risk.id && editingCell?.field === 'severity' ? (
                          <Select
                            size="xs"
                            data={[
                              { value: 'CRITICAL', label: 'Critical' },
                              { value: 'HIGH', label: 'High' },
                              { value: 'MEDIUM', label: 'Medium' },
                              { value: 'LOW', label: 'Low' },
                            ]}
                            defaultValue={risk.severity}
                            onBlur={(e) => {
                              const val = e.currentTarget.value || risk.severity;
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'severity', value: val });
                              setEditingCell(null);
                            }}
                            onChange={(val) => {
                              if (val) {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'severity', value: val });
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Badge
                            color={severityColors[risk.severity]}
                            variant="filled"
                            style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                            onClick={() => setEditingCell({ id: risk.id, field: 'severity' })}
                          >
                            {risk.severity}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'status' ? (
                          <Select
                            size="xs"
                            data={[
                              { value: 'OPEN', label: 'Open' },
                              { value: 'IN_PROGRESS', label: 'In Progress' },
                              { value: 'MITIGATED', label: 'Mitigated' },
                              { value: 'CLOSED', label: 'Closed' },
                            ]}
                            defaultValue={risk.status}
                            onBlur={(e) => {
                              const val = e.currentTarget.value || risk.status;
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'status', value: val });
                              setEditingCell(null);
                            }}
                            onChange={(val) => {
                              if (val) {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'status', value: val });
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'status' })}>
                            {risk.status}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: FONT_FAMILY }}>
                        {editingCell?.id === risk.id && editingCell?.field === 'owner' ? (
                          <TextInput
                            autoFocus
                            defaultValue={risk.owner || ''}
                            size="xs"
                            style={{ fontFamily: FONT_FAMILY }}
                            onBlur={(e) => {
                              inlineUpdateMutation.mutate({ id: risk.id, field: 'owner', value: e.currentTarget.value });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Enter') {
                                inlineUpdateMutation.mutate({ id: risk.id, field: 'owner', value: e.currentTarget.value });
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <Text style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: risk.id, field: 'owner' })}>
                            {risk.owner || '-'}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => handleDelete(risk.id)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="issues" pt="xl">
          <EmptyState
            icon={IconListCheck}
            title="No issues logged"
            description="Document and track issues here to stay on top of blockers."
          />
        </Tabs.Panel>

        <Tabs.Panel value="decisions" pt="xl">
          <EmptyState
            icon={IconHelp}
            title="No pending decisions"
            description="Track critical decisions and their status in this tab."
          />
        </Tabs.Panel>
      </Tabs>

      {/* Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Item' : 'Log Risk/Issue/Decision'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Enter title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            placeholder="Describe the item"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />
          <Select
            label="Type"
            placeholder="Select type"
            data={[
              { value: 'RISK', label: 'Risk' },
              { value: 'ISSUE', label: 'Issue' },
              { value: 'DECISION', label: 'Decision' },
            ]}
            value={formData.itemType}
            onChange={(val) => setFormData({ ...formData, itemType: (val as any) })}
          />
          <Select
            label="Severity"
            placeholder="Select severity"
            data={[
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
            value={formData.severity}
            onChange={(val) => setFormData({ ...formData, severity: (val as any) })}
          />
          <Select
            label="Probability"
            placeholder="Select probability"
            data={[
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
            value={formData.probability}
            onChange={(val) => setFormData({ ...formData, probability: (val as any) })}
          />
          <Select
            label="Status"
            placeholder="Select status"
            data={[
              { value: 'OPEN', label: 'Open' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'MITIGATED', label: 'Mitigated' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
            value={formData.status}
            onChange={(val) => setFormData({ ...formData, status: (val as any) })}
          />
          <TextInput
            label="Owner"
            placeholder="Responsible person"
            value={formData.owner}
            onChange={(e) => setFormData({ ...formData, owner: e.currentTarget.value })}
          />
          <DateInput
            label="Due Date"
            placeholder="Pick a date"
            valueFormat="YYYY-MM-DD"
            value={formData.dueDate ? new Date(formData.dueDate) : null}
            onChange={(d) => setFormData({ ...formData, dueDate: d ? d.toISOString().slice(0, 10) : '' })}
            clearable
          />
          <Textarea
            label="Mitigation Plan"
            placeholder="How will this be mitigated?"
            rows={3}
            value={formData.mitigationPlan}
            onChange={(e) => setFormData({ ...formData, mitigationPlan: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ background: AQUA, color: DEEP_BLUE }}
            >
              {editingId ? 'Update' : 'Log'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
