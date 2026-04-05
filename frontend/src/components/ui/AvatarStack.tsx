import React from 'react';
import { Avatar, Tooltip } from '@mantine/core';

interface User {
  name: string;
  avatar?: string;
}

interface AvatarStackProps {
  users: User[];
  max?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() ?? '?';
}

export default function AvatarStack({ users, max = 3 }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <Avatar.Group spacing="sm">
      {visible.map((user, i) => (
        <Tooltip key={i} label={user.name} withArrow>
          <Avatar
            src={user.avatar ?? null}
            radius="xl"
            size="sm"
            color="blue"
          >
            {!user.avatar ? getInitials(user.name) : undefined}
          </Avatar>
        </Tooltip>
      ))}

      {overflow > 0 && (
        <Tooltip
          label={users
            .slice(max)
            .map((u) => u.name)
            .join(', ')}
          withArrow
          multiline
          maw={200}
        >
          <Avatar radius="xl" size="sm" color="gray">
            +{overflow}
          </Avatar>
        </Tooltip>
      )}
    </Avatar.Group>
  );
}
