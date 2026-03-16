import { useRef, useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import type { CsvColumnDef } from '../../utils/csv';
import { downloadCsv, parseCsvFile } from '../../utils/csv';

interface CsvToolbarProps<T extends Record<string, unknown>> {
  /** Data to export */
  data: T[];
  /** Column definitions for both export and import */
  columns: CsvColumnDef<T>[];
  /** Filename for export (without .csv extension) */
  filename: string;
  /** Called with parsed rows on import confirmation */
  onImport?: (rows: Record<string, string>[]) => void;
  /** Hide import button */
  exportOnly?: boolean;
}

export default function CsvToolbar<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  onImport,
  exportOnly,
}: CsvToolbarProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<Record<string, string>[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExport = () => {
    downloadCsv(filename, data, columns);
    notifications.show({ title: 'Exported', message: `${data.length} rows exported to ${filename}.csv`, color: 'blue' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await parseCsvFile(file, columns);
    setImportData(result.data);
    setImportErrors(result.errors);
    setConfirmOpen(true);
    // Reset file input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = () => {
    if (importData && onImport) {
      onImport(importData);
      notifications.show({
        title: 'Imported',
        message: `${importData.length} rows imported from CSV`,
        color: 'green',
      });
    }
    setConfirmOpen(false);
    setImportData(null);
    setImportErrors([]);
  };

  return (
    <>
      <Group gap="xs">
        <Button
          variant="light"
          size="xs"
          leftSection={<IconDownload size={14} />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
        {!exportOnly && onImport && (
          <>
            <Button
              variant="light"
              size="xs"
              color="teal"
              leftSection={<IconUpload size={14} />}
              onClick={() => fileRef.current?.click()}
            >
              Import CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}
      </Group>

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm CSV Import">
        <Stack>
          <Text>
            Found <b>{importData?.length ?? 0}</b> rows to import.
          </Text>
          {importErrors.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" c="red" fw={600}>Warnings:</Text>
              {importErrors.slice(0, 5).map((err, i) => (
                <Text key={i} size="xs" c="red">{err}</Text>
              ))}
              {importErrors.length > 5 && (
                <Text size="xs" c="dimmed">...and {importErrors.length - 5} more</Text>
              )}
            </Stack>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={!importData || importData.length === 0}>
              Import {importData?.length ?? 0} rows
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
