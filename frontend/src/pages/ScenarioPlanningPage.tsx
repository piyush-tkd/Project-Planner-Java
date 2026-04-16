import { useState } from 'react';
import {
  Stack, SimpleGrid, Text, Card, Group, Button, Badge, Title,
  Paper, ThemeIcon, Modal, TextInput, Textarea, Box, Alert,
  ScrollArea,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  IconPlus, IconHistory, IconCheck, IconX,
  IconTrash, IconUsers, IconAlertCircle,
} from '@tabler/icons-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDarkMode } from '../hooks/useDarkMode';
import { notifications } from '@mantine/notifications';
import {
  useScenarios,
  useScenarioChanges,
  useScenarioSnapshots,
  useCreateScenario,
  useActivateScenario,
  useApproveScenario,
  useDeleteScenario,
  type Scenario,
  type ScenarioChange,
  type ScenarioSnapshot,
} from '../api/scenarios';
import {
  COLOR_BLUE, COLOR_GREEN, COLOR_ORANGE, COLOR_VIOLET,
  SURFACE_LIGHT, TEXT_SUBTLE, BORDER_STRONG,
} from '../brandTokens';


const statusColors: Record<string, string> = {
  DRAFT: 'gray',
  ACTIVE: COLOR_BLUE,
  APPROVED: COLOR_GREEN,
  ARCHIVED: TEXT_SUBTLE,
};

