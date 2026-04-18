import {
  Modal, Stack, Select, MultiSelect, Group, Button, Text, Collapse, Divider, Alert, Skeleton, Checkbox, ScrollArea, Box, Badge, Loader,
} from '@mantine/core';
import { IconPlugConnected, IconAlertTriangle, IconSearch, IconCheck, IconDownload } from '@tabler/icons-react';
import { TextInput } from '@mantine/core';
import { useDarkMode } from '../../../hooks/useDarkMode';
import type { JiraInitiative } from '../../../api/jira';

interface JiraImportModalProps {
  opened: boolean;
  onClose: () => void;
  issueType: string;
  onIssueTypeChange: (type: string) => void;
  selectedProjects: string[];
  onSelectedProjectsChange: (projects: string[]) => void;
  allProjectsList: Array<{ key: string; name: string }>;
  showAdvanced: boolean;
  onShowAdvancedChange: (show: boolean) => void;
  jqlInput: string;
  onJqlInputChange: (jql: string) => void;
  jql: string;
  importSearch: string;
  onImportSearchChange: (search: string) => void;
  jiraProjects: JiraInitiative[];
  isLoading: boolean;
  isError: boolean;
  selectedJiraKeys: Set<string>;
  onJiraKeyToggle: (key: string) => void;
  onSelectAllImportable: () => void;
  importableProjects: JiraInitiative[];
  alreadyImportedProjects: JiraInitiative[];
  filteredImportableProjects: JiraInitiative[];
  importingCount: number;
  importedCount: number;
  importErrors: string[];
  onSearch: (projects: string[], issueType: string, jql: string) => void;
  onImport: () => void;
}

