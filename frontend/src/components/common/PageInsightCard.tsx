import { useState, useEffect } from 'react';
import {
  Paper, Group, Text, Stack, Button, ActionIcon, Badge,
  ThemeIcon, Box, Collapse,
} from '@mantine/core';
import {
  IconX, IconRefresh, IconChevronDown, IconChevronUp, IconSparkles,
} from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, SURFACE_SUBTLE, TEXT_SUBTLE, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface PageInsightCardProps {
  pageKey: string;
  data?: any;
}

/**
 * Generates AI insights client-side from live data.
 */
function generateInsight(pageKey: string, data: any): string {
  switch (pageKey) {
    case 'projects': {
      const atRisk = data?.filter((p: any) => p.status === 'AT_RISK').length ?? 0;
      const overdue = data?.filter((p: any) => p.targetDate && new Date(p.targetDate) < new Date()).length ?? 0;
      if (atRisk > 0) {
        return `⚠️ ${atRisk} project${atRisk > 1 ? 's are' : ' is'} at risk. Consider reviewing resource allocation and timeline buffers.`;
      }
      if (overdue > 0) {
        return `🕐 ${overdue} project${overdue > 1 ? 's have' : ' has'} passed their target date. Review with stakeholders to update timelines or reprioritize scope.`;
      }
      return `✅ All projects are on track. Great portfolio health!`;
    }
    case 'resources': {
      const inactive = data?.filter((r: any) => !r.active).length ?? 0;
      // ResourceResponse uses podAssignment: { podId, podName, capacityFte } | null
      // (not homePodId — that field only exists on ResourceRequest)
      // Only flag active resources without a pod assignment
      const unassigned = data?.filter((r: any) => r.active && !r.podAssignment?.podId).length ?? 0;
      if (unassigned > 2) {
        return `👥 ${unassigned} active resources have no pod assignment. Consider assigning them to a pod to track utilization.`;
      }
      if (inactive > 0) {
        return `ℹ️ ${inactive} resource${inactive > 1 ? 's are' : ' is'} inactive. Archive them to keep your roster clean.`;
      }
      const activeCount = data?.filter((r: any) => r.active).length ?? 0;
      return `👥 Resource roster looks healthy across ${activeCount} active members.`;
    }
    case 'capacity': {
      return `📊 Review capacity vs demand by pod to identify upcoming bottlenecks before they impact delivery.`;
    }
    case 'risks': {
      const critical = data?.filter((r: any) => r.severity >= 4).length ?? 0;
      if (critical > 0) {
        return `🔴 ${critical} critical risk${critical > 1 ? 's need' : ' needs'} immediate attention. Assign owners and mitigation plans.`;
      }
      return `🛡️ Risk register is being actively managed. Keep monitoring open items weekly.`;
    }
    case 'pods': {
      const inactive = data?.filter((p: any) => !p.active).length ?? 0;
      const total = data?.length ?? 0;
      return `⬡ ${total} active pod${total !== 1 ? 's' : ''} in your organization.${inactive > 0 ? ` ${inactive} inactive.` : ''} Review capacity allocations quarterly.`;
    }
    case 'dashboard': {
      return `📈 Your portfolio is being actively tracked. Use the cross-filters in the Dashboard Builder to drill into specific dimensions.`;
    }
    default:
      return `💡 Review this page regularly to keep data fresh and insights accurate.`;
  }
}

export function PageInsightCard({ pageKey, data }: PageInsightCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const isDark = useDarkMode();

  // Compute today's date key for localStorage
  const today = new Date().toISOString().split('T')[0];
  const dismissKey = `pp_insight_dismissed_${pageKey}_${today}`;

  // Check if dismissed for today
  useEffect(() => {
    const wasDismissed = localStorage.getItem(dismissKey);
    if (wasDismissed) {
      setDismissed(true);
    } else {
      setDismissed(false);
      setInsight(generateInsight(pageKey, data));
    }
  }, [pageKey, data, dismissKey]);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  const handleRefresh = () => {
    setInsight(generateInsight(pageKey, data));
  };

  if (dismissed) {
    return null;
  }

  // Subtle gradient border: aqua → purple
  const borderGradientId = `pp-insight-gradient-${pageKey}`;
  const borderStyle = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background: isDark ? 'rgba(12, 35, 64, 0.3)' : 'rgba(255, 255, 255, 0.5)',
    border: `1px solid ${isDark ? 'rgba(45, 204, 211, 0.2)' : 'rgba(45, 204, 211, 0.3)'}`,
    borderImage: isDark 
      ? `linear-gradient(90deg, rgba(45, 204, 211, 0.3), rgba(147, 112, 219, 0.2)) 1`
      : `linear-gradient(90deg, rgba(45, 204, 211, 0.4), rgba(147, 112, 219, 0.3)) 1`,
  };

  return (
    <Paper
      radius="lg"
      p="md"
      style={{
        ...borderStyle,
        marginBottom: 16,
      }}
      withBorder={false}
    >
      <Stack gap={8}>
        {/* Header with badge and controls */}
        <Group justify="space-between" align="center">
          <Group gap={8} align="center">
            <ThemeIcon
              variant="gradient"
              gradient={{ from: AQUA, to: DEEP_BLUE, deg: 135 }}
              size={24}
              radius="md"
            >
              <IconSparkles size={14} color="white" />
            </ThemeIcon>
            <Badge
              size="sm"
              variant="light"
              style={{
                background: isDark ? 'rgba(45, 204, 211, 0.15)' : 'rgba(45, 204, 211, 0.1)',
                color: AQUA,
                fontFamily: FONT_FAMILY,
              }}
            >
              ✨ AI Insight
            </Badge>
          </Group>
          <Group gap={4}>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleRefresh}
              title="Refresh insight"
            >
              <IconRefresh size={14} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleDismiss}
              title="Dismiss for today"
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Insight text (collapsible) */}
        <Collapse in={expanded}>
          <Text
            size="sm"
            style={{
              color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'var(--pp-text)',
              lineHeight: 1.5,
              fontFamily: FONT_FAMILY,
            }}
          >
            {insight}
          </Text>
        </Collapse>
      </Stack>
    </Paper>
  );
}
