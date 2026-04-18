/**
 * SupplyDemandPage — Sprint 8, PP-803
 * Grouped bar chart: supply vs demand gap by role type
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Group, Title, Text, Select, Paper, Badge, Table, Alert, Skeleton,
} from '@mantine/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { IconAlertCircle } from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE, AQUA, COLOR_TEAL, FONT_FAMILY, SHADOW } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';

interface GapRow { roleType: string; demand: number; supply: number; gap: number }

export default function SupplyDemandPage() {
  const dark = useDarkMode();
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const { data: rawData, isLoading, isError } = useQuery<GapRow[]>({
    queryKey: ['supply-demand-gap-analysis'],
    queryFn: () => apiClient.get('/demands/gap-analysis').then(r => r.data),
  });

  const data = Array.isArray(rawData) ? rawData : [];

  const filteredData = roleFilter ? data.filter(d => d.roleType === roleFilter) : data;
  const roleOptions = [...new Set(data.map(d => d.roleType))].map(r => ({ value: r, label: r }));

  const textColor = dark ? '#e2e4eb' : DEEP_BLUE;

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Supply vs Demand</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Resource availability vs. open demand requests by role type
          </Text>
        </div>
        <Select
          placeholder="All roles"
          data={roleOptions}
          value={roleFilter}
          onChange={setRoleFilter}
          clearable
          w={180}
        />
      </Group>

      {isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" mb="sm">
          Failed to load supply/demand data. Please refresh and try again.
        </Alert>
      )}
      {isLoading ? (
        <Stack gap="md">
          <Skeleton height={340} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      ) : filteredData.length === 0 ? (
        <Alert color="blue" radius="md">
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
            No gap analysis data available. Create demand requests to see supply/demand gaps.
          </Text>
        </Alert>
      ) : (
        <>
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
              Supply vs Demand by Role
            </Text>
            <div role="img" aria-label="Bar chart">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={filteredData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                <XAxis dataKey="roleType" tick={{ fontSize: 12, fontFamily: FONT_FAMILY, fill: textColor }} />
                <YAxis tick={{ fontSize: 12, fontFamily: FONT_FAMILY, fill: textColor }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${AQUA}30`,
                    background: dark ? '#1e293b' : '#fff',
                    color: textColor,
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
                <ReferenceLine y={0} stroke={textColor} strokeOpacity={0.3} />
                <Bar dataKey="supply" name="Supply (Available)" fill={COLOR_TEAL} radius={[4,4,0,0]} />
                <Bar dataKey="demand" name="Demand (Requested)" fill={AQUA_HEX}      radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </Paper>

          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>Gap Analysis</Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {['Role Type','Supply','Demand','Gap','Status'].map(h => (
                    <Table.Th key={h} style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredData.map(row => (
                  <Table.Tr key={row.roleType}>
                    <Table.Td><Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{row.roleType}</Text></Table.Td>
                    <Table.Td><Badge color="teal" variant="light">{row.supply}</Badge></Table.Td>
                    <Table.Td><Badge color="blue" variant="light">{row.demand}</Badge></Table.Td>
                    <Table.Td>
                      <Badge color={row.gap >= 0 ? 'green' : 'red'} variant="light">
                        {row.gap >= 0 ? `+${row.gap}` : row.gap}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={row.gap >= 0 ? 'teal' : 'red'} size="xs">
                        {row.gap >= 0 ? 'Surplus' : 'Deficit'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      )}
    </Stack>
  );
}
