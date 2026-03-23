import { useState, useMemo } from 'react';
import {
  Title, Stack, Table, Text, Badge, Group, Select, TextInput, Button,
  Tooltip, Card, Pagination,
} from '@mantine/core';
import { IconSearch, IconClock, IconUser } from '@tabler/icons-react';
import { useAuditLog } from '../../api/audit';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CsvToolbar from '../../components/common/CsvToolbar';
import type { CsvColumnDef } from '../../utils/csv';
import type { AuditLogEntry } from '../../api/audit';

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  IMPORT: 'violet',
};

const CSV_COLUMNS: CsvColumnDef<AuditLogEntry>[] = [
  { key: 'changedAt',   header: 'Timestamp' },
  { key: 'changedBy',   header: 'User' },
  { key: 'entityType',  header: 'Entity Type' },
  { key: 'entityName',  header: 'Entity Name' },
  { key: 'action',      header: 'Action' },
  { key: 'details',     header: 'Details' },
];

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function AuditLogPage() {
  const { data = [], isLoading } = useAuditLog(200);

  const [search,     setSearch]     = useState('');
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const pageSize = 50;

  const userOptions = useMemo(() => {
    const users = [...new Set(data.map(e => e.changedBy))].sort();
    return users.map(u => ({ value: u, label: u }));
  }, [data]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(data.map(e => e.entityType))].sort();
    return types.map(t => ({ value: t, label: t }));
  }, [data]);

  const filtered = useMemo(() => {
    let list = data;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        (e.entityName ?? '').toLowerCase().includes(q) ||
        e.changedBy.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q),
      );
    }
    if (userFilter) list = list.filter(e => e.changedBy === userFilter);
    if (typeFilter) list = list.filter(e => e.entityType === typeFilter);
    if (actionFilter) list = list.filter(e => e.action === actionFilter);
    return list;
  }, [data, search, userFilter, typeFilter, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleUserFilter = (v: string | null) => { setUserFilter(v); setPage(1); };
  const handleTypeFilter = (v: string | null) => { setTypeFilter(v); setPage(1); };
  const handleActionFilter = (v: string | null) => { setActionFilter(v); setPage(1); };

  const hasFilters = search || userFilter || typeFilter || actionFilter;

  if (isLoading) return <LoadingSpinner variant="table" message="Loading audit log..." />;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Stack className="page-enter stagger-children">
      <Group justify="space-between" align="flex-end" className="slide-in-left">
        <Title order={2}>Audit Trail</Title>
        <CsvToolbar
          data={filtered as unknown as Record<string, unknown>[]}
          columns={CSV_COLUMNS as unknown as CsvColumnDef<Record<string, unknown>>[]}
          filename={`audit-log-${today}`}
          exportOnly
        />
      </Group>

      <Card withBorder p="sm">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search name, user, type…"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => handleSearch(e.currentTarget.value)}
            style={{ flex: '1 1 200px', maxWidth: 280 }}
            size="sm"
          />
          <Select
            placeholder="All Users"
            data={userOptions}
            value={userFilter}
            onChange={handleUserFilter}
            clearable
            searchable
            leftSection={<IconUser size={14} />}
            size="sm"
            style={{ flex: '1 1 160px', maxWidth: 220 }}
          />
          <Select
            placeholder="All Entity Types"
            data={typeOptions}
            value={typeFilter}
            onChange={handleTypeFilter}
            clearable
            size="sm"
            style={{ flex: '1 1 150px', maxWidth: 200 }}
          />
          <Select
            placeholder="All Actions"
            data={['CREATE', 'UPDATE', 'DELETE', 'IMPORT'].map(a => ({ value: a, label: a }))}
            value={actionFilter}
            onChange={handleActionFilter}
            clearable
            size="sm"
            style={{ flex: '1 1 130px', maxWidth: 160 }}
          />
          {hasFilters && (
            <Button variant="subtle" color="gray" size="sm"
              onClick={() => { setSearch(''); setUserFilter(null); setTypeFilter(null); setActionFilter(null); setPage(1); }}>
              Clear
            </Button>
          )}
          <Text size="sm" c="dimmed" ml="auto">
            {filtered.length > pageSize
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`
              : `${filtered.length} of ${data.length}`} entries
          </Text>
        </Group>
      </Card>

      <Table.ScrollContainer minWidth={800}>
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Timestamp</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>User</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Action</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Entity Type</Table.Th>
              <Table.Th>Entity</Table.Th>
              <Table.Th>Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedRows.map(entry => (
              <Table.Tr key={entry.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  <Group gap={4} wrap="nowrap">
                    <IconClock size={12} color="var(--mantine-color-dimmed)" />
                    <Text size="xs">{formatTs(entry.changedAt)}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{entry.changedBy}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    variant="light"
                    color={ACTION_COLOR[entry.action] ?? 'gray'}
                  >
                    {entry.action}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{entry.entityType}</Text>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={`ID: ${entry.entityId ?? '—'}`} withArrow disabled={!entry.entityId}>
                    <Text size="sm">{entry.entityName ?? '—'}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" truncate style={{ maxWidth: 300 }}>
                    {entry.details ?? '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">No audit entries match the current filters</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
