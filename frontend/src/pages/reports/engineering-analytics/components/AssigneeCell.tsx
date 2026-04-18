import { Avatar, Group, Text } from '@mantine/core';

export function AssigneeCell({ name, avatars, avatarUrl: directAvatarUrl }: { name: string | null; avatars?: Record<string, string>; avatarUrl?: string | null }) {
 if (!name) return <Text size="xs" c="dimmed">Unassigned</Text>;
 const avatarUrl = directAvatarUrl ?? avatars?.[name];
 const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
 const colors = ['blue', 'teal', 'violet', 'orange', 'green', 'pink', 'cyan'];
 const colorIdx = name.charCodeAt(0) % colors.length;
 return (
 <Group gap={6} wrap="nowrap">
 {avatarUrl
 ? <Avatar size={22} radius="xl" src={avatarUrl} alt={name} />
 : <Avatar size={22} radius="xl" color={colors[colorIdx]}>{initials}</Avatar>
 }
 <Text size="xs" lineClamp={1}>{name}</Text>
 </Group>
 );
}
