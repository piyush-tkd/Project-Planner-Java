import { useState, useMemo } from 'react';
import {
  Title, Stack, Group, Text, Badge, Box, TextInput, Table, ScrollArea,
  Loader, Center, Paper, ActionIcon, Tooltip, Pagination, Select,
  Kbd, Code, ThemeIcon, SimpleGrid, Alert, Anchor, UnstyledButton,
  Tabs, Divider,
} from '@mantine/core';
import {
  IconDatabase, IconSearch, IconTable, IconChevronUp, IconChevronDown,
  IconKey, IconInfoCircle, IconRefresh, IconSelector,
} from '@tabler/icons-react';
import { useDbTables, useDbSchema, useDbTableData, type DbColumnSchema } from '../../api/dbBrowser';
import { useQueryClient } from '@tanstack/react-query';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  integer:                  'blue',
  bigint:                   'blue',
  smallint:                 'blue',
  'double precision':       'blue',
  numeric:                  'blue',
  boolean:                  'pink',
  text:                     'teal',
  'character varying':      'teal',
  character:                'teal',
  varchar:                  'teal',
  timestamp:                'orange',
  'timestamp without time zone': 'orange',
  'timestamp with time zone':    'orange',
  date:                     'orange',
  json:                     'grape',
  jsonb:                    'grape',
  uuid:                     'violet',
};

function typeColor(t: string) {
  return TYPE_COLORS[t.toLowerCase()] ?? 'gray';
}

