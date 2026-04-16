import { useState, useMemo, useRef, useCallback } from 'react';
import {
 Title, Stack, Group, Text, Badge, Box, TextInput, Table, ScrollArea,
 Loader, Center, Paper, ActionIcon, Tooltip, Pagination, Select,
 Kbd, Code, ThemeIcon, SimpleGrid, Alert, Anchor, UnstyledButton,
 Tabs, Divider, Textarea, Button, Menu, Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
 IconDatabase, IconSearch, IconTable, IconChevronUp, IconChevronDown,
 IconKey, IconInfoCircle, IconRefresh, IconSelector, IconPlayerPlay,
 IconDeviceFloppy, IconTrash, IconBookmark, IconClock, IconAlertTriangle,
 IconCode, IconCheck, IconCopy,
} from '@tabler/icons-react';
import {
 useDbTables, useDbSchema, useDbTableData, useExecuteQuery, useSavedQueries,
 type DbColumnSchema, type QueryResult, type SavedQuery,
} from '../../api/dbBrowser';
import { useQueryClient } from '@tanstack/react-query';
import { AQUA, DARK_BG, DARK_BORDER, DEEP_BLUE, FONT_FAMILY, GRAY_BORDER, SURFACE_SUBTLE} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
 integer: 'blue',
 bigint: 'blue',
 smallint: 'blue',
 'double precision': 'blue',
 numeric: 'blue',
 boolean: 'pink',
 text: 'teal',
 'character varying': 'teal',
 character: 'teal',
 varchar: 'teal',
 timestamp: 'orange',
 'timestamp without time zone': 'orange',
 'timestamp with time zone': 'orange',
 date: 'orange',
 json: 'grape',
 jsonb: 'grape',
 uuid: 'violet',
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

 if (isLoading) return <LoadingSpinner variant="table" />;

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
 : <Text size="xs" c="dimmed">{'\u2014'}</Text>}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 );
}

// ── Data panel ────────────────────────────────────────────────────────────────
function DataPanel({ tableName }: { tableName: string }) {
 const isDark = useDarkMode();
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState('50');
 const [search, setSearch] = useState('');
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

 if (isLoading) return <LoadingSpinner variant="table" />;

 const columns = data?.columns ?? [];
 const rows = data?.rows ?? [];
 const total = data?.total ?? 0;
 const totalPages = data?.totalPages ?? 1;

 return (
 <Stack gap="sm" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
 {/* Toolbar */}
 <Group justify="space-between" wrap="nowrap" style={{ flexShrink: 0 }}>
 <TextInput
 size="xs"
 placeholder="Search all columns..."
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
 <ScrollArea type="auto" style={{ flex: 1, minHeight: 0 }}>
 <Table fz="xs" withColumnBorders withTableBorder highlightOnHover
 style={{ whiteSpace: 'nowrap', minWidth: columns.length * 120 }}>
 <Table.Thead style={{ position: 'sticky', top: 0, background: isDark ? DARK_BG : '#fff', zIndex: 1 }}>
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
 {val.length > 100 ? val.slice(0, 100) + '\u2026' : val}
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
 <Group justify="center" style={{ flexShrink: 0, paddingBottom: 4 }}>
 <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
 </Group>
 )}
 </Stack>
 );
}

