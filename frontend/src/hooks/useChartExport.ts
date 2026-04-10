import { useRef, useState, useCallback } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { toPng } from 'html-to-image';
import { DARK_BG } from '../brandTokens';

export function useChartExport(defaultTitle = 'chart') {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const computedColorScheme = useComputedColorScheme('light');

  const exportChart = useCallback(async (title?: string) => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: computedColorScheme === 'dark' ? DARK_BG : '#ffffff',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${(title ?? defaultTitle).replace(/\s+/g, '_')}.png`;
      a.click();
    } catch (err) {
      console.error('Chart export failed', err);
    } finally {
      setExporting(false);
    }
  }, [defaultTitle, computedColorScheme]);

  return { chartRef, exportChart, exporting };
}