export default function ScenarioPlanningPage() {
  const isDark = useDarkMode();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScenario, setNewScenario] = useState({ name: '', description: '' });

  // API Queries
  const { data: scenarios = [], isLoading: scenariosLoading, error: scenariosError } = useScenarios();
  const { data: changes = [], isLoading: changesLoading } = useScenarioChanges(selectedId);
  const { data: snapshots = [], isLoading: snapshotsLoading } = useScenarioSnapshots(selectedId);

  // Mutations
  const createMutation = useCreateScenario();
  const activateMutation = useActivateScenario();
  const approveMutation = useApproveScenario();
  const deleteMutation = useDeleteScenario();

  const selectedScenario = scenarios.find(s => s.id === selectedId);

  const handleCreateScenario = () => {
    if (newScenario.name.trim()) {
      createMutation.mutate(
        {
          name: newScenario.name,
          description: newScenario.description,
          status: 'DRAFT',
          baseDate: new Date().toISOString().split('T')[0],
        },
        {
          onSuccess: (createdScenario) => {
            setSelectedId(createdScenario.id);
            setNewScenario({ name: '', description: '' });
            setIsModalOpen(false);
            notifications.show({
              title: 'Scenario created',
              message: `${createdScenario.name} has been created successfully.`,
              color: 'green',
            });
          },
          onError: (error: any) => {
            notifications.show({
              title: 'Error',
              message: error.message || 'Failed to create scenario',
              color: 'red',
            });
          },
        }
      );
    }
  };

  const handleActivate = () => {
    if (selectedId) {
      activateMutation.mutate(selectedId, {
        onSuccess: () => {
          notifications.show({
            title: 'Scenario activated',
            message: 'The scenario is now active.',
            color: 'blue',
          });
        },
        onError: (error: any) => {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to activate scenario',
            color: 'red',
          });
        },
      });
    }
  };

  const handleApprove = () => {
    if (selectedId) {
      approveMutation.mutate(selectedId, {
        onSuccess: () => {
          notifications.show({
            title: 'Scenario approved',
            message: 'The scenario has been approved.',
            color: 'green',
          });
        },
        onError: (error: any) => {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to approve scenario',
            color: 'red',
          });
        },
      });
    }
  };

  const handleDeleteScenario = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) {
          setSelectedId(null);
        }
        notifications.show({
          title: 'Scenario deleted',
          message: 'The scenario has been deleted.',
          color: 'red',
        });
      },
      onError: (error: any) => {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete scenario',
          color: 'red',
        });
      },
    });
  };

  return (
    <PPPageLayout title="Scenario Planning">
      {/* Error state */}
      {scenariosError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading scenarios"
          color="red"
          mb="md"
        >
          {scenariosError instanceof Error ? scenariosError.message : 'Failed to load scenarios'}
        </Alert>
      )}

      {/* Loading state */}
      {scenariosLoading && (
        <LoadingSpinner />
      )}

      {!scenariosLoading && !scenariosError && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Left Panel: Scenario List */}
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={3}>Scenarios</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                New
              </Button>
            </Group>

            {scenarios.length === 0 ? (
              <Card p="md" radius="md" style={{ border: `1px solid ${BORDER_STRONG}` }}>
                <Stack gap="xs" align="center" py="xl">
                  <Text size="sm" c={TEXT_SUBTLE} ta="center">
                    No scenarios yet
                  </Text>
                  <Text size="xs" c={TEXT_SUBTLE} ta="center">
                    Create a new scenario to get started
                  </Text>
                </Stack>
              </Card>
            ) : (
              <ScrollArea>
                <Stack gap="sm">
                  {scenarios.map((scenario) => (
                    <Card
                      key={scenario.id}
                      p="md"
                      radius="md"
                      style={{
                        cursor: 'pointer',
                        border: selectedId === scenario.id ? `2px solid ${COLOR_BLUE}` : `1px solid ${BORDER_STRONG}`,
                        backgroundColor: selectedId === scenario.id ? SURFACE_LIGHT : undefined,
                      }}
                      onClick={() => setSelectedId(scenario.id)}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={600} size="sm">{scenario.name}</Text>
                            <Text size="xs" c={TEXT_SUBTLE}>
                              {new Date(scenario.createdAt).toLocaleDateString()}
                            </Text>
                          </div>
                          <Badge color={statusColors[scenario.status]} variant="light" size="sm">
                            {scenario.status}
                          </Badge>
                        </Group>
                        {scenario.description && (
                          <Text size="xs" c={TEXT_SUBTLE} lineClamp={2}>
                            {scenario.description}
                          </Text>
                        )}
                        <Button
                          variant="subtle"
                          size="xs"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScenario(scenario.id);
                          }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Stack>

          {/* Right Panel: Scenario Detail */}
          {selectedScenario && (
            <Stack gap="md">
              <Paper p="md" radius="md" bg={SURFACE_LIGHT}>
                <Stack gap="md">
                  <div>
                    <Title order={3}>{selectedScenario.name}</Title>
                    {selectedScenario.description && (
                      <Text size="sm" c={TEXT_SUBTLE} mt="xs">
                        {selectedScenario.description}
                      </Text>
                    )}
                  </div>

                  {/* Headcount Chart */}
                  {snapshotsLoading ? (
                    <LoadingSpinner />
                  ) : snapshots.length > 0 ? (
                    <Box>
                      <Text fw={600} size="sm" mb="sm">Headcount Projection</Text>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={snapshots}>
                          <defs>
                            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLOR_BLUE} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={COLOR_BLUE} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={BORDER_STRONG} />
                          <XAxis dataKey="snapshotDate" style={{ fontSize: 12 }} />
                          <YAxis style={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#222' : '#fff',
                              border: `1px solid ${BORDER_STRONG}`,
                            }}
                            formatter={(value: number) => value.toString()}
                          />
                          <Area
                            type="monotone"
                            dataKey="totalHeadcount"
                            stroke={COLOR_BLUE}
                            fillOpacity={1}
                            fill="url(#gradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : null}

                  {/* Changes List */}
                  {changesLoading ? (
                    <LoadingSpinner />
                  ) : changes.length > 0 ? (
                    <Box>
                      <Text fw={600} size="sm" mb="sm">Planned Changes</Text>
                      <Stack gap="xs">
                        {changes.map((change) => (
                          <Paper key={change.id} p="sm" bg={isDark ? '#2a2a2a' : '#f9f9f9'} radius="sm">
                            <Group justify="space-between" align="center">
                              <Group gap="sm" align="flex-start">
                                <ThemeIcon size="sm" color={COLOR_ORANGE} variant="light">
                                  {change.changeType === 'HIRE' ? <IconUsers size={14} /> : <IconHistory size={14} />}
                                </ThemeIcon>
                                <div>
                                  <Text size="sm" fw={500}>{change.changeType}</Text>
                                  {change.impactDescription && (
                                    <Text size="xs" c={TEXT_SUBTLE}>{change.impactDescription}</Text>
                                  )}
                                </div>
                              </Group>
                              {change.impactCost && (
                                <Text size="sm" fw={600} c={COLOR_BLUE}>
                                  ${(change.impactCost / 1000).toFixed(0)}k
                                </Text>
                              )}
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  {/* Action Buttons */}
                  <Group grow>
                    <Button
                      variant="light"
                      size="sm"
                      onClick={handleActivate}
                      disabled={selectedScenario.status !== 'DRAFT' || activateMutation.isPending}
                      loading={activateMutation.isPending}
                    >
                      Activate
                    </Button>
                    <Button
                      variant="light"
                      color={COLOR_GREEN}
                      size="sm"
                      onClick={handleApprove}
                      disabled={selectedScenario.status !== 'ACTIVE' || approveMutation.isPending}
                      loading={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          )}
        </SimpleGrid>
      )}

      {/* New Scenario Modal */}
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Scenario"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Scenario Name"
            placeholder="e.g., Q2 Hiring Plan"
            value={newScenario.name}
            onChange={(e) => setNewScenario({ ...newScenario, name: e.currentTarget.value })}
          />
          <Textarea
            label="Description (optional)"
            placeholder="What is the purpose of this scenario?"
            value={newScenario.description}
            onChange={(e) => setNewScenario({ ...newScenario, description: e.currentTarget.value })}
            rows={3}
          />
          <Group grow>
            <Button variant="light" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateScenario}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
