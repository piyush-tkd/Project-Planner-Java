/**
 * BulkImportPage — CSV/Excel bulk import for projects and resources.
 *
 * Supports:
 *  - File upload (.csv) or paste raw CSV text
 *  - Column auto-mapping with editable overrides
 *  - Validation preview with error rows highlighted
 *  - Submit to /api/bulk-import/projects or /api/bulk-import/resources
 *  - Result summary with per-row status
 */
import { useState } from 'react';
import {
  Text, Stack, Group, Button, Paper, Badge, Table, Select,
  Textarea, Tabs, Alert, Progress, Divider,
  ScrollArea, FileButton, Code, SimpleGrid,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconCheck, IconAlertCircle, IconFileSpreadsheet,
  IconUsers, IconBuildingSkyscraper, IconRefresh, IconDownload,
  IconTable, IconChevronRight,
} from '@tabler/icons-react';
import Papa from 'papaparse';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import { FONT_FAMILY, GRAY_100 } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

// ── Types ────────────────────────────────────────────────────────────────────

type ImportType = 'projects' | 'resources';

interface ProjectRow {
  name: string;
  status?: string;
  priority?: string;
  owner?: string;
  startDate?: string;
  targetDate?: string;
  importStatus?: string;
  errorMessage?: string;
  _rowIndex?: number;
}

interface ResourceRow {
  name: string;
  email?: string;
  role?: string;
  location?: string;
  fte?: string;
  importStatus?: string;
  errorMessage?: string;
  _rowIndex?: number;
}

type AnyRow = ProjectRow | ResourceRow;

// ── Column mapping configs ────────────────────────────────────────────────────

const PROJECT_FIELDS = [
  { key: 'name',       label: 'Name *',      required: true  },
  { key: 'status',     label: 'Status',      required: false },
  { key: 'priority',   label: 'Priority',    required: false },
  { key: 'owner',      label: 'Owner',       required: false },
  { key: 'startDate',  label: 'Start Date',  required: false },
  { key: 'targetDate', label: 'Target Date', required: false },
];

const RESOURCE_FIELDS = [
  { key: 'name',     label: 'Name *',    required: true  },
  { key: 'email',    label: 'Email',     required: false },
  { key: 'role',     label: 'Role',      required: false },
  { key: 'location', label: 'Location',  required: false },
  { key: 'fte',      label: 'FTE',       required: false },
];

// ── CSV template strings ───────────────────────────────────────────────────

const PROJECT_TEMPLATE = `name,status,priority,owner,startDate,targetDate
Alpha Project,ACTIVE,HIGH,alice@co.com,2025-01-01,2025-06-30
Beta Initiative,NOT_STARTED,MEDIUM,bob@co.com,2025-03-01,2025-12-31`;

const RESOURCE_TEMPLATE = `name,email,role,location,fte
Alice Johnson,alice@co.com,Engineer,New York,1.0
Bob Smith,bob@co.com,Designer,London,0.5`;

// ── API hooks ─────────────────────────────────────────────────────────────────

function useImportRows(type: ImportType) {
  return useMutation<AnyRow[], Error, AnyRow[]>({
    mutationFn: (rows) =>
      apiClient.post(`/bulk-import/${type}`, rows).then(r => r.data),
  });
}

// ── Helper: auto-map CSV headers → field keys ─────────────────────────────

