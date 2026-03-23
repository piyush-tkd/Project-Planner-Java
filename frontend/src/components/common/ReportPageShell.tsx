/**
 * ReportPageShell — consistent wrapper for all report pages.
 *
 * Provides:
 *   - Fade-in animation on mount
 *   - Title + optional subtitle
 *   - Optional summary cards row
 *   - Consistent spacing
 *   - Optional filter controls area
 */
import { ReactNode } from 'react';
import { Stack, Title, Text, Group, SimpleGrid, Paper, ThemeIcon, useComputedColorScheme } from '@mantine/core';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW } from '../../brandTokens';

export interface SummaryCardItem {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  /** Optional trend indicator text like "+12%" or "-3 FTE" */
  trend?: string;
  trendColor?: string;
}

interface ReportPageShellProps {
  title: string;
  subtitle?: string;
  summaryCards?: SummaryCardItem[];
  filters?: ReactNode;
  children: ReactNode;
}

/* Ensure keyframes are injected once */
const STYLE_ID = 'report-page-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes rp-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes rp-card-in {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function SummaryCard({ label, value, icon, color, trend, trendColor, isDark }: SummaryCardItem & { index?: number; isDark?: boolean }) {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        borderLeft: `3px solid ${color || AQUA}`,
        boxShadow: SHADOW.card,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = SHADOW.cardHover;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = SHADOW.card;
        e.currentTarget.style.transform = '';
      }}
    >
      <Group gap="sm" wrap="nowrap">
        {icon && (
          <ThemeIcon size={36} radius="md" variant="light" color={color || 'teal'}>
            {icon}
          </ThemeIcon>
        )}
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ fontFamily: FONT_FAMILY, letterSpacing: '0.03em' }}>
            {label}
          </Text>
          <Group gap={8} align="baseline">
            <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE, lineHeight: 1.2 }}>
              {value}
            </Text>
            {trend && (
              <Text size="xs" fw={600} c={trendColor || 'dimmed'} style={{ fontFamily: FONT_FAMILY }}>
                {trend}
              </Text>
            )}
          </Group>
        </div>
      </Group>
    </Paper>
  );
}

export default function ReportPageShell({ title, subtitle, summaryCards, filters, children }: ReportPageShellProps) {
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  return (
    <Stack gap="lg" className="page-enter stagger-children">
      {/* Header */}
      <div className="slide-in-left">
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
          {title}
        </Title>
        {subtitle && (
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            {subtitle}
          </Text>
        )}
      </div>

      {/* Filters */}
      {filters && (
        <Group gap="md" align="flex-end">
          {filters}
        </Group>
      )}

      {/* Summary cards */}
      {summaryCards && summaryCards.length > 0 && (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: Math.min(summaryCards.length, 4) }} spacing="md" className="stagger-grid">
          {summaryCards.map((card, i) => (
            <div key={i} style={{ animation: `rp-card-in 0.3s ease-out ${i * 0.06}s both` }}>
              <SummaryCard {...card} isDark={isDark} />
            </div>
          ))}
        </SimpleGrid>
      )}

      {/* Chart / table content */}
      {children}
    </Stack>
  );
}
