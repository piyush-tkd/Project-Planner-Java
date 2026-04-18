import { Table, UnstyledButton } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { COLOR_BLUE_DARK, GRAY_300 } from '../../brandTokens';

interface SortableHeaderProps {
  sortKey: string;
  currentKey: string | null;
  dir: 'asc' | 'desc' | null;
  onSort: (key: string) => void;
  children: ReactNode;
  style?: React.CSSProperties;
}

export default function SortableHeader({ sortKey, currentKey, dir, onSort, children, style }: SortableHeaderProps) {
  const active = currentKey === sortKey;
  const Icon = active ? (dir === 'asc' ? IconChevronUp : IconChevronDown) : IconSelector;

  return (
    <Table.Th style={{ ...style, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(sortKey)}>
      <UnstyledButton style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold', fontSize: 'inherit' }}>
        {children}
        <Icon size={14} color={active ? COLOR_BLUE_DARK : GRAY_300} />
      </UnstyledButton>
    </Table.Th>
  );
}