// ── Sample Queries ──────────────────────────────────────────────────────────
const SAMPLE_QUERIES: { name: string; sql: string; category: string }[] = [
  // Data Exploration
  { category: 'Exploration', name: 'All tables & row counts', sql: 'SELECT table_name, row_count, column_count FROM (\n  SELECT t.table_name,\n    (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = \'public\' AND c.table_name = t.table_name) AS column_count\n  FROM information_schema.tables t\n  WHERE t.table_schema = \'public\' AND t.table_type = \'BASE TABLE\'\n) sub\nCROSS JOIN LATERAL (\n  SELECT count(*) AS row_count FROM public. || sub.table_name\n) rc\nORDER BY table_name;' },
  { category: 'Exploration', name: 'Jira issues overview', sql: 'SELECT issue_key, summary, issue_type, status_name, status_category,\n  priority_name, assignee_display_name, story_points,\n  created_at, resolution_date\nFROM jira_issue\nORDER BY created_at DESC\nLIMIT 100;' },
  { category: 'Exploration', name: 'All resources', sql: 'SELECT id, name, role, location, active, jira_display_name, actual_rate\nFROM resource\nORDER BY name;' },
  // Analytics
  { category: 'Analytics', name: 'Hours by resource (this year)', sql: "SELECT w.author_display_name,\n  ROUND(SUM(w.time_spent_seconds) / 3600.0, 1) AS hours\nFROM jira_issue_worklog w\nWHERE EXTRACT(YEAR FROM w.started) = EXTRACT(YEAR FROM CURRENT_DATE)\nGROUP BY w.author_display_name\nORDER BY hours DESC;" },
  { category: 'Analytics', name: 'Issues by type & status', sql: "SELECT issue_type,\n  status_category,\n  COUNT(*) AS cnt\nFROM jira_issue\nWHERE is_subtask = false\nGROUP BY issue_type, status_category\nORDER BY cnt DESC;" },
  { category: 'Analytics', name: 'Story points by assignee', sql: "SELECT assignee_display_name,\n  COALESCE(SUM(story_points), 0) AS total_sp,\n  COUNT(*) AS issues\nFROM jira_issue\nWHERE status_category = 'done'\n  AND is_subtask = false\n  AND EXTRACT(YEAR FROM resolution_date) = EXTRACT(YEAR FROM CURRENT_DATE)\nGROUP BY assignee_display_name\nORDER BY total_sp DESC;" },
  { category: 'Analytics', name: 'Monthly issue throughput', sql: "SELECT TO_CHAR(resolution_date, 'YYYY-MM') AS month,\n  COUNT(*) AS resolved,\n  ROUND(COALESCE(SUM(story_points), 0), 1) AS sp_total\nFROM jira_issue\nWHERE resolution_date IS NOT NULL\n  AND is_subtask = false\nGROUP BY month\nORDER BY month DESC\nLIMIT 24;" },
  // Sprint
  { category: 'Sprint', name: 'Active sprint issues', sql: "SELECT i.issue_key, i.summary, i.issue_type, i.status_name,\n  i.assignee_display_name, i.story_points\nFROM jira_issue i\nWHERE i.sprint_state = 'active'\n  AND i.is_subtask = false\nORDER BY i.status_category, i.priority_name;" },
  { category: 'Sprint', name: 'Sprint velocity (last 10)', sql: "SELECT s.name AS sprint,\n  COUNT(DISTINCT si.issue_key) AS issues,\n  ROUND(COALESCE(SUM(i.story_points), 0), 1) AS sp_completed\nFROM jira_sprint s\nJOIN jira_sprint_issue si ON si.sprint_jira_id = s.sprint_jira_id\nJOIN jira_issue i ON i.issue_key = si.issue_key AND i.status_category = 'done'\nWHERE s.state = 'closed'\nGROUP BY s.name, s.complete_date\nORDER BY s.complete_date DESC\nLIMIT 10;" },
  // Worklog
  { category: 'Worklog', name: 'Top 20 tickets by hours', sql: "SELECT w.issue_key, i.summary, i.issue_type,\n  ROUND(SUM(w.time_spent_seconds) / 3600.0, 1) AS hours\nFROM jira_issue_worklog w\nJOIN jira_issue i ON i.issue_key = w.issue_key\nGROUP BY w.issue_key, i.summary, i.issue_type\nORDER BY hours DESC\nLIMIT 20;" },
  // Mutations
  { category: 'Mutations', name: 'Update example (resource rate)', sql: "UPDATE resource\nSET actual_rate = 125.00\nWHERE id = 1;" },
  { category: 'Mutations', name: 'Insert example (cost rate)', sql: "INSERT INTO cost_rate (role, location, hourly_rate)\nVALUES ('DEVELOPER', 'US', 150.00);" },
];

