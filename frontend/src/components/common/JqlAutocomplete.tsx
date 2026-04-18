/**
 * JqlAutocomplete — a JQL-aware textarea with context-sensitive autocomplete.
 *
 * Suggests:
 *  • Field names at the start of a clause (after AND / OR / NOT, or at start)
 *  • Operators after a completed field name
 *  • Values after a completed operator (fetched from the backend)
 *  • Logical connectors (AND / OR / ORDER BY) after a completed clause
 *
 * Usage:
 *   <JqlAutocomplete
 *     value={jql}
 *     onChange={setJql}
 *     pods="1,2,3"
 *     fields={analyticsFields}   // JiraAnalyticsField[]
 *   />
 */

import {
  useRef, useState, useCallback, useEffect, KeyboardEvent, useId,
} from 'react';
import {
  Box, Text, Paper, ScrollArea, Badge,
  Loader, Textarea,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { JiraAnalyticsField } from '../../api/jira';
import { AQUA, FONT_FAMILY, BORDER_STRONG } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import apiClient from '../../api/client';

/* ──────────────────────────────────────────────────────────────────────────── */
/* Constants                                                                    */
/* ──────────────────────────────────────────────────────────────────────────── */

/** Standard JQL fields always available, even without backend fields. */
const STANDARD_JQL_FIELDS: { id: string; name: string; category: 'standard' }[] = [
  { id: 'issuetype',     name: 'Issue Type',       category: 'standard' },
  { id: 'status',        name: 'Status',            category: 'standard' },
  { id: 'priority',      name: 'Priority',          category: 'standard' },
  { id: 'assignee',      name: 'Assignee',          category: 'standard' },
  { id: 'reporter',      name: 'Reporter',          category: 'standard' },
  { id: 'project',       name: 'Project',           category: 'standard' },
  { id: 'labels',        name: 'Labels',            category: 'standard' },
  { id: 'fixVersion',    name: 'Fix Version',       category: 'standard' },
  { id: 'component',     name: 'Component',         category: 'standard' },
  { id: 'sprint',        name: 'Sprint',            category: 'standard' },
  { id: 'epic',          name: 'Epic',              category: 'standard' },
  { id: 'resolution',    name: 'Resolution',        category: 'standard' },
  { id: 'created',       name: 'Created',           category: 'standard' },
  { id: 'updated',       name: 'Updated',           category: 'standard' },
  { id: 'resolved',      name: 'Resolved Date',     category: 'standard' },
  { id: 'storyPoints',   name: 'Story Points',      category: 'standard' },
  { id: 'summary',       name: 'Summary',           category: 'standard' },
];

/** JQL operators with friendly labels. */
const JQL_OPERATORS = [
  { op: '=',        label: '= equals',                      hint: 'Exact match' },
  { op: '!=',       label: '!= not equals',                 hint: 'Exclude exact match' },
  { op: 'in',       label: 'in  (a, b, c)',                 hint: 'One of multiple values' },
  { op: 'not in',   label: 'not in  (a, b, c)',             hint: 'None of these values' },
  { op: '~',        label: '~ contains',                    hint: 'Text search (contains)' },
  { op: '!~',       label: '!~ does not contain',           hint: 'Text search (excludes)' },
  { op: '>',        label: '> greater than',                hint: 'Numeric or date greater' },
  { op: '>=',       label: '>= greater than or equal',      hint: 'Numeric or date' },
  { op: '<',        label: '< less than',                   hint: 'Numeric or date' },
  { op: '<=',       label: '<= less than or equal',         hint: 'Numeric or date' },
  { op: 'is EMPTY', label: 'is EMPTY',                      hint: 'Field has no value' },
  { op: 'is not EMPTY', label: 'is not EMPTY',              hint: 'Field has a value' },
];


const CONNECTOR_KEYWORDS = ['AND', 'OR', 'ORDER BY'];

/* ──────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ──────────────────────────────────────────────────────────────────────────── */

type SuggestionKind = 'field' | 'operator' | 'value' | 'keyword';

interface Suggestion {
  kind: SuggestionKind;
  label: string;
  insertText: string;
  hint?: string;
  category?: string;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* JQL parser helpers                                                           */
/* ──────────────────────────────────────────────────────────────────────────── */

const CONNECTORS_RE = /\b(AND|OR|NOT|ORDER\s+BY)\b/gi;

/**
 * Analyse the text up to the cursor position and return context.
 * Returns: { kind, currentWord, fieldForValues }
 */
function analyseContext(text: string, cursorPos: number): {
  kind: SuggestionKind;
  currentWord: string;
  fieldForValues: string | null;
} {
  const before = text.slice(0, cursorPos);

  // Find the start of the current "token" (word being typed)
  // @ts-expect-error -- unused
  const lastSpaceIdx = before.search(/\S\s+\S*$/);
  const afterLastSpace = before.slice(before.lastIndexOf(' ') + 1);
  const currentWord = afterLastSpace;

  // Split the text before the cursor by connectors to get the current clause
  const clauses = before.split(CONNECTORS_RE).filter(Boolean);
  const lastClause = (clauses[clauses.length - 1] ?? '').trim();

  // Check if we're right after a connector (or at start)
  const trimmedBefore = before.trimEnd();
  const endsWithConnector = /\b(AND|OR|NOT|ORDER\s+BY)\s*$/i.test(trimmedBefore);

  if (before.trim() === '' || endsWithConnector) {
    return { kind: 'field', currentWord, fieldForValues: null };
  }

  // Tokenise the current clause (simple split, ignoring quoted strings for now)
  const tokens = lastClause.split(/\s+/).filter(Boolean);

  // If in (…) expression, we're providing values
  const inParens = /\bin\s*\(/i.test(lastClause);

  if (tokens.length === 0) {
    return { kind: 'field', currentWord, fieldForValues: null };
  }

  // 1 token — the field name being typed / just typed
  if (tokens.length === 1) {
    // If the token looks complete (not being edited), suggest operator; otherwise field
    const isEditing = lastClause === currentWord;
    return { kind: isEditing ? 'field' : 'operator', currentWord, fieldForValues: null };
  }

  const fieldToken = tokens[0];

  // 2 tokens — field + operator being typed
  if (tokens.length === 2 && !inParens) {
    return { kind: 'operator', currentWord, fieldForValues: fieldToken };
  }

  // 3+ tokens — after operator, providing values
  if (tokens.length >= 2) {
    // Check if we're after a connector at the end of the *before* text
    const lastTokenInBefore = before.trim().split(/\s+/).pop() ?? '';
    if (CONNECTOR_KEYWORDS.includes(lastTokenInBefore.toUpperCase())) {
      return { kind: 'field', currentWord, fieldForValues: null };
    }
    // After a completed clause, suggest connectors
    const hasCompleteValue = tokens.length >= 3 ||
      (tokens.length === 2 && /=|!=|~|!~|is/i.test(tokens[1] ?? ''));
    if (hasCompleteValue && currentWord.trim() === '') {
      return { kind: 'keyword', currentWord: '', fieldForValues: null };
    }
    // Typing a value
    return { kind: 'value', currentWord, fieldForValues: fieldToken };
  }

  return { kind: 'keyword', currentWord, fieldForValues: null };
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Props                                                                        */
/* ──────────────────────────────────────────────────────────────────────────── */

interface JqlAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  pods?: string;
  fields?: JiraAnalyticsField[];
  placeholder?: string;
  label?: string;
  description?: string;
  minRows?: number;
  maxRows?: number;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ──────────────────────────────────────────────────────────────────────────── */

export function JqlAutocomplete({
  value,
  onChange,
  pods,
  fields = [],
  placeholder = 'e.g. priority in (High, Critical) AND status != Done',
  label = 'JQL Filter',
  description = 'Filter this widget\'s data using JQL syntax',
  minRows = 2,
  maxRows = 4,
}: JqlAutocompleteProps) {
  const isDark = useDarkMode();
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [context, setContext] = useState<{
    kind: SuggestionKind;
    currentWord: string;
    fieldForValues: string | null;
  }>({ kind: 'field', currentWord: '', fieldForValues: null });

  /* ── Fetch field values when context says 'value' ── */
  const shouldFetchValues = context.kind === 'value' && !!context.fieldForValues;
  const { data: fieldValues = [], isFetching: fetchingValues } = useQuery<string[]>({
    queryKey: ['power-query', 'values', context.fieldForValues, pods ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({ field: context.fieldForValues!, limit: '100' });
      if (pods) params.set('pods', pods);
      return apiClient.get(`/power-query/values?${params}`).then(r => r.data).catch(() => []);
    },
    enabled: shouldFetchValues,
    staleTime: 60_000 * 5,
  });

  /* ── Merge backend fields + standard fields ── */
  const allFields = [
    ...STANDARD_JQL_FIELDS,
    ...fields
      .filter(f => f.category === 'custom')
      .map(f => ({ id: f.id, name: f.name, category: 'custom' as const })),
  ];

  /* ── Build suggestion list ── */
  const suggestions: Suggestion[] = (() => {
    const word = (context.currentWord ?? '').toLowerCase();

    if (context.kind === 'field') {
      return allFields
        .filter(f => !word || f.id.toLowerCase().includes(word) || f.name.toLowerCase().includes(word))
        .slice(0, 12)
        .map(f => ({
          kind: 'field' as SuggestionKind,
          label: f.name,
          insertText: f.id,
          hint: f.id,
          category: f.category,
        }));
    }

    if (context.kind === 'operator') {
      return JQL_OPERATORS
        .filter(o => !word || o.label.toLowerCase().includes(word))
        .map(o => ({
          kind: 'operator' as SuggestionKind,
          label: o.label,
          insertText: o.op,
          hint: o.hint,
        }));
    }

    if (context.kind === 'value') {
      const raw = fieldValues.filter(v => !word || v.toLowerCase().includes(word));
      return raw.slice(0, 15).map(v => ({
        kind: 'value' as SuggestionKind,
        label: v,
        insertText: v.includes(' ') ? `"${v}"` : v,
      }));
    }

    if (context.kind === 'keyword') {
      return CONNECTOR_KEYWORDS
        .filter(k => !word || k.toLowerCase().startsWith(word.toLowerCase()))
        .map(k => ({
          kind: 'keyword' as SuggestionKind,
          label: k,
          insertText: k + ' ',
        }));
    }

    return [];
  })();

  /* ── Recalculate context on cursor move ── */
  const recalculate = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const ctx = analyseContext(el.value, pos);
    setContext(ctx);
    setActiveIdx(0);
  }, []);

  /* ── Handle input ── */
  const handleInput = useCallback((v: string) => {
    onChange(v);
    setOpen(true);
    requestAnimationFrame(recalculate);
  }, [onChange, recalculate]);

  /* ── Apply suggestion ── */
  const applySuggestion = useCallback((suggestion: Suggestion) => {
    const el = textareaRef.current;
    if (!el) return;

    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const after = el.value.slice(pos);

    // Remove the current partial word from before
    const lastSpaceOrParen = Math.max(
      before.lastIndexOf(' '),
      before.lastIndexOf('('),
      before.lastIndexOf(','),
    );
    const trimmedBefore = before.slice(0, lastSpaceOrParen + 1);

    let insertion = suggestion.insertText;

    // Smart spacing
    if (suggestion.kind === 'operator') {
      if (insertion === 'in' || insertion === 'not in') {
        insertion = ` ${insertion} (`;
      } else if (!insertion.startsWith('is')) {
        insertion = ` ${insertion} `;
      } else {
        insertion = ` ${insertion} `;
      }
      const newVal = (trimmedBefore.trimEnd()) + insertion + after;
      onChange(newVal);
      // Place cursor after inserted text
      requestAnimationFrame(() => {
        if (el) {
          const newPos = (trimmedBefore.trimEnd()).length + insertion.length;
          el.setSelectionRange(newPos, newPos);
          el.focus();
        }
      });
    } else if (suggestion.kind === 'value') {
      const newVal = trimmedBefore + insertion + after;
      onChange(newVal);
      requestAnimationFrame(() => {
        if (el) {
          const newPos = trimmedBefore.length + insertion.length;
          el.setSelectionRange(newPos, newPos);
          el.focus();
        }
      });
    } else {
      const separator = trimmedBefore.length > 0 && !trimmedBefore.endsWith(' ') ? ' ' : '';
      const newVal = trimmedBefore + separator + insertion + ' ' + after;
      onChange(newVal);
      requestAnimationFrame(() => {
        if (el) {
          const newPos = trimmedBefore.length + separator.length + insertion.length + 1;
          el.setSelectionRange(newPos, newPos);
          el.focus();
        }
      });
    }

    setOpen(false);
  }, [onChange]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (suggestions[activeIdx]) applySuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab') {
      if (suggestions[activeIdx]) {
        e.preventDefault();
        applySuggestion(suggestions[activeIdx]);
      }
    }
  }, [open, suggestions, activeIdx, applySuggestion]);

  /* ── Scroll active item into view ── */
  useEffect(() => {
    if (!dropdownRef.current) return;
    const active = dropdownRef.current.querySelector(`[data-active="true"]`) as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  /* ── Close on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target) && !textareaRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Kind badge colours ── */
  const kindColor: Record<SuggestionKind, string> = {
    field:    AQUA,
    operator: '#f59e0b',
    value:    '#8b5cf6',
    keyword:  '#10b981',
  };

  const kindLabel: Record<SuggestionKind, string> = {
    field:    'field',
    operator: 'op',
    value:    'value',
    keyword:  'kw',
  };

  const showDropdown = open && (suggestions.length > 0 || fetchingValues);

  return (
    <Box style={{ position: 'relative' }}>
      {/* ── Label + description ── */}
      {label && (
        <Text size="sm" fw={500} mb={2}>
          {label}
        </Text>
      )}
      {description && (
        <Text size="xs" c="dimmed" mb={4}>
          {description}
        </Text>
      )}

      {/* ── Textarea ── */}
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={e => handleInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { recalculate(); setOpen(true); }}
        onClick={recalculate}
        placeholder={placeholder}
        autosize
        minRows={minRows}
        maxRows={maxRows}
        styles={{
          input: {
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.6,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG}`,
            borderRadius: 6,
            transition: 'border-color 0.15s',
          },
        }}
      />

      {/* ── Dropdown ── */}
      {showDropdown && (
        <Paper
          ref={dropdownRef}
          shadow="md"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            marginTop: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : BORDER_STRONG}`,
            borderRadius: 8,
            overflow: 'hidden',
            background: isDark ? '#1e2635' : '#fff',
            boxShadow: `0 8px 24px rgba(0,0,0,0.15)`,
          }}
        >
          {/* Header */}
          <Box
            px={10}
            py={5}
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text size="xs" c="dimmed">
              {context.kind === 'field'    && '⬡ Field names'}
              {context.kind === 'operator' && '⚡ Operators'}
              {context.kind === 'value'    && `✦ Values for "${context.fieldForValues}"`}
              {context.kind === 'keyword'  && '⟋ Keywords'}
            </Text>
            <Text size="xs" c="dimmed" style={{ opacity: 0.6 }}>
              ↑↓ navigate · ↵ select · Esc close
            </Text>
          </Box>

          {/* Items */}
          <ScrollArea.Autosize mah={220}>
            {fetchingValues && context.kind === 'value' ? (
              <Box p="sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader size="xs" color={AQUA} />
                <Text size="xs" c="dimmed">Loading values…</Text>
              </Box>
            ) : suggestions.length === 0 ? (
              <Box p="sm">
                <Text size="xs" c="dimmed">No suggestions</Text>
              </Box>
            ) : (
              <Box>
                {suggestions.map((s, i) => (
                  <Box
                    key={`${s.kind}-${s.insertText}-${i}`}
                    data-active={i === activeIdx ? 'true' : 'false'}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    px={10}
                    py={6}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: i === activeIdx
                        ? (isDark ? 'rgba(45,204,211,0.12)' : 'rgba(45,204,211,0.08)')
                        : 'transparent',
                      borderLeft: i === activeIdx
                        ? `3px solid ${AQUA}`
                        : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Kind badge */}
                    <Badge
                      size="xs"
                      variant="dot"
                      color={kindColor[s.kind]}
                      style={{
                        minWidth: 42,
                        textTransform: 'uppercase',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: kindColor[s.kind],
                        borderColor: kindColor[s.kind],
                        flexShrink: 0,
                      }}
                    >
                      {kindLabel[s.kind]}
                    </Badge>

                    {/* Label */}
                    <Text
                      size="sm"
                      fw={i === activeIdx ? 600 : 400}
                      style={{
                        fontFamily: s.kind === 'operator' ? 'monospace' : FONT_FAMILY,
                        color: isDark ? (i === activeIdx ? '#e2e8f0' : '#a0aec0') : (i === activeIdx ? '#1a202c' : '#4a5568'),
                        flex: 1,
                        lineHeight: 1.4,
                      }}
                    >
                      {s.label}
                    </Text>

                    {/* Hint (grey secondary) */}
                    {s.hint && (
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{
                          opacity: 0.6,
                          flexShrink: 0,
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.hint}
                      </Text>
                    )}

                    {/* Custom field tag */}
                    {s.category === 'custom' && (
                      <Badge size="xs" color="violet" variant="light" style={{ flexShrink: 0 }}>
                        custom
                      </Badge>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </ScrollArea.Autosize>

          {/* Footer shortcut hint */}
          {suggestions.length > 0 && (
            <Box
              px={10}
              py={4}
              style={{
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                display: 'flex',
                gap: 12,
              }}
            >
              {[['↵ / Tab', 'insert'], ['Esc', 'close'], ['Space', 'continue typing']].map(([key, desc]) => (
                <Text key={key} size="xs" c="dimmed" style={{ opacity: 0.55 }}>
                  <span style={{ fontFamily: 'monospace', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', borderRadius: 3, padding: '0 4px', marginRight: 3 }}>{key}</span>
                  {desc}
                </Text>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default JqlAutocomplete;
