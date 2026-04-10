import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ActionIcon, Tooltip, Modal, Stack, Textarea, Select, Group, Button,
  Text, Paper, Badge, CloseButton, Box, Image,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconMessageReport, IconSend, IconPhoto, IconTrash, IconCheck, IconUpload,
  IconStar, IconStarFilled,
} from '@tabler/icons-react';
import { useSubmitFeedback } from '../../api/feedback';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA, DEEP_BLUE, FONT_FAMILY, GRAY_300, GRAY_BORDER} from '../../brandTokens';

const CATEGORIES = [
  { value: 'BUG',         label: 'Bug Report' },
  { value: 'SUGGESTION',  label: 'Suggestion' },
  { value: 'IMPROVEMENT', label: 'Improvement' },
  { value: 'OTHER',       label: 'Other' },
];

const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024; // 2 MB

const STAR_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div>
      <Text size="sm" fw={500} mb={4} style={{ fontFamily: FONT_FAMILY }}>
        Rating
      </Text>
      <Group gap={4}>
        {[1, 2, 3, 4, 5].map((star) => (
          <ActionIcon
            key={star}
            variant="transparent"
            size={32}
            onClick={() => onChange(star === value ? 0 : star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{ color: star <= display ? '#F5A623' : '#CED4DA', transition: 'color 0.15s ease, transform 0.15s ease', transform: star <= display ? 'scale(1.15)' : 'scale(1)' }}
          >
            {star <= display ? <IconStarFilled size={22} /> : <IconStar size={22} />}
          </ActionIcon>
        ))}
        {display > 0 && (
          <Text size="xs" c="dimmed" ml={4} style={{ fontFamily: FONT_FAMILY }}>
            {STAR_LABELS[display - 1]}
          </Text>
        )}
      </Group>
    </div>
  );
}

export default function FeedbackWidget() {
  const isDark = useDarkMode();
  const [opened, setOpened] = useState(false);
  const [category, setCategory] = useState<string>('BUG');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const submitFeedback = useSubmitFeedback();

  const resetForm = useCallback(() => {
    setCategory('BUG');
    setRating(0);
    setMessage('');
    setScreenshot(null);
    setScreenshotName(null);
    setDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpened(false);
    resetForm();
  }, [resetForm]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      notifications.show({ title: 'Invalid file', message: 'Please upload an image file (PNG, JPG, GIF)', color: 'red' });
      return;
    }
    if (file.size > MAX_SCREENSHOT_SIZE) {
      notifications.show({ title: 'File too large', message: 'Screenshot must be under 2 MB', color: 'red' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshot(reader.result as string);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFile]);

  const handleSubmit = () => {
    if (!message.trim()) {
      notifications.show({ title: 'Required', message: 'Please enter your feedback message', color: 'orange' });
      return;
    }
    submitFeedback.mutate(
      {
        category,
        message: message.trim(),
        pageUrl: location.pathname,
        screenshot: screenshot ?? undefined,
        rating: rating > 0 ? rating : undefined,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Thank you!',
            message: 'Your feedback has been submitted successfully.',
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
          handleClose();
        },
        onError: (err) => {
          notifications.show({ title: 'Failed', message: err.message, color: 'red' });
        },
      },
    );
  };

  return (
    <>
      {/* ── Floating Action Button ── */}
      <Tooltip label="Send Feedback" position="left" withArrow>
        <ActionIcon
          size={48}
          radius="xl"
          onClick={() => setOpened(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            backgroundColor: isDark ? DEEP_BLUE : AQUA,
            color: isDark ? '#ffffff' : '#ffffff',
            boxShadow: isDark
              ? '0 4px 14px rgba(12, 35, 64, 0.5)'
              : '0 4px 14px rgba(31, 168, 174, 0.45)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = isDark
              ? '0 6px 20px rgba(12, 35, 64, 0.6)'
              : '0 6px 20px rgba(31, 168, 174, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = isDark
              ? '0 4px 14px rgba(12, 35, 64, 0.5)'
              : '0 4px 14px rgba(31, 168, 174, 0.45)';
          }}
        >
          <IconMessageReport size={22} color="#ffffff" />
        </ActionIcon>
      </Tooltip>

      {/* ── Feedback Modal ── */}
      <Modal
        opened={opened}
        onClose={handleClose}
        title={
          <Group gap={8}>
            <IconMessageReport size={20} color={DEEP_BLUE} />
            <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
              Send Feedback
            </Text>
          </Group>
        }
        size="md"
        centered
        styles={{ title: { fontFamily: FONT_FAMILY } }}
      >
        <Stack gap="md">
          {/* Page context badge */}
          <Badge size="sm" variant="light" color="gray" style={{ fontFamily: FONT_FAMILY, alignSelf: 'flex-start' }}>
            Page: {location.pathname}
          </Badge>

          <Select
            label="Category"
            data={CATEGORIES}
            value={category}
            onChange={(v) => setCategory(v ?? 'BUG')}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />

          <StarRating value={rating} onChange={setRating} />

          <Textarea
            label="Your Feedback"
            placeholder="Describe the issue, suggestion, or improvement you'd like to see..."
            minRows={4}
            maxRows={8}
            autosize
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />

          {/* ── Screenshot Upload / Drag & Drop ── */}
          <div>
            <Text size="sm" fw={500} mb={4} style={{ fontFamily: FONT_FAMILY }}>
              Screenshot (optional)
            </Text>

            {screenshot ? (
              <Paper withBorder radius="md" p="xs" pos="relative">
                <CloseButton
                  size="xs"
                  style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}
                  onClick={() => { setScreenshot(null); setScreenshotName(null); }}
                />
                <Image
                  src={screenshot}
                  alt="Feedback screenshot"
                  radius="sm"
                  fit="contain"
                  h={180}
                />
                {screenshotName && (
                  <Text size="xs" c="dimmed" mt={4} ta="center" style={{ fontFamily: FONT_FAMILY }}>
                    {screenshotName}
                  </Text>
                )}
              </Paper>
            ) : (
              <Paper
                withBorder
                radius="md"
                p="lg"
                ta="center"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  cursor: 'pointer',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: dragOver ? AQUA : GRAY_BORDER,
                  backgroundColor: dragOver ? 'rgba(45, 204, 211, 0.05)' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                <Box mb={6}>
                  <IconUpload size={28} color={dragOver ? AQUA : GRAY_300} />
                </Box>
                <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                  Drag & drop an image here, or click to browse
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  PNG, JPG, GIF — max 2 MB
                </Text>
              </Paper>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>

          {/* ── Submit ── */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose} style={{ fontFamily: FONT_FAMILY }}>
              Cancel
            </Button>
            <Button
              leftSection={<IconSend size={16} />}
              onClick={handleSubmit}
              loading={submitFeedback.isPending}
              style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}
            >
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
