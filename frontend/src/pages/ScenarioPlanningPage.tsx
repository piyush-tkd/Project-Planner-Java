import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import {
  Stack, SimpleGrid, Text, Card, Group, Button, Badge, Title,
  Paper, ThemeIcon, Modal, TextInput, Textarea, Select, Box,
  ActionIcon, Menu, List, Flex,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import {
  IconPlus, IconChartAreaLine, IconHistory, IconCheck, IconX,
  IconEdit, IconTrash, IconDots, IconUsers, IconClock,
} from '@tabler/icons-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDarkMode } from '../hooks/useDarkMode';
import {
  COLOR_BLUE, COLOR_GREEN, COLOR_ORANGE, COLOR_VIOLET,
  SURFACE_LIGHT, TEXT_SUBTLE, BORDER_STRONG,
} from '../brandTokens';

interface Scenario {
  id: number;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'ARCHIVED';
  baseDate: string;
  createdAt: string;
}

interface ScenarioChange {
  id: number;
  changeType: string;
  entityType: string;
  impactCost?: number;
  impactDescription?: string;
}

interface ScenarioSnapshot {
  id: number;
  snapshotDate: string;
  totalHeadcount: number;
  totalCost: number;
  demandCoveragePct?: number;
}

const mockScenarios: Scenario[] = [
  {
    id: 1,
    name: 'Aggressive Expansion',
    description: 'Scale team by 40% to meet 2026 growth targets',
    status: 'ACTIVE',
    baseDate: '2026-04-09',
    createdAt: '2026-04-01',
  },
  {
    id: 2,
    name: 'Conservative Growth',
    description: 'Incremental hiring aligned with current velocity',
    status: 'DRAFT',
    baseDate: '2026-04-09',
    createdAt: '2026-04-05',
  },
];

const mockChanges: Record<number, ScenarioChange[]> = {
  1: [
    { id: 1, changeType: 'HIRE', entityType: 'RESOURCE', impactCost: 85000, impactDescription: 'Senior Engineer' },
    { id: 2, changeType: 'ADD_PROJECT', entityType: 'PROJECT', impactCost: 125000, impactDescription: 'Platform Upgrade' },
  ],
  2: [
    { id: 3, changeType: 'HIRE', entityType: 'RESOURCE', impactCost: 42000, impactDescription: 'Mid-level Engineer' },
  ],
};

const mockSnapshots: Record<number, ScenarioSnapshot[]> = {
  1: [
    { id: 1, snapshotDate: '2026-04-09', totalHeadcount: 45, totalCost: 450000, demandCoveragePct: 85 },
    { id: 2, snapshotDate: '2026-07-09', totalHeadcount: 55, totalCost: 550000, demandCoveragePct: 92 },
    { id: 3, snapshotDate: '2026-10-09', totalHeadcount: 63, totalCost: 630000, demandCoveragePct: 98 },
  ],
  2: [
    { id: 4, snapshotDate: '2026-04-09', totalHeadcount: 45, totalCost: 450000, demandCoveragePct: 85 },
    { id: 5, snapshotDate: '2026-07-09', totalHeadcount: 50, totalCost: 500000, demandCoveragePct: 88 },
  ],
};

const statusColors: Record<string, string> = {
  DRAFT: 'gray',
  ACTIVE: COLOR_BLUE,
  APPROVED: COLOR_GREEN,
  ARCHIVED: TEXT_SUBTLE,
};

export default function ScenarioPlanningPage() {
  const isDark = useDarkMode();
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(mockScenarios);
  const [newScenario, setNewScenario] = useState({ name: '', description: '' });

  const selectedScenario = scenarios.find(s => s.id === selectedId);
  const changes = selectedId ? (mockChanges[selectedId] || []) : [];
  const snapshots = selectedId ? (mockSnapshots[selectedId] || []) : [];

  const handleCreateScenario = () => {
    if (newScenario.name.trim()) {
      const scenario: Scenario = {
        id: Math.max(...scenarios.map(s => s.id)) + 1,
        name: newScenario.name,
        description: newScenario.description,
        status: 'DRAFT',
        baseDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      setScenarios([scenario, ...scenarios]);
      setSelectedId(scenario.id);
      setNewScenario({ name: '', description: '' });
      setIsModalOpen(false);
    }
  };

  const handleActivate = () => {
    if (selectedId) {
      setScenarios(scenarios.map(s =>
        s.id === selectedId ? { ...s, status: 'ACTIVE' as const } : s
      ));
    }
  };

  const handleApprove = () => {
    if (selectedId) {
      setScenarios(scenarios.map(s =>
        s.id === selectedId ? { ...s, status: 'APPROVED' as const } : s
      ));
    }
  };

  return (
    <PPPageLayout title="Scenario Planning">
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
                </Stack>
              </Card>
            ))}
          </Stack>
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
                {snapshots.length > 0 && (
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
                )}

                {/* Changes List */}
                {changes.length > 0 && (
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
                )}

                {/* Action Buttons */}
                <Group grow>
                  <Button
                    variant="light"
                    size="sm"
                    onClick={handleActivate}
                    disabled={selectedScenario.status !== 'DRAFT'}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="light"
                    color={COLOR_GREEN}
                    size="sm"
                    onClick={handleApprove}
                    disabled={selectedScenario.status !== 'ACTIVE'}
                  >
                    Approve
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}
      </SimpleGrid>

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
