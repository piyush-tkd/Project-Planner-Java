import { Stack, Title, Text, ThemeIcon } from '@mantine/core';
import { IconBrain } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, FONT_FAMILY } from '../../../brandTokens';

export function HeroSection({
  greeting,
  isDark,
}: {
  greeting: { title: string; subtitle: string };
  isDark: boolean;
}) {
  return (
    <div className="nlp-hero" style={{ marginBottom: 16, position: 'relative' }}>
      <div className="nlp-orb nlp-orb-1" />
      <div className="nlp-orb nlp-orb-2" />
      <div className="nlp-orb nlp-orb-3" />

      <Stack align="center" gap={6} style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <ThemeIcon
            size={48}
            radius="xl"
            variant="gradient"
            gradient={{ from: AQUA, to: DEEP_BLUE, deg: 135 }}
            style={{
              boxShadow: `0 0 24px ${AQUA}30`,
              animation: 'float 4s ease-in-out infinite',
            }}
          >
            <IconBrain size={28} />
          </ThemeIcon>
          <div style={{
            position: 'absolute',
            inset: -5,
            borderRadius: '50%',
            border: `1.5px solid ${AQUA}25`,
            animation: 'pulse-ring 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }} />
        </div>
        <Title
          order={2}
          ta="center"
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 700,
            lineHeight: 1.2,
            color: isDark ? '#ffffff' : DEEP_BLUE,
            letterSpacing: '-0.02em',
            padding: '0 8px',
          }}
        >
          {greeting.title}
        </Title>
        <Text ta="center" size="sm" maw={440} style={{
          lineHeight: 1.5,
          padding: '0 12px',
          color: isDark ? '#9ca3af' : '#6D7B8C',
          fontSize: 13,
        }}>
          {greeting.subtitle}
        </Text>
      </Stack>
    </div>
  );
}
