import { useState } from 'react';
import { Button, Loader, Tooltip } from '@mantine/core';
import { IconFileSpreadsheet } from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';
import { AQUA } from '../../brandTokens';

export default function ExportPortfolioButton() {
  const { data: projects, isLoading: projLoading } = useProjects();
  const { data: resources, isLoading: resLoading } = useResources();
  const { data: pods, isLoading: podLoading } = usePods();
  const [exporting, setExporting] = useState(false);

  const isLoading = projLoading || resLoading || podLoading || exporting;

  const handleExport = async () => {
    setExporting(true);
    try {
      // Dynamic import of SheetJS
      const XLSX = await import('xlsx');

      const wb = XLSX.utils.book_new();

      // Projects sheet
      if (projects?.length) {
        const projData = projects.map((p: any) => ({
          'Name': p.name,
          'Priority': p.priority || '—',
          'Status': p.status || '—',
          'Owner': p.owner || '—',
          'Target Date': p.targetDate ?? '—',
          'Duration (months)': p.durationMonths ?? '—',
          'Client': p.client ?? '—',
        }));
        const ws = XLSX.utils.json_to_sheet(projData);
        XLSX.utils.book_append_sheet(wb, ws, 'Projects');
      }

      // Resources sheet
      if (resources?.length) {
        const resData = resources.map((r: any) => ({
          'Name': r.name || '—',
          'Role': r.role || '—',
          'Location': r.location || '—',
          'POD': r.podAssignment?.podName ?? '—',
          'Active': r.active ? 'Yes' : 'No',
          'Counts in Capacity': r.countsInCapacity ? 'Yes' : 'No',
        }));
        const ws = XLSX.utils.json_to_sheet(resData);
        XLSX.utils.book_append_sheet(wb, ws, 'Resources');
      }

      // PODs sheet
      if (pods?.length) {
        const podData = pods.map((p: any) => ({
          'Name': p.name || '—',
          'Complexity Multiplier': p.complexityMultiplier ?? '—',
          'Active': p.active ? 'Yes' : 'No',
          'Description': p.description ?? '—',
        }));
        const ws = XLSX.utils.json_to_sheet(podData);
        XLSX.utils.book_append_sheet(wb, ws, 'PODs');
      }

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `portfolio-${date}.xlsx`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Tooltip label="Export portfolio to Excel" position="bottom">
      <Button
        variant="light"
        size="xs"
        leftSection={isLoading ? <Loader size={12} /> : <IconFileSpreadsheet size={14} />}
        onClick={handleExport}
        disabled={isLoading || !projects?.length}
        style={{ color: AQUA }}
      >
        Export
      </Button>
    </Tooltip>
  );
}
