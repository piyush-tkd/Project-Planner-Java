/**
 * TeamTypeBadge — shows Core Team or Project Team with appropriate styling
 * Sprint 4: PP-406
 */
import { Badge } from '@mantine/core';
interface TeamTypeBadgeProps {
  type: 'core' | 'project' | 'Core Team' | 'Project Team' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function TeamTypeBadge({ type, size = 'sm' }: TeamTypeBadgeProps) {
  const isCore = type === 'core' || type === 'Core Team';
  return (
    <Badge
      size={size}
      color={isCore ? 'blue' : 'pink'}
      variant="light"
      fw={600}
      style={{ letterSpacing: '0.02em' }}
    >
      {isCore ? 'Core' : 'Project'}
    </Badge>
  );
}
