import { Card, Text, Group } from '@mantine/core';
import { type ReactNode } from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

export default function SummaryCard({ title, value, icon, color }: SummaryCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed" fw={500}>{title}</Text>
        {icon}
      </Group>
      <Text size="xl" fw={700} c={color}>{value}</Text>
    </Card>
  );
}
