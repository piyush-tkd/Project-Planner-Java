import { useState, useMemo } from 'react';
import { PPPageLayout } from '../components/pp';
import {
  Text,
  Stack,
  Group,
  Button,
  Badge,
  Paper,
  Box,
  Skeleton,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { AQUA, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSprints } from '../api/sprints';
import { useReleases } from '../api/releases';
import { useHolidays } from '../api/holidays';

export default function CalendarHubPage() {
  const isDark = useDarkMode();
  const cellBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)';
  const gridBg     = isDark ? 'var(--mantine-color-dark-7)'    : '#fff';
  const emptyBg    = isDark ? 'rgba(255,255,255,0.02)'         : 'rgba(0,0,0,0.018)';
  const todayBg    = AQUA;
  const dayNumColor = (isCurrentDate: boolean) =>
    isCurrentDate ? '#fff' : isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE;

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear]   = useState(new Date().getFullYear());
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(['Sprints', 'Releases', 'Holidays', 'Code Freeze'])
  );

  const { data: sprints = [], isLoading: sprintsLoading } = useSprints();
  const { data: releases = [], isLoading: releasesLoading } = useReleases();
  const { data: holidays = [], isLoading: holidaysLoading } = useHolidays(currentYear);

  const isLoading = sprintsLoading || releasesLoading || holidaysLoading;

  const today = new Date();
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentYear, currentMonth, i));
    return days;
  }, [currentMonth, currentYear, daysInMonth, startingDayOfWeek]);

  const toggleLayer = (layer: string) => {
    const newLayers = new Set(activeLayers);
    if (newLayers.has(layer)) newLayers.delete(layer);
    else newLayers.add(layer);
    setActiveLayers(newLayers);
  };

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const layerColors: Record<string, string> = {
    Sprints: COLOR_BLUE_STRONG,
    Releases: '#9333ea',
    'Code Freeze': COLOR_ERROR_DARK,
    Holidays: COLOR_WARNING,
  };

  // Check if a date falls within or on the boundary of a sprint
  const getEventsForDate = (date: Date): { layer: string; event: string; color: string }[] => {
    const events: { layer: string; event: string; color: string }[] = [];
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Sprints
    if (activeLayers.has('Sprints')) {
      for (const s of sprints) {
        if (s.startDate === iso) {
          events.push({ layer: 'Sprints', event: `▶ ${s.name}`, color: layerColors['Sprints'] });
        } else if (s.endDate === iso) {
          events.push({ layer: 'Sprints', event: `■ ${s.name}`, color: layerColors['Sprints'] });
        } else if (s.requirementsLockInDate === iso) {
          events.push({ layer: 'Sprints', event: `🔒 Req Lock: ${s.name}`, color: COLOR_VIOLET });
        }
      }
    }

    // Releases
    if (activeLayers.has('Releases')) {
      for (const r of releases) {
        if (r.releaseDate === iso) {
          events.push({ layer: 'Releases', event: `🚀 ${r.name}`, color: layerColors['Releases'] });
        }
      }
    }

    // Code Freeze
    if (activeLayers.has('Code Freeze')) {
      for (const r of releases) {
        if (r.codeFreezeDate === iso) {
          events.push({ layer: 'Code Freeze', event: `❄ Freeze: ${r.name}`, color: layerColors['Code Freeze'] });
        }
      }
    }

    // Holidays
    if (activeLayers.has('Holidays')) {
      for (const h of holidays) {
        if (h.holidayDate === iso) {
          events.push({ layer: 'Holidays', event: `🎉 ${h.name}`, color: layerColors['Holidays'] });
        }
      }
    }

    return events;
  };

  return (
    <PPPageLayout
      title="Strategic Calendar"
      subtitle="Unified view of sprints, releases, code freezes, and holidays"
      animate
    >

      {/* Layer Toggle Buttons */}
      <Group gap="sm">
        {Object.entries(layerColors).map(([layer, color]) => (
          <Button
            key={layer}
            variant={activeLayers.has(layer) ? 'filled' : 'light'}
            size="sm"
            onClick={() => toggleLayer(layer)}
            style={{
              background: activeLayers.has(layer) ? color : undefined,
              color: activeLayers.has(layer) ? 'white' : color,
              borderColor: color,
            }}
          >
            {layer}
          </Button>
        ))}
        {isLoading && <Skeleton height={28} width={80} radius="sm" />}
      </Group>

      {/* Month Navigation */}
      <Group justify="space-between" align="center">
        <Button variant="subtle" size="sm" leftSection={<IconChevronLeft size={18} />}
          onClick={prevMonth} style={{ fontFamily: FONT_FAMILY }}>
          Previous
        </Button>
        <Text fw={600} size="lg" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          {monthName}
        </Text>
        <Button variant="subtle" size="sm" rightSection={<IconChevronRight size={18} />}
          onClick={nextMonth} style={{ fontFamily: FONT_FAMILY }}>
          Next
        </Button>
      </Group>

      {/* Calendar Grid */}
      <Paper radius="md" withBorder style={{ background: gridBg, overflow: 'hidden' }}>
        {/* Day header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: cellBorder,
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <div key={day} style={{
              padding: '10px 8px',
              textAlign: 'center',
              borderRight: i < 6 ? cellBorder : 'none',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(12,35,64,0.03)',
            }}>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, color: isDark ? 'rgba(255,255,255,0.5)' : DEEP_BLUE }}>
                {day}
              </Text>
            </div>
          ))}
        </div>

        {/* Calendar day cells — 7-col grid, no gaps, shared borders */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
        }}>
          {calendarDays.map((date, idx) => {
            const col        = idx % 7;
            const events     = date ? getEventsForDate(date) : [];
            const isCurrentDate = date ? isToday(date) : false;
            const isLastRow  = idx >= calendarDays.length - 7;

            return (
              <div key={idx} style={{
                padding: '6px 8px',
                borderRight:  col < 6 ? cellBorder : 'none',
                borderBottom: !isLastRow ? cellBorder : 'none',
                minHeight: '90px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isCurrentDate
                  ? todayBg
                  : date
                  ? 'transparent'
                  : emptyBg,
              }}>
                {date && (
                  <>
                    <Text
                      size="sm"
                      fw={isCurrentDate ? 700 : 500}
                      style={{
                        color: dayNumColor(isCurrentDate),
                        lineHeight: 1.4,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                    <Stack gap={2} mt={4}>
                      {events.map((evt, ei) => (
                        <Badge
                          key={ei}
                          size="xs"
                          variant="light"
                          style={{
                            fontSize: '9px',
                            height: 'auto',
                            padding: '2px 5px',
                            background: `${evt.color}25`,
                            color: evt.color,
                            border: `1px solid ${evt.color}50`,
                            whiteSpace: 'normal',
                            textAlign: 'left',
                            lineHeight: 1.4,
                          }}
                        >
                          {evt.event}
                        </Badge>
                      ))}
                    </Stack>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Paper>

      {/* Legend */}
      <Group gap="md" pt="md">
        <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE }}>Legend:</Text>
        {Object.entries(layerColors).map(([layer, color]) => (
          <Group key={layer} gap={6}>
            <Box style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }} />
            <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{layer}</Text>
          </Group>
        ))}
      </Group>

      {/* Data summary */}
      {!isLoading && (
        <Group gap="xl">
          <Text size="xs" c="dimmed">{sprints.length} sprint{sprints.length !== 1 ? 's' : ''} loaded</Text>
          <Text size="xs" c="dimmed">{releases.length} release{releases.length !== 1 ? 's' : ''} loaded</Text>
          <Text size="xs" c="dimmed">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''} loaded</Text>
        </Group>
      )}
    </PPPageLayout>
  );
}
