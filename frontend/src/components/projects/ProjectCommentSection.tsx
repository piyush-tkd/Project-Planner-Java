/**
 * ProjectCommentSection
 *
 * Threaded discussion panel for a project.
 * Supports: top-level comments, inline replies, edit, delete.
 */
import { useState } from 'react';
import {
  Stack, Group, Text, Avatar, Textarea, Button, ActionIcon, Tooltip,
  Box, Divider, Badge, Paper, Loader, Center, Collapse,
} from '@mantine/core';
import {
  IconMessageCircle, IconEdit, IconTrash, IconCornerDownRight,
  IconCheck, IconX, IconDots,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../auth/AuthContext';
import {
  useProjectComments,
  useAddComment,
  useEditComment,
  useDeleteComment,
  type ProjectComment,
} from '../../api/projectComments';
import { FONT_FAMILY, AQUA, DEEP_BLUE } from '../../brandTokens';

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

// ── Single comment row ─────────────────────────────────────────────────────

interface CommentRowProps {
  comment:   ProjectComment;
  projectId: number | string;
  isReply?:  boolean;
}

function CommentRow({ comment, projectId, isReply = false }: CommentRowProps) {
  const { username } = useAuth();
  const [editing,    setEditing]    = useState(false);
  const [editBody,   setEditBody]   = useState(comment.body);
  const [replying,   setReplying]   = useState(false);
  const [replyBody,  setReplyBody]  = useState('');
  const [showReplies, setShowReplies] = useState(true);

  const editMut   = useEditComment(projectId);
  const deleteMut = useDeleteComment(projectId);
  const addMut    = useAddComment(projectId);

  const isOwn = username === comment.author;

  async function handleEdit() {
    if (!editBody.trim()) return;
    await editMut.mutateAsync({ id: comment.id, body: editBody.trim() });
    setEditing(false);
  }

  async function handleDelete() {
    await deleteMut.mutateAsync(comment.id);
    notifications.show({ message: 'Comment deleted', color: 'gray' });
  }

  async function handleReply() {
    if (!replyBody.trim()) return;
    await addMut.mutateAsync({ body: replyBody.trim(), parentId: comment.id });
    setReplyBody('');
    setReplying(false);
    setShowReplies(true);
  }

  const replyCount = comment.replies?.length ?? 0;

  return (
    <Box ml={isReply ? 32 : 0}>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        {/* Avatar */}
        <Avatar
          size={isReply ? 28 : 34}
          radius="xl"
          style={{
            backgroundColor: DEEP_BLUE,
            color: '#fff',
            fontWeight: 600,
            fontSize: isReply ? 11 : 13,
            flexShrink: 0,
          }}
        >
          {initials(comment.author)}
        </Avatar>

        {/* Content */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <Group gap={8} mb={4} wrap="nowrap">
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
              {comment.author}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              {relativeTime(comment.createdAt)}
            </Text>
            {comment.edited && (
              <Badge size="xs" color="gray" variant="outline" style={{ fontFamily: FONT_FAMILY }}>
                edited
              </Badge>
            )}
            {/* Own comment actions */}
            {isOwn && !editing && (
              <Group gap={2} ml="auto" style={{ flexShrink: 0 }}>
                <Tooltip label="Edit" withArrow>
                  <ActionIcon
                    size="xs" variant="subtle" color="gray"
                    onClick={() => { setEditing(true); setEditBody(comment.body); }}
                    aria-label="Edit"
                  >
                    <IconEdit size={12} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete" withArrow>
                  <ActionIcon
                    size="xs" variant="subtle" color="red"
                    loading={deleteMut.isPending}
                    onClick={handleDelete}
                    aria-label="Delete"
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>

          {/* Body or edit form */}
          {editing ? (
            <Box>
              <Textarea
                value={editBody}
                onChange={e => setEditBody(e.currentTarget.value)}
                autosize
                minRows={2}
                mb={6}
                styles={{ input: { fontFamily: FONT_FAMILY, fontSize: 13 } }}
              />
              <Group gap={6}>
                <Button
                  size="xs" color="teal" leftSection={<IconCheck size={12} />}
                  loading={editMut.isPending}
                  onClick={handleEdit}
                >
                  Save
                </Button>
                <Button
                  size="xs" variant="subtle" color="gray" leftSection={<IconX size={12} />}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </Group>
            </Box>
          ) : (
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {comment.body}
            </Text>
          )}

          {/* Reply / show-replies controls (top-level only) */}
          {!isReply && !editing && (
            <Group gap={8} mt={6}>
              <Button
                size="xs" variant="subtle" color="gray"
                leftSection={<IconCornerDownRight size={12} />}
                onClick={() => setReplying(r => !r)}
                style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}
              >
                Reply
              </Button>
              {replyCount > 0 && (
                <Button
                  size="xs" variant="subtle" color="gray"
                  leftSection={<IconDots size={12} />}
                  onClick={() => setShowReplies(s => !s)}
                  style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}
                >
                  {showReplies ? 'Hide' : `Show ${replyCount}`} {replyCount === 1 ? 'reply' : 'replies'}
                </Button>
              )}
            </Group>
          )}

          {/* Reply input */}
          <Collapse in={replying}>
            <Box mt={8} ml={4}>
              <Textarea
                placeholder="Write a reply…"
                value={replyBody}
                onChange={e => setReplyBody(e.currentTarget.value)}
                autosize
                minRows={2}
                mb={6}
                styles={{ input: { fontFamily: FONT_FAMILY, fontSize: 13 } }}
              />
              <Group gap={6}>
                <Button
                  size="xs" color="teal"
                  loading={addMut.isPending}
                  onClick={handleReply}
                  disabled={!replyBody.trim()}
                >
                  Post Reply
                </Button>
                <Button
                  size="xs" variant="subtle" color="gray"
                  onClick={() => { setReplying(false); setReplyBody(''); }}
                >
                  Cancel
                </Button>
              </Group>
            </Box>
          </Collapse>

          {/* Nested replies */}
          {!isReply && replyCount > 0 && (
            <Collapse in={showReplies}>
              <Stack gap="sm" mt={10}>
                {(comment.replies ?? []).map(reply => (
                  <CommentRow key={reply.id} comment={reply} projectId={projectId} isReply />
                ))}
              </Stack>
            </Collapse>
          )}
        </Box>
      </Group>
    </Box>
  );
}

// ── Main section ───────────────────────────────────────────────────────────

interface Props {
  projectId: number | string;
}

export default function ProjectCommentSection({ projectId }: Props) {
  const { data: comments = [], isLoading } = useProjectComments(projectId);
  const addMut = useAddComment(projectId);
  const [newBody, setNewBody] = useState('');

  async function handlePost() {
    if (!newBody.trim()) return;
    await addMut.mutateAsync({ body: newBody.trim() });
    setNewBody('');
  }

  return (
    <Box>
      {/* Header */}
      <Group gap="sm" mb="md">
        <IconMessageCircle size={18} color={AQUA} />
        <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
          Discussion
        </Text>
        {comments.length > 0 && (
          <Badge size="sm" color="teal" variant="light" style={{ fontFamily: FONT_FAMILY }}>
            {comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0)}
          </Badge>
        )}
      </Group>

      {/* New comment box */}
      <Paper withBorder p="sm" radius="md" mb="lg">
        <Textarea
          placeholder="Add a comment… use @username to mention someone"
          value={newBody}
          onChange={e => setNewBody(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={8}
          mb="sm"
          styles={{ input: { fontFamily: FONT_FAMILY, fontSize: 13 } }}
        />
        <Group justify="flex-end">
          <Button
            size="sm"
            color="teal"
            loading={addMut.isPending}
            disabled={!newBody.trim()}
            onClick={handlePost}
            style={{ fontFamily: FONT_FAMILY }}
          >
            Post Comment
          </Button>
        </Group>
      </Paper>

      {/* Comment list */}
      {isLoading ? (
        <Center h={120}><Loader size="sm" color={AQUA} /></Center>
      ) : comments.length === 0 ? (
        <Box py="xl" ta="center">
          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
            No comments yet. Start the discussion!
          </Text>
        </Box>
      ) : (
        <Stack gap="md">
          {comments.map((c, i) => (
            <Box key={c.id}>
              <CommentRow comment={c} projectId={projectId} />
              {i < comments.length - 1 && (
                <Divider mt="md" style={{ borderColor: 'rgba(45,204,211,0.12)' }} />
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