// ── SQL Query Editor Panel ───────────────────────────────────────────────────
function QueryPanel() {
 const isDark = useDarkMode();
 const [sql, setSql] = useState('SELECT * FROM jira_issue LIMIT 25;');
 const [saveName, setSaveName] = useState('');
 const [noLimit, setNoLimit] = useState(false);
 const [saveOpened, { open: openSave, close: closeSave }] = useDisclosure(false);
 const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

 const { mutate: execute, data: result, isPending, reset } = useExecuteQuery();
 const { queries: savedQueries, addQuery, removeQuery } = useSavedQueries();

 const textareaRef = useRef<HTMLTextAreaElement>(null);

 // Detect if query is a write operation
 const isMutation = useMemo(() => {
   const upper = sql.trim().toUpperCase().replace(/\s+/g, ' ');
   return upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE');
 }, [sql]);

 const handleRun = useCallback(() => {
   const trimmed = sql.trim();
   if (!trimmed) return;
   // If it's a write query, show confirmation first
   if (isMutation && !confirmOpened) {
     openConfirm();
     return;
   }
   execute({ sql: trimmed, noLimit });
 }, [sql, execute, noLimit, isMutation, confirmOpened, openConfirm]);

 const handleConfirmRun = useCallback(() => {
   closeConfirm();
   execute({ sql: sql.trim(), noLimit });
 }, [sql, execute, noLimit, closeConfirm]);

 const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
   if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
     e.preventDefault();
     handleRun();
   }
 }, [handleRun]);

 const handleSave = () => {
   if (!saveName.trim() || !sql.trim()) return;
   addQuery(saveName.trim(), sql.trim());
   setSaveName('');
   closeSave();
 };

 const handleLoadQuery = (q: SavedQuery | { name: string; sql: string }) => {
   setSql(q.sql);
   reset();
 };

 const resultColumns = result?.columns ?? [];
 const resultRows = result?.rows ?? [];

 // Group sample queries by category
 const sampleCategories = useMemo(() => {
   const cats: Record<string, typeof SAMPLE_QUERIES> = {};
   for (const q of SAMPLE_QUERIES) {
     (cats[q.category] ??= []).push(q);
   }
   return cats;
 }, []);

 return (
   <Stack gap="sm" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
     {/* SQL Input Area */}
     <Box style={{ flexShrink: 0 }}>
       <Textarea
         ref={textareaRef}
         value={sql}
         onChange={e => setSql(e.target.value)}
         onKeyDown={handleKeyDown}
         placeholder="Write your SQL query here... SELECT, INSERT, UPDATE, DELETE supported"
         autosize
         minRows={4}
         maxRows={12}
         styles={{
           input: {
             fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
             fontSize: 13,
             lineHeight: 1.5,
             background: isDark ? DARK_BG : SURFACE_SUBTLE,
             border: `1px solid ${isDark ? DARK_BORDER : GRAY_BORDER}`,
           },
         }}
       />
     </Box>

     {/* Toolbar */}
     <Group justify="space-between" style={{ flexShrink: 0 }} wrap="wrap">
       <Group gap="xs">
         <Button
           size="xs"
           leftSection={<IconPlayerPlay size={14} />}
           onClick={handleRun}
           loading={isPending}
           color={isMutation ? 'orange' : 'indigo'}
         >
           {isMutation ? 'Execute' : 'Run Query'}
         </Button>
         <Tooltip label="Save query">
           <Button size="xs" variant="light" leftSection={<IconDeviceFloppy size={14} />} onClick={openSave}>
             Save
           </Button>
         </Tooltip>
         {!isMutation && (
           <Tooltip label={noLimit ? 'No row limit applied' : 'Auto-limits to 500 rows if no LIMIT clause'}>
             <Button
               size="xs"
               variant={noLimit ? 'filled' : 'light'}
               color={noLimit ? 'teal' : 'gray'}
               onClick={() => setNoLimit(v => !v)}
             >
               {noLimit ? 'No Limit' : 'Limit 500'}
             </Button>
           </Tooltip>
         )}
         <Text size="xs" c="dimmed">
           <Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd> to run
         </Text>
       </Group>

       <Group gap="xs">
         {/* Sample Queries Dropdown */}
         <Menu shadow="md" width={340} position="bottom-end">
           <Menu.Target>
             <Button size="xs" variant="light" color="violet" leftSection={<IconCode size={14} />}>
               Samples
             </Button>
           </Menu.Target>
           <Menu.Dropdown>
             {Object.entries(sampleCategories).map(([cat, queries]) => (
               <div key={cat}>
                 <Menu.Label>{cat}</Menu.Label>
                 {queries.map((q, idx) => (
                   <Menu.Item key={idx} onClick={() => handleLoadQuery(q)}>
                     <Text size="xs" fw={600}>{q.name}</Text>
                   </Menu.Item>
                 ))}
                 <Menu.Divider />
               </div>
             ))}
           </Menu.Dropdown>
         </Menu>

         {/* Saved Queries Dropdown */}
         {savedQueries.length > 0 && (
           <Menu shadow="md" width={300} position="bottom-end">
             <Menu.Target>
               <Button size="xs" variant="light" color="gray" leftSection={<IconBookmark size={14} />}>
                 Saved ({savedQueries.length})
               </Button>
             </Menu.Target>
             <Menu.Dropdown>
               <Menu.Label>Saved Queries</Menu.Label>
               {savedQueries.map(q => (
                 <Menu.Item
                   key={q.id}
                   onClick={() => handleLoadQuery(q)}
                   rightSection={
                     <ActionIcon
                       size="xs"
                       variant="subtle"
                       color="red"
                       onClick={e => { e.stopPropagation(); removeQuery(q.id); }}
                     >
                       <IconTrash size={12} />
                     </ActionIcon>
                   }
                 >
                   <Text size="xs" fw={600}>{q.name}</Text>
                   <Text size="xs" c="dimmed" lineClamp={1} ff="monospace">{q.sql}</Text>
                 </Menu.Item>
               ))}
             </Menu.Dropdown>
           </Menu>
         )}
       </Group>
     </Group>

     {/* Result Info Bar */}
     {result && (
       <Group gap="sm" style={{ flexShrink: 0 }}>
         {result.success ? (
           <>
             <Badge size="sm" color="green" variant="light" leftSection={<IconCheck size={10} />}>
               {result.mutationType ? `${result.mutationType} OK` : 'Success'}
             </Badge>
             <Text size="xs" c="dimmed">
               {result.mutationType
                 ? `${result.rowCount} row${result.rowCount !== 1 ? 's' : ''} affected`
                 : `${result.rowCount} row${result.rowCount !== 1 ? 's' : ''}${result.truncated ? ' (truncated at 500)' : ''}`
               }
             </Text>
             <Text size="xs" c="dimmed">
               <IconClock size={11} style={{ verticalAlign: 'middle' }} /> {result.elapsedMs}ms
             </Text>
           </>
         ) : (
           <Badge size="sm" color="red" variant="light" leftSection={<IconAlertTriangle size={10} />}>
             Error
           </Badge>
         )}
       </Group>
     )}

     {/* Error Display */}
     {result && !result.success && result.error && (
       <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />} style={{ flexShrink: 0 }}>
         <Code block fz={11} style={{ whiteSpace: 'pre-wrap' }}>{result.error}</Code>
       </Alert>
     )}

     {/* Results Table */}
     {result && result.success && resultColumns.length > 0 && (
       <ScrollArea type="auto" style={{ flex: 1, minHeight: 0 }}>
         <Table fz="xs" withColumnBorders withTableBorder highlightOnHover
           style={{ whiteSpace: 'nowrap', minWidth: resultColumns.length * 120 }}>
           <Table.Thead style={{ position: 'sticky', top: 0, background: isDark ? DARK_BG : '#fff', zIndex: 1 }}>
             <Table.Tr>
               <Table.Th style={{ width: 40, textAlign: 'center' }}>
                 <Text size="xs" c="dimmed">#</Text>
               </Table.Th>
               {resultColumns.map(col => (
                 <Table.Th key={col}>
                   <Text size="xs" fw={700} ff="monospace">{col}</Text>
                 </Table.Th>
               ))}
             </Table.Tr>
           </Table.Thead>
           <Table.Tbody>
             {resultRows.map((row, i) => (
               <Table.Tr key={i}>
                 <Table.Td style={{ textAlign: 'center' }}>
                   <Text size="xs" c="dimmed">{i + 1}</Text>
                 </Table.Td>
                 {resultColumns.map(col => {
                   const val = formatCellValue(row[col]);
                   const isNull = row[col] === null || row[col] === undefined;
                   return (
                     <Table.Td key={col} style={{ maxWidth: 300 }}>
                       {isNull
                         ? <Text size="xs" c="dimmed" fs="italic">NULL</Text>
                         : (
                           <Tooltip label={val} disabled={val.length < 60} withArrow multiline w={360}>
                             <Text
                               size="xs"
                               ff={typeof row[col] === 'object' ? 'monospace' : undefined}
                               style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}
                             >
                               {val.length > 100 ? val.slice(0, 100) + '\u2026' : val}
                             </Text>
                           </Tooltip>
                         )}
                     </Table.Td>
                   );
                 })}
               </Table.Tr>
             ))}
             {resultRows.length === 0 && (
               <Table.Tr>
                 <Table.Td colSpan={resultColumns.length + 1}>
                   <Text ta="center" c="dimmed" py="md" size="sm">Query returned no rows</Text>
                 </Table.Td>
               </Table.Tr>
             )}
           </Table.Tbody>
         </Table>
       </ScrollArea>
     )}

     {/* Empty state when no query has been run */}
     {!result && !isPending && (
       <Center style={{ flex: 1 }}>
         <Stack align="center" gap="xs">
           <ThemeIcon size={48} radius="xl" color="indigo" variant="light">
             <IconCode size={24} />
           </ThemeIcon>
           <Text size="sm" fw={600} c="dimmed">Write a SQL query and press Run</Text>
           <Text size="xs" c="dimmed">
             SELECT, INSERT, UPDATE, DELETE supported. Use the Samples dropdown to get started.
           </Text>
         </Stack>
       </Center>
     )}

     {/* Save Query Modal */}
     <Modal opened={saveOpened} onClose={closeSave} title="Save Query" size="sm" centered zIndex={300}>
       <Stack gap="sm">
         <TextInput
           label="Query Name"
           placeholder="e.g. Monthly hours by resource"
           value={saveName}
           onChange={e => setSaveName(e.target.value)}
           size="sm"
         />
         <Code block fz={11} style={{ maxHeight: 120, overflow: 'auto' }}>{sql}</Code>
         <Group justify="flex-end">
           <Button variant="light" onClick={closeSave} size="xs">Cancel</Button>
           <Button onClick={handleSave} size="xs" disabled={!saveName.trim()}>Save Query</Button>
         </Group>
       </Stack>
     </Modal>

     {/* Confirm Mutation Modal */}
     <Modal opened={confirmOpened} onClose={closeConfirm} title="Confirm Write Operation" size="sm" centered zIndex={300}>
       <Stack gap="sm">
         <Alert color="orange" variant="light" icon={<IconAlertTriangle size={14} />}>
           This query will modify data. Please review carefully before executing.
         </Alert>
         <Code block fz={11} style={{ maxHeight: 160, overflow: 'auto' }}>{sql}</Code>
         <Group justify="flex-end">
           <Button variant="light" onClick={closeConfirm} size="xs">Cancel</Button>
           <Button color="orange" onClick={handleConfirmRun} size="xs">Confirm & Execute</Button>
         </Group>
       </Stack>
     </Modal>
   </Stack>
 );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TablesPage() {
 const isDark = useDarkMode();
 const qc = useQueryClient();
 const [selectedTable, setSelectedTable] = useState<string | null>(null);
 const [tableSearch, setTableSearch] = useState('');

 const { data: tables = [], isLoading, refetch } = useDbTables();

 const filteredTables = useMemo(() =>
 tables.filter(t =>
 t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
 ), [tables, tableSearch]);

 const totalRows = tables.reduce((s, t) => s + (t.row_count > 0 ? t.row_count : 0), 0);
 const selectedMeta = tables.find(t => t.table_name === selectedTable);

 const handleRefresh = () => {
 qc.invalidateQueries({ queryKey: ['admin', 'db'] });
 refetch();
 };

 return (
 <Box h="100%" className="page-enter stagger-children">
 <Group justify="space-between" mb="md" align="flex-start" className="slide-in-left">
 <Group gap="sm">
 <ThemeIcon size="xl" radius="md" color="indigo" variant="light">
 <IconDatabase size={22} />
 </ThemeIcon>
 <Box>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>Database Tables</Title>
 <Text size="sm" c="dimmed">
 Browse tables, view schema, and run SQL queries — {tables.length} tables · {totalRows.toLocaleString()} total rows
 </Text>
 </Box>
 </Group>
 <Tooltip label="Refresh table list">
 <ActionIcon variant="light" onClick={handleRefresh} loading={isLoading}>
 <IconRefresh size={16} />
 </ActionIcon>
 </Tooltip>
 </Group>

 <Group align="flex-start" gap="md" style={{ height: 'calc(100vh - 240px)' }} wrap="nowrap">

 {/* ── Left panel: table list ─────────────────────────────────────── */}
 <Paper withBorder style={{ width: 260, flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
 <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
 <TextInput
 size="xs"
 placeholder="Filter tables..."
 leftSection={<IconSearch size={12} />}
 value={tableSearch}
 onChange={e => setTableSearch(e.target.value)}
 />
 </Box>
 <ScrollArea style={{ flex: 1 }} type="auto">
 {isLoading && <LoadingSpinner variant="table" />}
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
 ? (isDark ? 'var(--mantine-color-indigo-9)' : 'var(--mantine-color-indigo-0)')
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

 {/* ── Right panel: tabs for data, schema, and SQL query ──────────── */}
 <Paper withBorder style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
 <Box p="md" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

  <Tabs defaultValue="query" keepMounted={false} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
   <Tabs.List mb="sm">
    <Tabs.Tab value="query" leftSection={<IconCode size={13} />}>
     SQL Query
    </Tabs.Tab>
    {selectedTable && (
     <>
      <Tabs.Tab value="data" leftSection={<IconTable size={13} />}>
       Data
      </Tabs.Tab>
      <Tabs.Tab value="schema" leftSection={<IconDatabase size={13} />}>
       Schema
      </Tabs.Tab>
     </>
    )}

    {/* Show selected table info on the right */}
    {selectedTable && selectedMeta && (
     <Group gap="xs" ml="auto" mr="xs">
      <ThemeIcon size="sm" color="indigo" variant="light" radius="sm">
       <IconTable size={13} />
      </ThemeIcon>
      <Text fw={700} ff="monospace" size="xs">{selectedTable}</Text>
      <Badge size="xs" variant="light" color="indigo">
       {selectedMeta.row_count.toLocaleString()} rows
      </Badge>
      <Badge size="xs" variant="light" color="gray">
       {selectedMeta.column_count} cols
      </Badge>
     </Group>
    )}
   </Tabs.List>

   <Tabs.Panel value="query" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <QueryPanel />
   </Tabs.Panel>

   {selectedTable && (
    <>
     <Tabs.Panel value="data" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <DataPanel tableName={selectedTable} />
     </Tabs.Panel>

     <Tabs.Panel value="schema">
      <SchemaPanel tableName={selectedTable} />
     </Tabs.Panel>
    </>
   )}
  </Tabs>
 </Box>
 </Paper>
 </Group>
 </Box>
 );
}
