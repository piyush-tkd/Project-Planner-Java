import React, { useState } from 'react';
import {
  Group, Badge, Text, Box, ThemeIcon, Collapse,
  Textarea, Button, ActionIcon, } from '@mantine/core';
import {
  IconThumbUp, IconThumbDown, IconBug, IconChevronDown, IconNotes,
          } from '@tabler/icons-react';
import { useNlpFeedback, useNlpFeedbackUndo, NlpQueryResponse } from '../../../api/nlp';
import { notifications } from '@mantine/notifications';
import { AQUA, AQUA_TINTS, DEEP_BLUE, DEEP_BLUE_TINTS, BORDER_DEFAULT, FONT_FAMILY } from '../../../brandTokens';
import {
  INTENT_ICONS, INTENT_LABELS,
  ENTITY_SIGNATURES,
} from '../constants';

// ── Result Card Header ──
export function ResultCardHeader({
  result,
  isDark,
}: {
  result: NlpQueryResponse;
  isDark: boolean;
}) {
  const icon = INTENT_ICONS[result.intent] ?? <IconNotes size={20} />;
  const intentLabel = INTENT_LABELS[result.intent] ?? result.intent;
  const confPct = Math.round(result.confidence * 100);
  const entityType = result.response.data?._type ? String(result.response.data._type) : null;
  const entitySig = entityType ? ENTITY_SIGNATURES[entityType] : null;

  return (
    <Box
      px="md"
      py="sm"
      style={{
        background: isDark
          ? `linear-gradient(135deg, rgba(45,204,211,0.12) 0%, rgba(12,35,64,0.12) 100%)`
          : `linear-gradient(135deg, ${AQUA_TINTS[10]} 0%, ${DEEP_BLUE_TINTS[10]} 100%)`,
        borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : BORDER_DEFAULT}`,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Group gap="sm" style={{ flex: 1 }}>
          <ThemeIcon
            size={36}
            radius="lg"
            variant="filled"
            style={{ backgroundColor: DEEP_BLUE }}
          >
            {icon}
          </ThemeIcon>
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={600} lh={1.4} style={{ fontFamily: FONT_FAMILY, color: isDark ? undefined : DEEP_BLUE }}>
              {(() => {
                const msg = result.response.message ?? 'No response';
                const hasStructuredData = result.response.data != null &&
                  result.response.shape != null &&
                  result.response.shape !== 'ERROR';
                if (!hasStructuredData && /^(I can help|I'll |Let me |Sure|Here|Absolutely|Of course|No problem|Got it|Looking)/i.test(msg)) {
                  return 'Hmm, I searched but couldn\'t find a match for that.';
                }
                return msg;
              })()}
            </Text>
          </div>
        </Group>
        <Group gap={6} style={{ flexShrink: 0 }}>
          {entitySig && (
            <Badge
              size="xs"
              variant="light"
              color={entitySig.color}
              radius="sm"
              leftSection={entitySig.icon}
              style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}
            >
              {entitySig.label}
            </Badge>
          )}
          <Badge
            size="xs"
            variant="filled"
            radius="sm"
            style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY, letterSpacing: '0.03em' }}
          >
            {intentLabel}
          </Badge>
          <Badge
            size="xs"
            variant="dot"
            color={result.confidence >= 0.75 ? 'green' : 'orange'}
            radius="sm"
            style={{ fontFamily: FONT_FAMILY }}
            title={`Resolved by ${result.resolvedBy} at ${confPct}% confidence`}
          >
            {confPct}%
          </Badge>
        </Group>
      </Group>
    </Box>
  );
}

// ── Feedback Row ──
export function FeedbackRow({ queryLogId, isDark }: { queryLogId: number; isDark: boolean }) {
  const feedback = useNlpFeedback();
  const undoMutation = useNlpFeedbackUndo();
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [comment, setComment] = useState('');
  const [commentSent, setCommentSent] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const startUndoWindow = () => {
    setUndoCountdown(10);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoCountdown(0);
    }, 10000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoMutation.mutate({ queryLogId });
    setSubmitted(null);
    setCommentSent(false);
    setShowExplanation(false);
    setComment('');
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setUndoCountdown(0);
  };

  const handleFeedback = (rating: number) => {
    const dir = rating > 0 ? 'up' : 'down';
    setSubmitted(dir);
    if (rating > 0) {
      feedback.mutate({ queryLogId, rating });
      startUndoWindow();
    } else {
      setShowExplanation(true);
    }
  };

  const handleSubmitExplanation = () => {
    const trimmed = comment.trim();
    feedback.mutate({
      queryLogId,
      rating: -1,
      comment: trimmed || undefined,
      screenshot: screenshotBase64 || undefined,
    });
    setCommentSent(true);
    setShowExplanation(false);
    startUndoWindow();
  };

  const handleSkipExplanation = () => {
    feedback.mutate({ queryLogId, rating: -1 });
    setCommentSent(true);
    setShowExplanation(false);
    startUndoWindow();
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      notifications.show({ title: 'File too large', message: 'Max 500KB for screenshots', color: 'red' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setScreenshotBase64(base64);
      setScreenshotPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box
      px="md"
      py={8}
      style={{
        borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : BORDER_DEFAULT}`,
        background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.015)',
      }}
    >
      <Group justify="flex-end" gap={6}>
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Was this helpful?</Text>
        <ActionIcon
          variant={submitted === 'up' ? 'filled' : 'subtle'}
          color={submitted === 'up' ? 'teal' : 'gray'}
          size="sm"
          radius="xl"
          onClick={() => handleFeedback(1)}
          disabled={submitted != null}
          title="Thumbs up"
          aria-label="Thumbs up"
        >
          <IconThumbUp size={14} />
        </ActionIcon>
        <ActionIcon
          variant={submitted === 'down' ? 'filled' : 'subtle'}
          color={submitted === 'down' ? 'red' : 'gray'}
          size="sm"
          radius="xl"
          onClick={() => handleFeedback(-1)}
          disabled={submitted != null}
          title="Thumbs down"
          aria-label="Thumbs down"
        >
          <IconThumbDown size={14} />
        </ActionIcon>
        {(submitted === 'up' || commentSent) && undoCountdown > 0 && (
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            onClick={handleUndo}
            style={{ fontFamily: FONT_FAMILY }}
          >
            Undo ({undoCountdown}s)
          </Button>
        )}
        {(submitted === 'up' || commentSent) && undoCountdown === 0 && (
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Thanks for your feedback!
          </Text>
        )}
      </Group>

      {showExplanation && (
        <Box mt={8}>
          <Textarea
            placeholder="What were you expecting? (optional)"
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
            size="xs"
            styles={{
              input: {
                fontFamily: FONT_FAMILY,
                fontSize: '12px',
                background: isDark ? 'var(--mantine-color-dark-6)' : '#fff',
              },
            }}
          />
          <Group gap={6} mt={6}>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              component="label"
              style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
            >
              {screenshotPreview ? 'Change screenshot' : 'Attach screenshot'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleScreenshotUpload}
              />
            </Button>
            {screenshotPreview && (
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                style={{ height: 32, borderRadius: 4, border: '1px solid var(--mantine-color-gray-4)' }}
              />
            )}
          </Group>
          <Group justify="flex-end" gap={6} mt={6}>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              onClick={handleSkipExplanation}
              style={{ fontFamily: FONT_FAMILY }}
            >
              Skip
            </Button>
            <Button
              variant="filled"
              color={AQUA}
              size="compact-xs"
              onClick={handleSubmitExplanation}
              style={{ fontFamily: FONT_FAMILY }}
            >
              Submit
            </Button>
          </Group>
        </Box>
      )}
    </Box>
  );
}

