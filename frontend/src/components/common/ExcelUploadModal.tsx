import { useRef, useState } from 'react';
import {
  Modal,
  Button,
  Stack,
  Text,
  Group,
  Alert,
  Table,
  LoadingOverlay,
  Box,
} from '@mantine/core';
import {
  IconUpload,
  IconFileSpreadsheet,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconDownload,
} from '@tabler/icons-react';
import { useImportExcel, type ExcelImportResponse } from '../../api/dataImport';

interface ExcelUploadModalProps {
  opened: boolean;
  onClose: () => void;
}

const ENTITY_LABELS: Record<string, string> = {
  timeline: 'Timeline Config',
  pods: 'PODs',
  tshirtSizes: 'T-Shirt Sizes',
  roleEffortMix: 'Role Effort Mix',
  effortPatterns: 'Effort Patterns',
  resources: 'Resources',
  resourceAssignments: 'Resource Assignments',
  availability: 'Availability Entries',
  bauAssumptions: 'BAU Assumptions',
  projects: 'Projects',
  podPlanning: 'POD Planning',
  temporaryOverrides: 'Temporary Overrides',
};

export default function ExcelUploadModal({ opened, onClose }: ExcelUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExcelImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importMutation = useImportExcel();

  const reset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx') {
        setError('Invalid file type. Please select an .xlsx file.');
        setSelectedFile(null);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('File is too large. Maximum allowed size is 10 MB.');
        setSelectedFile(null);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setResult(data);
        setError(null);
      },
      onError: (err) => {
        setError(err.message || 'Import failed');
        setResult(null);
      },
    });
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Upload Excel Data" size="xl">
      <Box pos="relative">
        <LoadingOverlay visible={importMutation.isPending} />
        <Stack>
          {!result && (
            <>
              <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                This will <b>replace ALL existing data</b> in the application. This action cannot be
                undone.
              </Alert>

              <Group gap="xs">
                <IconFileSpreadsheet size={16} color="green" />
                <Text size="sm">
                  Need the expected format?{' '}
                  <Text
                    component="a"
                    href="/sample_import_template.xlsx"
                    download="sample_import_template.xlsx"
                    size="sm"
                    c="blue"
                    td="underline"
                    style={{ cursor: 'pointer' }}
                  >
                    <IconDownload size={14} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                    Download sample template
                  </Text>
                </Text>
              </Group>

              <Box
                style={{
                  border: '2px dashed var(--mantine-color-dimmed)',
                  borderRadius: 8,
                  padding: 24,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => fileRef.current?.click()}
              >
                {selectedFile ? (
                  <Group justify="center" gap="xs">
                    <IconFileSpreadsheet size={24} color="green" />
                    <div>
                      <Text fw={600}>{selectedFile.name}</Text>
                      <Text size="xs" c="dimmed">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                      </Text>
                    </div>
                  </Group>
                ) : (
                  <Stack align="center" gap={4}>
                    <IconUpload size={32} color="gray" />
                    <Text size="sm" c="dimmed">
                      Click to select an .xlsx file
                    </Text>
                  </Stack>
                )}
              </Box>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {error && (
                <Alert color="red" icon={<IconX size={18} />}>
                  {error}
                </Alert>
              )}

              <Group justify="flex-end">
                <Button variant="default" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  color="red"
                  disabled={!selectedFile}
                  loading={importMutation.isPending}
                  onClick={handleUpload}
                >
                  Upload &amp; Replace All Data
                </Button>
              </Group>
            </>
          )}

          {result && (
            <>
              <Alert
                color={result.success ? 'green' : 'red'}
                icon={result.success ? <IconCheck size={18} /> : <IconX size={18} />}
              >
                {result.message}
              </Alert>

              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Entity</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(result.counts).map(([key, count]) => (
                    <Table.Tr key={key}>
                      <Table.Td>{ENTITY_LABELS[key] ?? key}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {result.warnings.length > 0 && (
                <Stack gap={4}>
                  <Text size="sm" fw={600} c="orange">
                    Warnings ({result.warnings.length}):
                  </Text>
                  {result.warnings.slice(0, 10).map((w, i) => (
                    <Text key={i} size="xs" c="dimmed">
                      • {w}
                    </Text>
                  ))}
                  {result.warnings.length > 10 && (
                    <Text size="xs" c="dimmed">
                      ...and {result.warnings.length - 10} more
                    </Text>
                  )}
                </Stack>
              )}

              <Group justify="flex-end">
                <Button onClick={handleClose}>Close</Button>
              </Group>
            </>
          )}
        </Stack>
      </Box>
    </Modal>
  );
}
