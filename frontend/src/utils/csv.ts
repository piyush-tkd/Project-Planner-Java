import Papa from 'papaparse';

export interface CsvColumnDef<T = Record<string, unknown>> {
  key: string;
  header: string;
  format?: (row: T) => string | number;
}

export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: CsvColumnDef<T>[],
) {
  const headers = columns.map(c => c.header);
  const data = rows.map(row =>
    columns.map(c => {
      if (c.format) return c.format(row);
      const val = getNestedValue(row, c.key);
      return val ?? '';
    }),
  );

  const csv = Papa.unparse({ fields: headers, data });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParseResult<T> {
  data: T[];
  errors: string[];
}

export function parseCsvFile<T>(
  file: File,
  columns: CsvColumnDef<T>[],
): Promise<ParseResult<Record<string, string>>> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const errors: string[] = [];
        const headerMap = new Map<string, string>();
        columns.forEach(c => headerMap.set(c.header.toLowerCase(), c.key));

        const data = (results.data as Record<string, string>[]).map((row, idx) => {
          const mapped: Record<string, string> = {};
          for (const [rawHeader, value] of Object.entries(row)) {
            const key = headerMap.get(rawHeader.trim().toLowerCase());
            if (key) {
              mapped[key] = value?.trim() ?? '';
            }
          }
          if (Object.keys(mapped).length === 0) {
            errors.push(`Row ${idx + 1}: no matching columns found`);
          }
          return mapped;
        });

        if (results.errors.length > 0) {
          results.errors.forEach(e => errors.push(`Parse error row ${e.row}: ${e.message}`));
        }

        resolve({ data, errors });
      },
      error(err: Error) {
        resolve({ data: [], errors: [err.message] });
      },
    });
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
