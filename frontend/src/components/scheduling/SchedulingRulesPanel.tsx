import { Card, Text, Group, Slider, Button, SimpleGrid, Box, Divider } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { AQUA, DARK_BORDER, DEEP_BLUE, FONT_FAMILY, GRAY_100, SHADOW, SURFACE_SUBTLE } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { SchedulingRulesResponse } from '../../types';

interface SchedulingRulesPanelProps {
  rules: SchedulingRulesResponse;
  onChange: (rules: Partial<SchedulingRulesResponse>) => void;
  onApply: () => void;
  saving?: boolean;
}

function RuleSlider({ label, value, onChange, min, max, color, marks, suffix = 'd' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  color: string;
  marks: { value: number; label: string }[];
  suffix?: string;
}) {
  const dark = useDarkMode();
  return (
    <Box
      p="md"
      style={{
        background: dark ? 'rgba(255,255,255,0.03)' : SURFACE_SUBTLE,
        borderRadius: 8,
        border: `1px solid ${dark ? DARK_BORDER : GRAY_100}`,
      }}
    >
      <Group justify="space-between" mb={12}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.03em' }}>
          {label}
        </Text>
        <Text fw={700} size="md" style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
          {value}{suffix}
        </Text>
      </Group>
      <Box px={4}>
        <Slider
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          color={color}
          marks={marks}
          styles={{
            markLabel: { fontSize: 10, marginTop: 6 },
            root: { marginBottom: 8 },
          }}
        />
      </Box>
    </Box>
  );
}

export default function SchedulingRulesPanel({ rules, onChange, onApply, saving }: SchedulingRulesPanelProps) {
  const dark = useDarkMode();

  return (
    <Card withBorder padding="lg" style={{ boxShadow: SHADOW.card }}>
      <Group justify="space-between" mb="lg">
        <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
          Scheduling Rules
        </Text>
        <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={onApply} loading={saving}>
          Apply Rules
        </Button>
      </Group>

      {/* Phase Timing Rules */}
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.04em' }}>
        Phase Timing
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb="lg">
        <RuleSlider
          label="QA Lag (after Dev starts)"
          value={rules.qaLagDays}
          onChange={(v) => onChange({ qaLagDays: v })}
          min={0} max={30} color="cyan"
          marks={[{ value: 0, label: '0' }, { value: 15, label: '15' }, { value: 30, label: '30' }]}
        />
        <RuleSlider
          label="UAT Gap (after QA ends)"
          value={rules.uatGapDays}
          onChange={(v) => onChange({ uatGapDays: v })}
          min={0} max={10} color="cyan"
          marks={[{ value: 0, label: '0' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
        />
        <RuleSlider
          label="UAT Duration"
          value={rules.uatDurationDays}
          onChange={(v) => onChange({ uatDurationDays: v })}
          min={3} max={20} color="pink"
          marks={[{ value: 3, label: '3' }, { value: 10, label: '10' }, { value: 20, label: '20' }]}
        />
        <RuleSlider
          label="E2E Gap (after all PODs)"
          value={rules.e2eGapDays}
          onChange={(v) => onChange({ e2eGapDays: v })}
          min={0} max={10} color="orange"
          marks={[{ value: 0, label: '0' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
        />
      </SimpleGrid>

      {/* Parallelization Factors */}
      <Divider mb="lg" />
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.04em' }}>
        Parallelization Factors
      </Text>
      <Text size="xs" c="dimmed" mb="md">
        How much of each phase can be split across multiple people. Work that isn't parallelizable takes the same time regardless of team size.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <RuleSlider
          label="Dev Parallel %"
          value={rules.devParallelPct}
          onChange={(v) => onChange({ devParallelPct: v })}
          min={0} max={100} color="blue" suffix="%"
          marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
        />
        <RuleSlider
          label="QA Parallel %"
          value={rules.qaParallelPct}
          onChange={(v) => onChange({ qaParallelPct: v })}
          min={0} max={100} color="green" suffix="%"
          marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
        />
        <RuleSlider
          label="UAT Parallel %"
          value={rules.uatParallelPct}
          onChange={(v) => onChange({ uatParallelPct: v })}
          min={0} max={100} color="pink" suffix="%"
          marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
        />
      </SimpleGrid>
    </Card>
  );
}
