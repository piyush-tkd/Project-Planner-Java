import { useState, useMemo, useEffect } from 'react';

interface UsePaginationResult<T> {
  /** Slice of data for the current page */
  paginatedData: T[];
  /** Current page number (1-based) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items (after filtering, before pagination) */
  totalItems: number;
  /** 0-based start index */
  startIndex: number;
  /** 0-based end index (exclusive) */
  endIndex: number;
  /** Change current page */
  onPageChange: (page: number) => void;
  /** Change items per page (resets to page 1) */
  onPageSizeChange: (size: number) => void;
}

export function usePagination<T>(data: T[], defaultPageSize = 25): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 when data length changes (e.g. filter applied)
  useEffect(() => {
    setPage(1);
  }, [totalItems]);

  // Clamp page if it exceeds total pages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  );

  const onPageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const onPageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return {
    paginatedData,
    page,
    totalPages,
    pageSize,
    totalItems,
    startIndex,
    endIndex,
    onPageChange,
    onPageSizeChange,
  };
}
