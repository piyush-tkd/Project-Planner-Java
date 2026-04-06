/**
 * ExportReportButton — a drop-down button placed in report page headers that
 * offers:
 *   • Print / Save as PDF  (uses browser print dialog)
 *   • Download CSV         (optional — only shown when csvRows + csvColumns provided)
 *
 * Usage — basic (print only):
 *   <ExportReportButton title="Portfolio Health" />
 *
 * Usage — with CSV:
 *   <ExportReportButton
 *     title="Resource Allocation"
 *     csvRows={rows}
 *     csvColumns={[
 *       { header: 'Name',  accessor: r => r.name },
 *       { header: 'Hours', accessor: r => r.hours },
 *     ]}
 *   />
 */
import { Menu, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconDownload, IconPrinter, IconFileTypeCsv, IconChevronDown } from '@tabler/icons-react';
import { useReportExport } from '../../hooks/useReportExport';

interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

interface ExportReportButtonProps<T = unknown> {
  /** Used as the print title and the CSV file name slug */
  title: string;
  /** Compact icon-only button (default: false) */
  compact?: boolean;
  /** Rows to export as CSV. If omitted, CSV option is hidden. */
  csvRows?: T[];
  /** Column definitions for the CSV. Required when csvRows is provided. */
  csvColumns?: CsvColumn<T>[];
  /** Override CSV file name (default: derived from title) */
  csvFileName?: string;
}

export function ExportReportButton<T = unknown>({
  title,
  compact = false,
  csvRows,
  csvColumns,
  csvFileName,
}: ExportReportButtonProps<T>) {
  const { printPdf, exportCsv } = useReportExport({ title });

  const hasCsv = Boolean(csvRows && csvColumns && csvRows.length > 0);

  // If no CSV option → single-action button (no dropdown needed)
  if (!hasCsv) {
    if (compact) {
      return (
        <Tooltip label="Print / Save as PDF" position="bottom">
          <ActionIcon variant="default" size="lg" onClick={printPdf} className="no-print">
            <IconPrinter size={16} />
          </ActionIcon>
        </Tooltip>
      );
    }
    return (
      <Button
        leftSection={<IconPrinter size={15} />}
        variant="default"
        size="xs"
        onClick={printPdf}
        className="no-print"
      >
        Print / PDF
      </Button>
    );
  }

  // With CSV → dropdown menu
  const triggerLabel = compact ? undefined : 'Export';
  const trigger = compact ? (
    <Tooltip label="Export" position="bottom">
      <ActionIcon variant="default" size="lg" className="no-print">
        <IconDownload size={16} />
      </ActionIcon>
    </Tooltip>
  ) : (
    <Button
      leftSection={<IconDownload size={15} />}
      rightSection={<IconChevronDown size={13} />}
      variant="default"
      size="xs"
      className="no-print"
    >
      {triggerLabel}
    </Button>
  );

  return (
    <Menu shadow="md" width={180} position="bottom-end">
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Export options</Menu.Label>
        <Menu.Item
          leftSection={<IconPrinter size={14} />}
          onClick={printPdf}
        >
          Print / Save as PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileTypeCsv size={14} />}
          onClick={() => {
            if (csvRows && csvColumns) {
              exportCsv(csvRows, csvColumns, csvFileName);
            }
          }}
        >
          Download CSV
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default ExportReportButton;
