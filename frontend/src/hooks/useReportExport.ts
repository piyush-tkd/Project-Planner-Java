/**
 * useReportExport — utility hook for printing and exporting report pages as PDF/CSV/Excel.
 *
 * Strategy:
 *   - Print / Save as PDF  →  window.print() after injecting a print stylesheet
 *   - CSV download         →  converts an array of objects to CSV blob, triggers download
 *   - Excel download       →  generates SpreadsheetML XML (real .xls workbook, no deps needed)
 */
import { useCallback, useRef } from 'react';

interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

interface ExportOptions {
  /** Document title used as the suggested file name in print dialog */
  title?: string;
}

// ── Print / PDF ──────────────────────────────────────────────────────────────

function injectPrintStyle(title: string) {
  const STYLE_ID = 'rpe-print-style';
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    @media print {
      /* Hide chrome: sidebar, header, nav, drawers, action buttons */
      [data-sidebar], nav, header,
      .no-print, [data-no-print],
      .mantine-AppShell-navbar,
      .mantine-AppShell-header,
      .mantine-Drawer-root,
      .mantine-Modal-root { display: none !important; }

      body { background: #fff !important; color: #000 !important; }
      .mantine-Paper-root { box-shadow: none !important; }

      /* Force a page title */
      body::before {
        content: "${title.replace(/"/g, '\\"')}";
        display: block;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 12px;
      }
    }
  `;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function arrayToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(c => escape(c.header)).join(',');
  const body = rows
    .map(row => columns.map(c => escape(c.accessor(row))).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Excel (SpreadsheetML) ─────────────────────────────────────────────────────
// Generates a real Excel 2003 XML workbook (.xls) — no external library needed.
// Excel 2007+, LibreOffice, and Numbers all open this format correctly.

function escapeXml(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function arrayToSpreadsheetML<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  sheetName: string,
): string {
  const headerCells = columns
    .map(c => `<Cell><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`)
    .join('');

  const dataRows = rows
    .map(row => {
      const cells = columns.map(c => {
        const val  = c.accessor(row);
        const type = typeof val === 'number' ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n        ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="s1">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>
      <Row ss:StyleID="s1">${headerCells}</Row>
        ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReportExport(options: ExportOptions = {}) {
  const { title = 'Report' } = options;
  const printingRef = useRef(false);

  /** Trigger browser Print → Save as PDF dialog */
  const printPdf = useCallback(() => {
    if (printingRef.current) return;
    printingRef.current = true;
    injectPrintStyle(title);
    // Let the style inject before opening the dialog
    requestAnimationFrame(() => {
      window.print();
      printingRef.current = false;
    });
  }, [title]);

  /** Download a CSV from an array of records */
  const exportCsv = useCallback(
    <T>(rows: T[], columns: CsvColumn<T>[], fileName?: string) => {
      const csv = arrayToCsv(rows, columns);
      const slug = (fileName ?? title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      downloadBlob(csv, `${slug}.csv`, 'text/csv;charset=utf-8;');
    },
    [title],
  );

  /**
   * Download an Excel workbook from an array of records.
   * Uses SpreadsheetML XML format — opens correctly in Excel 2007+, LibreOffice, and Numbers.
   * No external library required.
   */
  const exportXls = useCallback(
    <T>(rows: T[], columns: CsvColumn<T>[], fileName?: string) => {
      const sheetName = (fileName ?? title).slice(0, 31); // Excel sheet name ≤ 31 chars
      const xml = arrayToSpreadsheetML(rows, columns, sheetName);
      const slug = (fileName ?? title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      downloadBlob(xml, `${slug}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    },
    [title],
  );

  return { printPdf, exportCsv, exportXls };
}