function typeLabel(col: DbColumnSchema) {
  if (col.character_maximum_length) return `${col.data_type}(${col.character_maximum_length})`;
  if (col.numeric_precision) return `${col.data_type}(${col.numeric_precision})`;
  return col.data_type;
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Schema panel ──────────────────────────────────────────────────────────────
function SchemaPanel({ tableName }: { tableName: string }) {
  const { data: schema = [], isLoading } = useDbSchema(tableName);

  if (isLoading) return <Center py="md"><Loader size="sm" /></Center>;

  return (
    <Table fz="xs" withColumnBorders withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Column</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Nullable</Table.Th>
          <Table.Th>Default</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {schema.map(col => (
          <Table.Tr key={col.column_name}>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                {col.is_primary_key && (
                  <Tooltip label="Primary Key" withArrow>
                    <ThemeIcon size="xs" color="yellow" variant="filled" radius="sm">
                      <IconKey size={9} />
                    </ThemeIcon>
                  </Tooltip>
                )}
                <Text fw={col.is_primary_key ? 700 : 400} size="xs" ff="monospace">
                  {col.column_name}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Badge size="xs" color={typeColor(col.data_type)} variant="light">
                {typeLabel(col)}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge size="xs" color={col.is_nullable === 'YES' ? 'gray' : 'red'} variant="dot">
                {col.is_nullable === 'YES' ? 'nullable' : 'not null'}
              </Badge>
            </Table.Td>
            <Table.Td>
              {col.column_default
                ? <Code fz={10}>{col.column_default}</Code>
                : <Text size="xs" c="dimmed">—</Text>}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Data panel ────────────────────────────────────────────────────────────────
function DataPanel({ tableName }: { tableName: string }) {
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState('50');
  const [search, setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // Debounce search input
  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__dbSearchTimer);
    (window as any).__dbSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortCol(col);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const { data, isLoading, isFetching } = useDbTableData(
    tableName, page - 1, parseInt(pageSize), debouncedSearch, sortCol, sortDir,
  );

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  const columns = data?.columns ?? [];
  const rows    = data?.rows    ?? [];
  const total   = data?.total   ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Stack gap="sm">
      {/* Toolbar */}
      <Group justify="space-between" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Search all columns…"
          leftSection={<IconSearch size={13} />}
          value={search}
          onChange={e => handleSearch(e.target.value)}
          w={300}
          rightSection={isFetching ? <Loader size="xs" /> : undefined}
        />
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {total.toLocaleString()} row{total !== 1 ? 's' : ''}
          </Text>
          <Select
            size="xs"
            w={90}
            value={pageSize}
            onChange={v => { setPageSize(v ?? '50'); setPage(1); }}
            data={['25', '50', '100', '200']}
          />
        </Group>
      </Group>

      {/* Table */}
      <ScrollArea type="auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
        <Table fz="xs" withColumnBorders withTableBorder highlightOnHover
          style={{ whiteSpace: 'nowrap', minWidth: columns.length * 120 }}>
          <Table.Thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
            <Table.Tr>
              {columns.map(col => (
                <Table.Th
                  key={col}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort(col)}
                >
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" fw={700} ff="monospace">{col}</Text>
                    {sortCol === col
                      ? (sortDir === 'ASC'
                          ? <IconChevronUp size={11} />
                          : <IconChevronDown size={11} />)
                      : <IconSelector size={11} color="var(--mantine-color-dimmed)" />
                    }
                  </Group>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, i) => (
              <Table.Tr key={i}>
                {columns.map(col => {
                  const val = formatCellValue(row[col]);
                  const isNull = row[col] === null || row[col] === undefined;
                  return (
                    <Table.Td key={col} style={{ maxWidth: 300 }}>
                      {isNull
                        ? <Text size="xs" c="dimmed" fs="italic">NULL</Text>
                        : (
                          <Tooltip
                            label={val}
                            disabled={val.length < 60}
                            withArrow
                            multiline
                            w={360}
                          >
                            <Text
                              size="xs"
                              ff={typeof row[col] === 'object' ? 'monospace' : undefined}
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 280,
                              }}
                            >
                              {val.length > 100 ? val.slice(0, 100) + '…' : val}
                            </Text>
                          </Tooltip>
                        )
                      }
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text ta="center" c="dimmed" py="md" size="sm">
                    {debouncedSearch ? `No rows matching "${debouncedSearch}"` : 'Table is empty'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
        </Group>
      )}
    </Stack>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TablesPage() {
  const qc = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');

  const { data: tables = [], isLoading, refetch } = useDbTables();

  const filteredTables = useMemo(() =>
    tables.filter(t =>
      t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
    ), [tables, tableSearch]);

  const totalRows   = tables.reduce((s, t) => s + (t.row_count > 0 ? t.row_count : 0), 0);
  const selectedMeta = tables.find(t => t.table_name === selectedTable);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'db'] });
    refetch();
  };

  return (
    <Box h="100%">
      <Group justify="space-between" mb="md" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size="xl" radius="md" color="indigo" variant="light">
            <IconDatabase size={22} />
          </ThemeIcon>
          <Box>
            <Title order={2}>Database Tables</Title>
            <Text size="sm" c="dimmed">
              Read-only view of all database tables — {tables.length} tables · {totalRows.toLocaleString()} total rows
            </Text>
          </Box>
        </Group>
        <Tooltip label="Refresh table list">
          <ActionIcon variant="light" onClick={handleRefresh} loading={isLoading}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Alert icon={<IconInfoCircle size={14} />} color="blue" variant="light" mb="md" py={6}>
        <Text size="xs">Read-only view. No writes are possible from this page. Data is fetched live from the PostgreSQL database.</Text>
      </Alert>

      <Group align="flex-start" gap="md" style={{ height: 'calc(100vh - 220px)' }} wrap="nowrap">

        {/* ── Left panel: table list ─────────────────────────────────────── */}
        <Paper withBorder style={{ width: 260, flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <TextInput
              size="xs"
              placeholder="Filter tables…"
              leftSection={<IconSearch size={12} />}
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
            />
          </Box>
          <ScrollArea style={{ flex: 1 }} type="auto">
            {isLoading && <Center py="xl"><Loader size="sm" /></Center>}
            {filteredTables.map(t => (
              <UnstyledButton
                key={t.table_name}
                w="100%"
                onClick={() => setSelectedTable(t.table_name)}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedTable === t.table_name
                    ? 'var(--mantine-color-indigo-0)'
                    : 'transparent',
                  borderLeft: selectedTable === t.table_name
                    ? '3px solid var(--mantine-color-indigo-5)'
                    : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <IconTable size={13} color={selectedTable === t.table_name ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-dimmed)'} />
                  <Text
                    size="xs"
                    fw={selectedTable === t.table_name ? 700 : 400}
                    ff="monospace"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {t.table_name}
                  </Text>
                </Group>
                <Badge size="xs" variant="light" color={selectedTable === t.table_name ? 'indigo' : 'gray'} ml="xs" style={{ flexShrink: 0 }}>
                  {t.row_count >= 0 ? t.row_count.toLocaleString() : '?'}
                </Badge>
              </UnstyledButton>
            ))}
            {!isLoading && filteredTables.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="md">No tables found</Text>
            )}
          </ScrollArea>
        </Paper>

        {/* ── Right panel: schema + data ─────────────────────────────────── */}
        <Paper withBorder style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedTable ? (
            <Center h="100%">
              <Stack align="center" gap="sm">
                <ThemeIcon size={60} radius="xl" color="indigo" variant="light">
                  <IconDatabase size={32} />
                </ThemeIcon>
                <Text fw={600} c="dimmed">Select a table from the left panel</Text>
                <Text size="xs" c="dimmed">Click any table to view its schema and data</Text>
              </Stack>
            </Center>
          ) : (
            <Box p="md" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Table header */}
              <Group gap="sm" mb="sm" justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="sm" color="indigo" variant="light" radius="sm">
                    <IconTable size={13} />
                  </ThemeIcon>
                  <Text fw={700} ff="monospace">{selectedTable}</Text>
                  {selectedMeta && (
                    <>
                      <Badge size="sm" variant="light" color="indigo">
                        {selectedMeta.row_count.toLocaleString()} rows
                      </Badge>
                      <Badge size="sm" variant="light" color="gray">
                        {selectedMeta.column_count} columns
                      </Badge>
                    </>
                  )}
                </Group>
              </Group>

              <Tabs defaultValue="data" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Tabs.List mb="sm">
                  <Tabs.Tab value="data" leftSection={<IconTable size={13} />}>
                    Data
                  </Tabs.Tab>
                  <Tabs.Tab value="schema" leftSection={<IconDatabase size={13} />}>
                    Schema
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="data" style={{ flex: 1, overflow: 'hidden' }}>
                  <DataPanel tableName={selectedTable} />
                </Tabs.Panel>

                <Tabs.Panel value="schema">
                  <SchemaPanel tableName={selectedTable} />
                </Tabs.Panel>
              </Tabs>
            </Box>
          )}
        </Paper>
      </Group>
    </Box>
  );
}
