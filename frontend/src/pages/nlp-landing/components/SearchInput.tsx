import React, { RefObject } from 'react';
import {
  Paper, Group, ActionIcon, Autocomplete, Loader, Kbd,
} from '@mantine/core';
import { IconSearch, IconMicrophone, IconX, IconArrowRight } from '@tabler/icons-react';
import { rem } from '@mantine/core';
import { AQUA, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../../brandTokens';

export function SearchInput({
  inputRef,
  query,
  setQuery,
  isDark,
  inputFocused,
  setInputFocused,
  isLoading,
  isListening,
  mergedAutocompleteData,
  showResult,
  onKeyDown,
  onOptionSubmit,
  onStartVoice,
  onSubmit,
}: {
  inputRef: RefObject<HTMLInputElement>;
  query: string;
  setQuery: (val: string) => void;
  isDark: boolean;
  inputFocused: boolean;
  setInputFocused: (val: boolean) => void;
  isLoading: boolean;
  isListening: boolean;
  mergedAutocompleteData: string[];
  showResult: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onOptionSubmit: (val: string) => void;
  onStartVoice: () => void;
  onSubmit: () => void;
}) {
  return (
    <Paper
      radius="xl"
      p={4}
      mb={16}
      className="nlp-search-container"
      style={{
        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : inputFocused ? `${AQUA}50` : 'rgba(0,0,0,0.10)'}`,
        boxShadow: inputFocused
          ? `0 0 0 3px ${AQUA}20, 0 4px 16px rgba(45,204,211,0.08)`
          : isDark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      }}
    >
      <Autocomplete
        ref={inputRef}
        placeholder="Ask me anything about your portfolio…"
        size="lg"
        radius="lg"
        value={query}
        onChange={(val) => { setQuery(val); }}
        onKeyDown={onKeyDown}
        onOptionSubmit={onOptionSubmit}
        data={mergedAutocompleteData}
        maxDropdownHeight={280}
        limit={8}
        dropdownOpened={inputFocused && query.trim().length >= 2 && !showResult}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setTimeout(() => setInputFocused(false), 200)}
        leftSection={
          isLoading
            ? <Loader size={18} color={AQUA} className="nlp-typing-indicator" />
            : <IconSearch size={18} style={{ opacity: 0.5 }} />
        }
        rightSection={
          <Group gap={4} wrap="nowrap" pr={4}>
            {!query.trim() && (
              <ActionIcon
                variant={isListening ? 'filled' : 'subtle'}
                radius="xl"
                size="sm"
                onClick={onStartVoice}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
                style={{
                  color: isListening ? '#fff' : DEEP_BLUE_TINTS[40],
                  backgroundColor: isListening ? AQUA : undefined,
                  animation: isListening ? 'nlp-pulse 1.2s ease-in-out infinite' : undefined,
                }}
              >
                <IconMicrophone size={15} />
              </ActionIcon>
            )}
            {query.trim() && (
              <ActionIcon
                variant="subtle"
                radius="xl"
                size="sm"
                onClick={() => { setQuery(''); }}
                aria-label="Clear search"
                style={{ color: DEEP_BLUE_TINTS[40] }}
              >
                <IconX size={16} />
              </ActionIcon>
            )}
            {query.trim() ? (
              <ActionIcon
                variant="filled"
                radius="xl"
                size="lg"
                onClick={onSubmit}
                loading={isLoading}
                style={{ backgroundColor: AQUA, transition: 'all 150ms ease' }}
                aria-label="Go forward"
              >
                <IconArrowRight size={18} />
              </ActionIcon>
            ) : (
              <Kbd size="sm" style={{ opacity: 0.4 }}>↵</Kbd>
            )}
          </Group>
        }
        rightSectionWidth={96}
        styles={{
          input: {
            border: 'none',
            fontSize: rem(16),
            fontFamily: FONT_FAMILY,
          },
        }}
      />
    </Paper>
  );
}
