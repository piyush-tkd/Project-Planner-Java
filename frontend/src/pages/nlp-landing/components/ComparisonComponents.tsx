import { Paper, Group, Stack, Badge, Text } from '@mantine/core';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../../brandTokens';
import { DrillDownButton } from './SubComponents';

export function ComparisonCard({
  nameA, nameB, entityType, left, right, isDark, onNavigate, drillDown,
}: {
  nameA: string; nameB: string; entityType: string;
  left: Record<string, unknown>; right: Record<string, unknown>;
  isDark: boolean; onNavigate: (route: string) => void; drillDown?: string | null;
}) {
  const hasError = left.error || right.error;
  const borderColor = isDark ? '#2C2C2C' : '#E9ECEF';

  const allKeys = Array.from(new Set([
    ...Object.keys(left),
    ...Object.keys(right),
  ])).filter(k => !k.startsWith('_') && k !== 'items' && k !== 'error' && k !== 'count_line');

  return (
    <Stack gap="sm">
      <Group justify="center" gap="md">
        <Badge variant="filled" size="md" style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{nameA}</Badge>
        <Text size="sm" c="dimmed" fw={700} style={{ fontFamily: FONT_FAMILY }}>vs</Text>
        <Badge variant="filled" size="md" style={{ backgroundColor: AQUA, fontFamily: FONT_FAMILY }}>{nameB}</Badge>
      </Group>

      {hasError ? (
        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          {String(left.error || right.error)}
        </Text>
      ) : (
        <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDark ? '#1A1B1E' : DEEP_BLUE }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: FONT_FAMILY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {entityType}
                </th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>
                  <Badge size="xs" variant="filled" style={{ backgroundColor: DEEP_BLUE }}>{nameA}</Badge>
                </th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>
                  <Badge size="xs" variant="filled" style={{ backgroundColor: AQUA }}>{nameB}</Badge>
                </th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map((key) => (
                <tr key={key} style={{ borderTop: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, fontFamily: FONT_FAMILY, textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>
                    {left[key] != null ? String(left[key]) : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>
                    {right[key] != null ? String(right[key]) : '—'}
                  </td>
                </tr>
              ))}
              {(left.items != null || right.items != null) && (
                <tr style={{ borderTop: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, fontFamily: FONT_FAMILY }}>Members</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: FONT_FAMILY, verticalAlign: 'top' }}>
                    {(left.items as string[] ?? []).map(m => <div key={m}>• {m}</div>)}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: FONT_FAMILY, verticalAlign: 'top' }}>
                    {(right.items as string[] ?? []).map(m => <div key={m}>• {m}</div>)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Paper>
      )}

      {drillDown && (
        <DrillDownButton route={drillDown} onNavigate={onNavigate} label="View full details" />
      )}
    </Stack>
  );
}

export function ComparisonTable({ data }: { data: Record<string, unknown> }) {
  const entityA = String(data.entityA ?? '');
  const entityB = String(data.entityB ?? '');

  const metricsA: [string, string][] = [];
  const metricsB: [string, string][] = [];

  Object.entries(data).forEach(([key, val]) => {
    if (key.startsWith('_') || key === 'compareType' || key === 'entityA' || key === 'entityB') return;
    if (key.startsWith(entityA + ' ')) {
      metricsA.push([key.replace(entityA + ' ', ''), String(val)]);
    } else if (key.startsWith(entityB + ' ')) {
      metricsB.push([key.replace(entityB + ' ', ''), String(val)]);
    }
  });

  return (
    <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: DEEP_BLUE }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: FONT_FAMILY, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Metric</th>
            <th style={{ textAlign: 'center', padding: '8px 12px' }}>
              <Badge variant="filled" size="xs" style={{ backgroundColor: AQUA }}>{entityA}</Badge>
            </th>
            <th style={{ textAlign: 'center', padding: '8px 12px' }}>
              <Badge variant="filled" size="xs" color="grape">{entityB}</Badge>
            </th>
          </tr>
        </thead>
        <tbody>
          {metricsA.map(([metric, valA], i) => {
            const valB = metricsB[i]?.[1] ?? '–';
            return (
              <tr key={metric} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, fontFamily: FONT_FAMILY }}>{metric}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>{valA}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>{valB}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Paper>
  );
}