export function JiraImportModal({
  opened,
  onClose,
  issueType,
  onIssueTypeChange,
  selectedProjects,
  onSelectedProjectsChange,
  allProjectsList,
  showAdvanced,
  onShowAdvancedChange,
  jqlInput,
  onJqlInputChange,
  jql,
  importSearch,
  onImportSearchChange,
  jiraProjects,
  isLoading,
  isError,
  selectedJiraKeys,
  onJiraKeyToggle,
  onSelectAllImportable,
  importableProjects,
  alreadyImportedProjects,
  filteredImportableProjects,
  importingCount,
  importedCount,
  importErrors,
  onSearch,
  onImport,
}: JiraImportModalProps) {
  const isDark = useDarkMode();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPlugConnected size={20} color="#0052CC" />
          <Text fw={600}>Import Initiatives from Jira Roadmap</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="sm">
        {/* ── Filter controls ── */}
        <Stack gap="xs">
          {/* Issue Type + Project picker */}
          <Group gap="xs" grow>
            <Select
              label="Issue type"
              size="sm"
              data={['Initiative', 'Epic', 'Story', 'Feature', 'Theme', 'Task']}
              value={issueType}
              onChange={v => onIssueTypeChange(v ?? 'Initiative')}
              allowDeselect={false}
            />
            <MultiSelect
              label="Jira projects (leave empty for all)"
              size="sm"
              data={(allProjectsList ?? []).map(p => ({ value: p.key, label: `${p.key} — ${p.name}` }))}
              value={selectedProjects}
              onChange={onSelectedProjectsChange}
              placeholder="All projects"
              searchable
              clearable
              maxDropdownHeight={220}
            />
          </Group>

          {/* Advanced JQL toggle */}
          <Group gap="xs">
            <Button
              size="sm"
              leftSection={<IconSearch size={14} />}
              loading={isLoading}
              onClick={() => onSearch(selectedProjects, issueType, showAdvanced ? jqlInput : '')}
            >
              Search
            </Button>
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => onShowAdvancedChange(!showAdvanced)}
            >
              {showAdvanced ? 'Hide advanced JQL' : 'Advanced JQL'}
            </Button>
          </Group>

          <Collapse in={showAdvanced}>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Additional JQL filter (appended with AND). The issue type and project selections above take precedence.</Text>
              <Group gap="xs">
                <TextInput
                  style={{ flex: 1 }}
                  size="sm"
                  ff="monospace"
                  placeholder='e.g. labels = "portfolio" AND priority = "High"'
                  value={jqlInput}
                  onChange={e => onJqlInputChange(e.currentTarget.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSearch(selectedProjects, issueType, jqlInput); }}
                />
              </Group>
              {jql && (
                <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>
                  Running: {jql}
                </Text>
              )}
            </Stack>
          </Collapse>
        </Stack>

        <Divider />

        {isLoading ? (
          <Stack gap="xs">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={36} radius="sm" />
            ))}
          </Stack>
        ) : isError ? (
          <Alert color="red" icon={<IconAlertTriangle size={14} />}>
            JQL query failed. Check your syntax and try again.
          </Alert>
        ) : jiraProjects.length === 0 ? (
          <Alert color="orange" icon={<IconAlertTriangle size={14} />}>
            No results for this JQL query. Try a different issue type — for example, change{' '}
            <Text span ff="monospace" size="sm">
              "Initiative"
            </Text>
            {' '}to{' '}
            <Text span ff="monospace" size="sm">
              "Epic"
            </Text>
            .
          </Alert>
        ) : (
          <>
            {/* Stats */}
            <Group gap="xs">
              <Badge size="sm" color="blue" variant="light">
                {jiraProjects.length} found
              </Badge>
              <Badge size="sm" color="teal" variant="light">
                {importableProjects.length} available to import
              </Badge>
              {alreadyImportedProjects.length > 0 && (
                <Badge size="sm" color="gray" variant="light">
                  {alreadyImportedProjects.length} already exist
                </Badge>
              )}
            </Group>

            {importableProjects.length > 0 && (
              <>
                <Divider />
                {/* Search filter */}
                <TextInput
                  placeholder="Search projects by name or key…"
                  leftSection={<IconSearch size={14} />}
                  value={importSearch}
                  onChange={e => onImportSearchChange(e.currentTarget.value)}
                  size="sm"
                />
                {/* Select all / deselect all */}
                <Group justify="space-between">
                  <Checkbox
                    label={
                      <Text size="sm" fw={600}>
                        Select all
                        {importSearch.trim()
                          ? ` (${filteredImportableProjects.length} of ${importableProjects.length})`
                          : ` (${importableProjects.length})`}
                      </Text>
                    }
                    checked={
                      filteredImportableProjects.length > 0 &&
                      filteredImportableProjects.every(p => selectedJiraKeys.has(p.key))
                    }
                    indeterminate={
                      filteredImportableProjects.some(p => selectedJiraKeys.has(p.key)) &&
                      !filteredImportableProjects.every(p => selectedJiraKeys.has(p.key))
                    }
                    onChange={onSelectAllImportable}
                  />
                  {selectedJiraKeys.size > 0 && (
                    <Badge size="sm" color="indigo" variant="filled">
                      {selectedJiraKeys.size} selected
                    </Badge>
                  )}
                </Group>

                {/* Importable initiative list */}
                <ScrollArea.Autosize mah={320}>
                  <Stack gap={4}>
                    {filteredImportableProjects.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        No initiatives match "{importSearch}"
                      </Text>
                    ) : null}
                    {filteredImportableProjects.map(jp => (
                      <Box
                        key={jp.key}
                        p="xs"
                        style={{
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: selectedJiraKeys.has(jp.key)
                            ? (isDark ? 'var(--mantine-color-indigo-9)' : 'var(--mantine-color-indigo-0)')
                            : 'transparent',
                        }}
                        onClick={() => onJiraKeyToggle(jp.key)}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <Checkbox
                            checked={selectedJiraKeys.has(jp.key)}
                            onChange={() => onJiraKeyToggle(jp.key)}
                            size="sm"
                            onClick={e => e.stopPropagation()}
                          />
                          <Badge size="sm" variant="light" color="blue" ff="monospace" style={{ flexShrink: 0 }}>
                            {jp.key}
                          </Badge>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {jp.name}
                            </Text>
                            <Group gap={6} mt={2}>
                              {jp.status && (
                                <Badge size="xs" variant="dot" color="gray">
                                  {jp.status}
                                </Badge>
                              )}
                              {jp.startDate && (
                                <Text size="xs" c="dimmed">
                                  Start: {jp.startDate}
                                </Text>
                              )}
                              {jp.dueDate && (
                                <Text size="xs" c="dimmed">
                                  Due: {jp.dueDate}
                                </Text>
                              )}
                              {jp.assignee && (
                                <Text size="xs" c="dimmed">
                                  👤 {jp.assignee}
                                </Text>
                              )}
                            </Group>
                          </Box>
                        </Group>
                      </Box>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </>
            )}

            {/* Already existing projects */}
            {alreadyImportedProjects.length > 0 && (
              <>
                <Divider label="Already in Portfolio Planner" labelPosition="center" />
                <ScrollArea.Autosize mah={120}>
                  <Stack gap={2}>
                    {alreadyImportedProjects.map(jp => (
                      <Group key={jp.key} gap="sm" p="xs" style={{ opacity: 0.5 }}>
                        <IconCheck size={14} color="var(--mantine-color-green-6)" />
                        <Badge size="sm" variant="light" color="gray" ff="monospace">
                          {jp.key}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {jp.name}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </>
            )}

            {/* Import progress */}
            {importingCount > 0 && importedCount < importingCount && importErrors.length === 0 && (
              <Group gap="sm">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  Importing {importedCount} of {importingCount}...
                </Text>
              </Group>
            )}

            {/* Import errors */}
            {importErrors.length > 0 && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {importErrors.length} project(s) failed:
                  </Text>
                  {importErrors.map((e, i) => (
                    <Text key={i} size="xs" ff="monospace">
                      {e}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            {/* Action buttons */}
            <Group justify="flex-end">
              <Button variant="light" onClick={onClose} size="sm">
                Cancel
              </Button>
              <Button
                leftSection={<IconDownload size={14} />}
                onClick={onImport}
                loading={importingCount > 0 && importedCount < importingCount && importErrors.length === 0}
                disabled={selectedJiraKeys.size === 0}
                size="sm"
              >
                Import {selectedJiraKeys.size > 0 ? `${selectedJiraKeys.size} Project${selectedJiraKeys.size !== 1 ? 's' : ''}` : ''}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
