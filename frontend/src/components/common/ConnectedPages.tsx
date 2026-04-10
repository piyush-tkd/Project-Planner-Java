/**
 * ConnectedPages
 *
 * A reusable "Related pages" section rendered at the bottom of any page.
 * Provides contextual navigation links so users can discover adjacent features
 * without hunting through the sidebar.
 *
 * Usage:
 *   <ConnectedPages pages={[
 *     { label: 'POD Detail', path: '/pods/123', description: 'View team & projects for this POD', icon: <IconHexagons size={18} /> },
 *     { label: 'Jira Dashboard', path: '/delivery/jira', description: 'Sprint metrics from Jira', icon: <IconChartBar size={18} /> },
 *   ]} />
 */

import { useNavigate } from 'react-router-dom';
import { Group, Text, Card, SimpleGrid, ThemeIcon, UnstyledButton, Divider, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

export interface ConnectedPage {
  label: string;
  path: string;
  description: string;
  icon: React.ReactNode;
  /** Optional colour for the icon background (Mantine color key, e.g. "teal") */
  color?: string;
}

interface ConnectedPagesProps {
  pages: ConnectedPage[];
  title?: string;
}

export default function ConnectedPages({ pages, title = 'Connected Pages' }: ConnectedPagesProps) {
  const navigate = useNavigate();
  const isDark = useDarkMode();

  if (!pages.length) return null;

  const cardBg = isDark ? 'var(--mantine-color-dark-6)' : '#f8fafc';
  const cardHover = isDark ? 'var(--mantine-color-dark-5)' : '#eef4fb';
  const borderCol = isDark ? 'var(--mantine-color-dark-4)' : '#e0e8f0';
  const titleColor = isDark ? '#fff' : DEEP_BLUE;

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <Divider mb="lg" />
      <Title
        order={5}
        mb="md"
        style={{ fontFamily: FONT_FAMILY, color: titleColor, letterSpacing: '0.01em' }}
      >
        {title}
      </Title>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="sm">
        {pages.map(page => (
          <UnstyledButton
            key={page.path}
            onClick={() => navigate(page.path)}
            style={{ borderRadius: 10, display: 'block' }}
          >
            <Card
              withBorder
              padding="md"
              radius="md"
              style={{
                background: cardBg,
                borderColor: borderCol,
                cursor: 'pointer',
                transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                height: '100%',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = cardHover;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(45,204,211,0.18)'}`;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = cardBg;
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <Group gap="sm" mb={8} wrap="nowrap">
                <ThemeIcon
                  size="md"
                  radius="sm"
                  color={page.color ?? 'teal'}
                  variant="light"
                  style={{ flexShrink: 0 }}
                >
                  {page.icon}
                </ThemeIcon>
                <Text fw={600} size="sm" style={{ color: isDark ? '#e8ecf0' : DEEP_BLUE, lineHeight: 1.3 }}>
                  {page.label}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2} mb={8}>
                {page.description}
              </Text>
              <Group gap={4} justify="flex-end">
                <Text size="xs" style={{ color: AQUA, fontWeight: 600 }}>Open</Text>
                <IconArrowRight size={12} color={AQUA} />
              </Group>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </div>
  );
}
