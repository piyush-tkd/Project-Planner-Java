import { Text, Group } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface DataFreshnessProps {
  dataUpdatedAt?: number;
}

export const DataFreshness = ({ dataUpdatedAt }: DataFreshnessProps) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!dataUpdatedAt) return;

    const calculateTimeAgo = () => {
      const now = Date.now();
      const diffMs = now - dataUpdatedAt;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 5) {
        setTimeAgo('Updated just now');
      } else if (diffSeconds < 60) {
        setTimeAgo(`Updated ${diffSeconds}s ago`);
      } else if (diffMinutes < 60) {
        setTimeAgo(`Updated ${diffMinutes}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`Updated ${diffHours}h ago`);
      } else {
        setTimeAgo(`Updated ${diffDays}d ago`);
      }
    };

    calculateTimeAgo();

    const interval = setInterval(calculateTimeAgo, 30000);

    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  if (!dataUpdatedAt || !timeAgo) {
    return null;
  }

  return (
    <Group gap={6}>
      <IconClock size={12} />
      <Text size="xs" c="dimmed">
        {timeAgo}
      </Text>
    </Group>
  );
};