function autoMap(csvHeaders: string[], fields: { key: string; label: string }[]) {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const match = csvHeaders.find(h =>
      h.toLowerCase().replace(/[^a-z0-9]/g, '') ===
      field.key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DownloadTemplateButton({ type }: { type: ImportType }) {
  const csv    = type === 'projects' ? PROJECT_TEMPLATE : RESOURCE_TEMPLATE;
  const fname  = type === 'projects' ? 'projects-template.csv' : 'resources-template.csv';
  return (
    <Button
      size="xs"
      variant="subtle"
      color="teal"
      leftSection={<IconDownload size={13} />}
      onClick={() => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Download template
    </Button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const isDark = useDarkMode();
  const cardBg     = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  const [importType, setImportType] = useState<ImportType>('projects');
  const [step, setStep]             = useState<'input' | 'map' | 'preview' | 'done'>('input');
  const [csvText, setCsvText]       = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows]       = useState<Record<string, string>[]>([]);
  const [mapping, setMapping]       = useState<Record<string, string>>({});
  const [resultRows, setResultRows] = useState<AnyRow[]>([]);

  const importMutation = useImportRows(importType);
  const fields = importType === 'projects' ? PROJECT_FIELDS : RESOURCE_FIELDS;

  // ── Step 1: parse CSV ──────────────────────────────────────────────────────

  function parseCSV(text: string) {
    const result = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
    });
    if (result.errors.length > 0 && result.data.length === 0) {
      notifications.show({ title: 'Parse error', message: result.errors[0].message, color: 'red' });
      return;
    }
    const headers = result.meta.fields ?? [];
    setCsvHeaders(headers);
    setRawRows(result.data);
    setMapping(autoMap(headers, fields));
    setStep('map');
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  // ── Step 2: map → build typed rows ──────────────────────────────────────

  function buildRows(): AnyRow[] {
    return rawRows.map((raw, i) => {
      const row: Record<string, string> = { _rowIndex: String(i) };
      for (const field of fields) {
        const csvCol = mapping[field.key];
        if (csvCol) row[field.key] = raw[csvCol] ?? '';
      }
      return row as unknown as AnyRow;
    });
  }

  // ── Step 3: submit ─────────────────────────────────────────────────────

  async function handleImport() {
    const rows = buildRows();
    try {
      const result = await importMutation.mutateAsync(rows);
      setResultRows(result);
      setStep('done');
    } catch {
      notifications.show({ title: 'Import failed', message: 'Server error. Check your data and try again.', color: 'red' });
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setCsvText('');
    setCsvHeaders([]);
    setRawRows([]);
    setMapping({});
    setResultRows([]);
    setStep('input');
  }

  // ── Result stats ─────────────────────────────────────────────────────────

  const okCount    = resultRows.filter(r => r.importStatus === 'OK').length;
  const errCount   = resultRows.filter(r => r.importStatus === 'ERROR').length;
  const successPct = resultRows.length > 0 ? Math.round((okCount / resultRows.length) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PPPageLayout title="Bulk Import" subtitle="Import projects and resources from CSV or Excel" animate
      actions={
        step !== 'input' ? (
          <Button size="sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={reset}>
            Start over
          </Button>
        ) : null
      }
    >
      <Stack gap="lg" className="page-enter">

      {/* ── Import type selector ── */}
      <Tabs
        value={importType}
        onChange={v => { setImportType(v as ImportType); reset(); }}
        variant="pills"
      >
        <Tabs.List>
          <Tabs.Tab value="projects"  leftSection={<IconBuildingSkyscraper size={15} />}>Projects</Tabs.Tab>
          <Tabs.Tab value="resources" leftSection={<IconUsers size={15} />}>Resources</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* ── Step progress ── */}
      <Group gap="xs">
        {(['input','map','preview','done'] as const).map((s, i) => (
          <Group key={s} gap={4}>
            <Badge
              size="sm"
              variant={step === s ? 'filled' : (
                ['input','map','preview','done'].indexOf(step) > i ? 'light' : 'outline'
              )}
              color={step === s ? 'teal' : (
                ['input','map','preview','done'].indexOf(step) > i ? 'teal' : 'gray'
              )}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
            {i < 3 && <IconChevronRight size={12} color="gray" />}
          </Group>
        ))}
      </Group>

      {/* ════════════════ STEP 1: Input ════════════════ */}
      {step === 'input' && (
        <Paper withBorder radius="md" p="lg" style={{ background: cardBg, borderColor }}>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                Upload or paste your CSV
              </Text>
              <DownloadTemplateButton type={importType} />
            </Group>

            <Alert color="blue" variant="light" icon={<IconFileSpreadsheet size={16} />} radius="sm">
              <Text size="sm">
                Required columns: <Code>name</Code>.
                {importType === 'projects'
                  ? <> Optional: <Code>status</Code>, <Code>priority</Code>, <Code>owner</Code>, <Code>startDate</Code> (YYYY-MM-DD), <Code>targetDate</Code> (YYYY-MM-DD)</>
                  : <> Optional: <Code>email</Code>, <Code>role</Code>, <Code>location</Code>, <Code>fte</Code></>
                }
              </Text>
            </Alert>

            <Group gap="sm">
              <FileButton onChange={handleFile} accept=".csv">
                {(props) => (
                  <Button
                    {...props}
                    variant="filled"
                    color="teal"
                    leftSection={<IconUpload size={14} />}
                  >
                    Upload CSV file
                  </Button>
                )}
              </FileButton>
              <Text size="xs" c="dimmed">or paste below</Text>
            </Group>

            <Textarea
              placeholder={importType === 'projects' ? PROJECT_TEMPLATE : RESOURCE_TEMPLATE}
              value={csvText}
              onChange={e => setCsvText(e.currentTarget.value)}
              minRows={6}
              autosize
              maxRows={14}
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
            />

            <Group justify="flex-end">
              <Button
                color="teal"
                disabled={!csvText.trim()}
                onClick={() => parseCSV(csvText)}
                leftSection={<IconTable size={14} />}
              >
                Parse & map columns
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {/* ════════════════ STEP 2: Column Mapping ════════════════ */}
      {step === 'map' && (
        <Paper withBorder radius="md" p="lg" style={{ background: cardBg, borderColor }}>
          <Stack gap="md">
            <div>
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Map CSV columns to fields</Text>
              <Text size="xs" c="dimmed" mt={2}>
                Auto-mapped where possible. Adjust if needed.
              </Text>
            </div>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {fields.map(field => (
                <Select
                  key={field.key}
                  label={field.label}
                  placeholder="— skip —"
                  clearable
                  data={csvHeaders}
                  value={mapping[field.key] ?? null}
                  onChange={v => setMapping(prev => ({ ...prev, [field.key]: v ?? '' }))}
                />
              ))}
            </SimpleGrid>

            <Divider />
            <Text size="xs" c="dimmed">
              {rawRows.length} row{rawRows.length !== 1 ? 's' : ''} detected in file.
            </Text>

            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" color="gray" onClick={() => setStep('input')}>Back</Button>
              <Button
                color="teal"
                disabled={!mapping['name']}
                onClick={() => setStep('preview')}
                leftSection={<IconTable size={14} />}
              >
                Preview data
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {/* ════════════════ STEP 3: Preview ════════════════ */}
      {step === 'preview' && (
        <Stack gap="md">
          <Paper withBorder radius="md" p="md" style={{ background: cardBg, borderColor }}>
            <Group justify="space-between" mb="sm">
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                Preview — {rawRows.length} row{rawRows.length !== 1 ? 's' : ''} to import
              </Text>
              <Button variant="subtle" size="xs" color="gray" onClick={() => setStep('map')}>
                ← Edit mapping
              </Button>
            </Group>

            <ScrollArea>
              <Table highlightOnHover withTableBorder withColumnBorders fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    {fields.map(f => mapping[f.key] ? <Table.Th key={f.key}>{f.label.replace(' *','')}</Table.Th> : null)}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {buildRows().slice(0, 50).map((row, i) => (
                    <Table.Tr key={i}>
                      <Table.Td c="dimmed">{i + 1}</Table.Td>
                      {fields.map(f => mapping[f.key] ? (
                        <Table.Td key={f.key}>
                          {(row as unknown as Record<string, string>)[f.key] || <Text size="xs" c="dimmed" fs="italic">—</Text>}
                        </Table.Td>
                      ) : null)}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {rawRows.length > 50 && (
              <Text size="xs" c="dimmed" mt={4}>Showing first 50 of {rawRows.length} rows.</Text>
            )}
          </Paper>

          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" onClick={() => setStep('map')}>Back</Button>
            <Button
              color="teal"
              leftSection={<IconUpload size={14} />}
              onClick={handleImport}
              loading={importMutation.isPending}
            >
              Import {rawRows.length} row{rawRows.length !== 1 ? 's' : ''}
            </Button>
          </Group>
        </Stack>
      )}

      {/* ════════════════ STEP 4: Results ════════════════ */}
      {step === 'done' && (
        <Stack gap="md">
          {/* Summary */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {[
              { label: 'Total rows', value: resultRows.length, color: 'blue'  },
              { label: 'Imported',   value: okCount,            color: 'teal'  },
              { label: 'Errors',     value: errCount,           color: errCount > 0 ? 'red' : 'gray' },
            ].map(s => (
              <Paper key={s.label} withBorder radius="md" p="md" style={{ background: cardBg, borderColor }}>
                <Text size="xs" c="dimmed">{s.label}</Text>
                <Text fw={700} size="xl" style={{ color: `var(--mantine-color-${s.color}-6)` }}>
                  {s.value}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>

          <Progress
            value={successPct}
            color={successPct === 100 ? 'teal' : errCount > okCount ? 'red' : 'yellow'}
            size="sm"
            radius="xl"
          />

          {errCount === 0 ? (
            <Alert color="teal" variant="light" icon={<IconCheck size={16} />} radius="sm">
              All {okCount} rows imported successfully!
            </Alert>
          ) : (
            <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />} radius="sm">
              {errCount} row{errCount !== 1 ? 's' : ''} failed to import. See the error column below.
            </Alert>
          )}

          <ScrollArea>
            <Table highlightOnHover withTableBorder withColumnBorders fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Error</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {resultRows.map((row, i) => {
                  const isErr = row.importStatus === 'ERROR';
                  return (
                    <Table.Tr
                      key={i}
                      style={{
                        backgroundColor: isErr
                          ? (isDark ? 'rgba(250,82,82,0.12)' : 'rgba(250,82,82,0.06)')
                          : undefined,
                      }}
                    >
                      <Table.Td c="dimmed">{i + 1}</Table.Td>
                      <Table.Td fw={500}>{(row as ProjectRow).name || '—'}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={isErr ? 'red' : 'teal'}
                          variant="light"
                        >
                          {row.importStatus}
                        </Badge>
                      </Table.Td>
                      <Table.Td c="red" fs={isErr ? 'italic' : undefined}>
                        {row.errorMessage ?? ''}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Group justify="flex-end">
            <Button color="teal" leftSection={<IconRefresh size={14} />} onClick={reset}>
              Import another file
            </Button>
          </Group>
        </Stack>
      )}

      </Stack>
    </PPPageLayout>
  );
}
