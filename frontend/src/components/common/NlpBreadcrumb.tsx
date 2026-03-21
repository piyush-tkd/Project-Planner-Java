/**
 * NlpBreadcrumb — Shows a "Back to Ask AI" link when the user
 * navigated to this page from the NLP landing page.
 * Reads `location.state.fromNlp` set by NlpLandingPage navigation.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { Group, Text, UnstyledButton } from '@mantine/core';
import { IconBrain, IconChevronLeft } from '@tabler/icons-react';
import { AQUA, AQUA_TINTS, FONT_FAMILY } from '../../brandTokens';

export default function NlpBreadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const fromNlp = (location.state as Record<string, unknown>)?.fromNlp === true;

  if (!fromNlp) return null;

  return (
    <UnstyledButton
      onClick={() => navigate('/nlp')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 6px',
        borderRadius: 6,
        backgroundColor: AQUA_TINTS[10],
        transition: 'all 150ms ease',
        marginBottom: 8,
      }}
      className="nlp-breadcrumb-btn"
    >
      <IconChevronLeft size={14} style={{ color: AQUA }} />
      <IconBrain size={14} style={{ color: AQUA }} />
      <Text size="xs" fw={600} style={{ color: AQUA, fontFamily: FONT_FAMILY }}>
        Back to Ask AI
      </Text>
    </UnstyledButton>
  );
}
