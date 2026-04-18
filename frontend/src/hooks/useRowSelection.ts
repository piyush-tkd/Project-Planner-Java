import { useState, useCallback, useMemo } from 'react';

interface RowSelectionResult {
  selectedIds: Set<number>;
  toggle: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
  selectedCount: number;
}

/**
 * Hook to manage row selection state in tables
 * @param data Array of data items with id field
 * @returns Selection state and control functions
 */
export function useRowSelection<T extends { id: number }>(
  _data: T[],
): RowSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount,
  };
}
