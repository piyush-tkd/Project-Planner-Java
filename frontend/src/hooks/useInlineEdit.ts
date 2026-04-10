/**
 * useInlineEdit — Hook for managing inline table cell editing state
 *
 * Tracks which cell is currently being edited and provides utilities to start/stop editing.
 * Automatically cancels editing when Escape is pressed.
 *
 * Usage:
 *   const { editingCell, startEdit, stopEdit, isEditing } = useInlineEdit();
 *   <InlineTextCell
 *     value={item.name}
 *     isEditing={isEditing(item.id, 'name')}
 *     onEdit={() => startEdit(item.id, 'name')}
 *     onSave={() => stopEdit()}
 *   />
 */
import { useState, useEffect } from 'react';

export interface EditingCell {
  id: string | number;
  field: string;
}

export interface UseInlineEditReturn {
  editingCell: EditingCell | null;
  startEdit: (id: string | number, field: string) => void;
  stopEdit: () => void;
  isEditing: (id: string | number, field: string) => boolean;
}

export function useInlineEdit(): UseInlineEditReturn {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // Handle Escape key to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingCell) {
        e.preventDefault();
        setEditingCell(null);
      }
    };

    if (editingCell) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingCell]);

  const startEdit = (id: string | number, field: string) => {
    setEditingCell({ id, field });
  };

  const stopEdit = () => {
    setEditingCell(null);
  };

  const isEditing = (id: string | number, field: string) => {
    return editingCell?.id === id && editingCell?.field === field;
  };

  return { editingCell, startEdit, stopEdit, isEditing };
}

export default useInlineEdit;
