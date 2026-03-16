import { useMemo } from 'react';
import { useTimeline } from '../api/timeline';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function useMonthLabels() {
  const { data: timeline, isLoading } = useTimeline();

  const monthLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    if (!timeline) {
      for (let i = 1; i <= 12; i++) {
        labels[i] = `M${i}`;
      }
      return labels;
    }

    if (timeline.monthLabels) {
      for (const [k, v] of Object.entries(timeline.monthLabels)) {
        labels[Number(k)] = v;
      }
      return labels;
    }

    const startMonthIdx = timeline.startMonth - 1;
    const startYear = timeline.startYear;

    for (let i = 1; i <= 12; i++) {
      const mIdx = (startMonthIdx + i - 1) % 12;
      const year = startYear + Math.floor((startMonthIdx + i - 1) / 12);
      const shortYear = String(year).slice(2);
      labels[i] = `${MONTH_NAMES[mIdx]}-${shortYear}`;
    }

    return labels;
  }, [timeline]);

  const currentMonthIndex = timeline?.currentMonthIndex ?? 1;

  const workingHoursPerMonth = useMemo(() => {
    const hours: Record<number, number> = {};
    if (timeline?.workingHours) {
      for (const [k, v] of Object.entries(timeline.workingHours)) {
        const monthIdx = Number(k.replace('M', ''));
        if (!isNaN(monthIdx)) hours[monthIdx] = v;
      }
    }
    // Default 160 hours for any missing month
    for (let i = 1; i <= 12; i++) {
      if (!hours[i]) hours[i] = 160;
    }
    return hours;
  }, [timeline]);

  return { monthLabels, currentMonthIndex, workingHoursPerMonth, isLoading };
}