// ── Debug Trace Panel ──
export function DebugTracePanel({
  result,
  isDark,
}: {
  result: NlpQueryResponse;
  isDark: boolean;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const confPct = Math.round(result.confidence * 100);

  return (
    <Box
      px="md"
      py={6}
      style={{
        borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-yellow-2)'}`,
        background: isDark ? 'rgba(255,200,0,0.04)' : 'rgba(255,250,220,0.6)',
      }}
    >
      <Group
        gap={6}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setDebugOpen(o => !o)}
      >
        <ThemeIcon size={18} color="yellow" variant="light" radius="sm">
          <IconBug size={11} />
        </ThemeIcon>
        <Text size="xs" fw={600} c="yellow.7" style={{ fontFamily: FONT_FAMILY }}>
          Debug Trace
        </Text>
        <Badge size="xs" color="yellow" variant="light" style={{ fontFamily: FONT_FAMILY }}>
          {String(result.debug?.resolvedBy ?? result.resolvedBy)}
        </Badge>
        <Badge size="xs" color={result.confidence >= 0.9 ? 'green' : 'orange'} variant="light" style={{ fontFamily: FONT_FAMILY }}>
          {confPct}% conf
        </Badge>
        {result.debug?.totalLatencyMs != null && (
          <Badge size="xs" color="gray" variant="light" style={{ fontFamily: FONT_FAMILY }}>
            {String(result.debug.totalLatencyMs)}ms
          </Badge>
        )}
        <IconChevronDown
          size={12}
          style={{
            marginLeft: 'auto',
            transform: debugOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
            color: 'var(--mantine-color-yellow-6)',
          }}
        />
      </Group>
      <Collapse in={debugOpen}>
        <Box mt={6} style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {Array.isArray(result.debug?.tierTrace) && (result.debug.tierTrace as Array<Record<string, unknown>>).map((tier, i) => (
            <Group key={i} gap={6} py={2} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexWrap: 'wrap' }}>
              <Badge size="xs" color={tier.resolved ? 'green' : tier.skipped ? 'gray' : 'orange'} variant="filled" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                {String(tier.tier)}
              </Badge>
              {!tier.skipped && (
                <>
                  <Text size="xs" c="dimmed">intent: <b>{String(tier.intent ?? '—')}</b></Text>
                  <Text size="xs" c="dimmed">conf: <b>{typeof tier.confidence === 'number' ? Math.round(tier.confidence * 100) + '%' : '—'}</b></Text>
                  <Text size="xs" c="dimmed">latency: <b>{String(tier.latencyMs ?? '—')}ms</b></Text>
                </>
              )}
              {Boolean(tier.skipped) && <Text size="xs" c="dimmed">skipped — {String(tier.reason ?? '')}</Text>}
            </Group>
          ))}
          {result.debug?.thresholdUsed != null && (
            <Text size="xs" c="dimmed" mt={4}>threshold: {String(result.debug.thresholdUsed)} | shape: {result.response.shape ?? '—'} | intent: {result.intent}</Text>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
