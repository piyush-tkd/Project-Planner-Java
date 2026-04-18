/**
 * HealthBadge — reusable traffic-light indicator for project health RAG status.
 *
 * Variants:
 *  - "dot"    : coloured circle only (for compact list columns)
 *  - "badge"  : coloured pill with label text (default)
 *  - "score"  : badge + numeric score (e.g. "Healthy · 84")
 */
import { Tooltip, Badge, Text, RingProgress } from '@mantine/core';
import { RagStatus, RAG_COLORS, RAG_MANTINE, RAG_LABEL, ProjectHealthDto } from '../../api/projectHealth';
interface HealthBadgeProps {
  rag:      RagStatus;
  score?:   number | null;
  variant?: 'dot' | 'badge' | 'score';
  size?:    'xs' | 'sm' | 'md';
  tooltip?: string;
}

export default function HealthBadge({
  rag,
  score,
  variant = 'badge',
  size = 'sm',
  tooltip
}: HealthBadgeProps) {
  const color  = RAG_COLORS[rag];
  const mColor = RAG_MANTINE[rag];
  const label  = RAG_LABEL[rag];

  const dotSize = size === 'xs' ? 8 : size === 'sm' ? 10 : 12;

  const dot = (
    <span
      style={{
        display:         'inline-block',
        width:           dotSize,
        height:          dotSize,
        borderRadius:    '50%',
        background:      color,
        flexShrink:      0,
        boxShadow:       `0 0 0 2px ${color}33`
      }}
    />
  );

  let content: React.ReactNode;

  if (variant === 'dot') {
    content = dot;
  } else if (variant === 'score' && score != null) {
    content = (
      <Badge
        size={size}
        variant="light"
        color={mColor}
        leftSection={dot}
      >
        {label} · {score}
      </Badge>
    );
  } else {
    content = (
      <Badge
        size={size}
        variant="light"
        color={mColor}
        leftSection={dot}
      >
        {label}
      </Badge>
    );
  }

  if (tooltip) {
    return <Tooltip label={tooltip} withArrow fz="xs">{content as React.ReactElement}</Tooltip>;
  }
  return <>{content}</>;
}

// ── Score ring (used on project detail page) ──────────────────────────────

interface ScoreRingProps {
  health: ProjectHealthDto;
  size?:  number;
}

export function HealthScoreRing({ health, size = 80 }: ScoreRingProps) {
  if (health.ragStatus === 'GREY' || health.overallScore == null) {
    return (
      <RingProgress
        size={size}
        thickness={size / 10}
        roundCaps
        sections={[{ value: 100, color: 'gray' }]}
        label={
          <Text ta="center" size="xs" c="dimmed">
            N/A
          </Text>
        }
      />
    );
  }

  const color = RAG_MANTINE[health.ragStatus];
  return (
    <RingProgress
      size={size}
      thickness={size / 10}
      roundCaps
      sections={[{ value: health.overallScore, color }]}
      label={
        <Text ta="center" fw={700} size={size > 70 ? 'sm' : 'xs'} c={color}>
          {health.overallScore}
        </Text>
      }
    />
  );
}
