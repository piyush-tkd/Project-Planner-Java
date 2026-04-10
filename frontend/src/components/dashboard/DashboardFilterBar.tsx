/**
 * DashboardFilterBar — Filter bar component that connects to DashboardStore.
 * Renders at the top of the dashboard canvas.
 */
import {
  Paper,
  Group,
  Button,
  MultiSelect,
  TextInput,
  Badge,
  Alert,
  ActionIcon,
  Collapse,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import { useDashboard } from '../../store/dashboardStore';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA } from '../../brandTokens';

interface DashboardFilterBarProps {
  isVisible: boolean;
  onToggle: () => void;
}

const PROJECT_STATUS_OPTIONS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export function DashboardFilterBar({ isVisible, onToggle }: DashboardFilterBarProps) {
  const {
    globalFilters,
    updateGlobalFilter,
    clearGlobalFilters,
    crossFilter,
    clearCrossFilter,
  } = useDashboard();

  const isDarkMode = useDarkMode();

  // Count active filters
  const activeFilterCount = Object.values(globalFilters).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Date) return v !== null;
    return v !== undefined && v !== null && v !== '';
  }).length;

  const dateRange = globalFilters.dateRange ?? [null, null];

  return (
    <>
      {/* Toggle Button */}
      <Group justify="space-between" mb="md">
        <Group>
          <Button
            variant="light"
            onClick={onToggle}
            rightSection={isVisible ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          >
            Filters
          </Button>
          {activeFilterCount > 0 && (
            <Badge color="teal" variant="filled">
              {activeFilterCount} active
            </Badge>
          )}
        </Group>
      </Group>

      {/* Cross-filter Alert */}
      {crossFilter && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="blue"
          mb="md"
          withCloseButton
          onClose={clearCrossFilter}
        >
          <Group justify="space-between">
            <Text size="sm">
              Cross-filter active: {crossFilter.dimension} = {crossFilter.value}
            </Text>
            <ActionIcon
              size="sm"
              color="blue"
              variant="transparent"
              onClick={clearCrossFilter}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Alert>
      )}

      {/* Filters Panel */}
      <Collapse in={isVisible}>
        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f9f9f9',
            borderLeft: `4px solid ${AQUA}`,
          }}
          mb="md"
        >
          <Stack gap="md">
            {/* Date Range */}
            <Group grow>
              <DatePickerInput
                label="Start Date"
                placeholder="Pick start date"
                value={dateRange[0]}
                onChange={(date) =>
                  updateGlobalFilter('dateRange', [date, dateRange[1]])
                }
                clearable
              />
              <DatePickerInput
                label="End Date"
                placeholder="Pick end date"
                value={dateRange[1]}
                onChange={(date) =>
                  updateGlobalFilter('dateRange', [dateRange[0], date])
                }
                clearable
              />
            </Group>

            {/* Project Status */}
            <MultiSelect
              label="Project Status"
              placeholder="Select statuses"
              data={PROJECT_STATUS_OPTIONS}
              value={globalFilters.projectStatus || []}
              onChange={(values) =>
                updateGlobalFilter('projectStatus', values)
              }
              clearable
              searchable
            />

            {/* Priority */}
            <MultiSelect
              label="Priority"
              placeholder="Select priorities"
              data={PRIORITY_OPTIONS}
              value={globalFilters.priorities || []}
              onChange={(values) =>
                updateGlobalFilter('priorities', values)
              }
              clearable
              searchable
            />

            {/* Owner Username */}
            <TextInput
              label="Owner Username"
              placeholder="Filter by owner"
              value={globalFilters.ownerUsername || ''}
              onChange={(e) =>
                updateGlobalFilter('ownerUsername', e.currentTarget.value)
              }
            />

            {/* Clear All Button */}
            <Group justify="flex-end">
              {activeFilterCount > 0 && (
                <Button
                  variant="default"
                  onClick={clearGlobalFilters}
                  size="sm"
                >
                  Clear All Filters
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      </Collapse>
    </>
  );
}
