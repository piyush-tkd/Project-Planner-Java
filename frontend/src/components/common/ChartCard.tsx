/**
 * ChartCard — a wrapper for any chart that adds:
 *   - A zoom button (⤢) that opens the chart in a fullscreen modal at 2× height
 *   - A camera button (📷) that captures the chart as a PNG and downloads it
 *
 * Usage:
 *   <ChartCard title="My Chart">
 *     <MyChart />
 *   </ChartCard>
 */
import { useRef, useCallback } from 'react';
import {
  Paper, Text, Group, ActionIcon, Modal, Box, Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMaximize, IconCamera } from '@tabler/icons-react';
import { DEEP_BLUE, FONT_FAMILY, SHADOW } from '../../brandTokens';

interface ChartCardProps {
  title: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  children: React.ReactNode;
  /** Extra content rendered to the right of the title */
  headerRight?: React.ReactNode;
  /** CSS min-height for the chart body (default 240) */
  minHeight?: number;
  withBorder?: boolean;
  padding?: string;
  /** Grid column span (ignored — layout is handled by parent) */
  colspan?: number;
  icon?: React.ReactNode;
}

// ── Snapshot helper ────────────────────────────────────────────────────────────

function captureChartSnapshot(container: HTMLDivElement | null, title: string) {
  if (!container) return;

  const svgs = Array.from(container.querySelectorAll('svg'));
  if (svgs.length === 0) {
    alert('No SVG chart found. Try a browser screenshot instead.');
    return;
  }

  // Pick the largest SVG
  const svg = svgs.reduce((best, s) => {
    const r = s.getBoundingClientRect();
    const br = best.getBoundingClientRect();
    return r.width * r.height > br.width * br.height ? s : best;
  }, svgs[0]);

  const { width, height } = svg.getBoundingClientRect();
  if (!width || !height) return;

  const cloned = svg.cloneNode(true) as SVGElement;

  // White background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  cloned.insertBefore(bg, cloned.firstChild);

  // Title text (20px offset from top)
  const titleOffset = 20;
  const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  titleEl.setAttribute('x', '12');
  titleEl.setAttribute('y', '14');
  titleEl.setAttribute('font-size', '11');
  titleEl.setAttribute('font-weight', '700');
  titleEl.setAttribute('font-family', 'system-ui, sans-serif');
  titleEl.setAttribute('fill', DEEP_BLUE);
  titleEl.textContent = title;
  cloned.insertBefore(titleEl, bg.nextSibling);

  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height + titleOffset));

  // Shift original chart content down
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(0, ${titleOffset})`);
  while (cloned.children.length > 2) {
    g.appendChild(cloned.children[2]);
  }
  cloned.appendChild(g);

  const serialised = new XMLSerializer().serializeToString(cloned);
  const blob        = new Blob([serialised], { type: 'image/svg+xml;charset=utf-8' });
  const url         = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale  = 2;
    const canvas = document.createElement('canvas');
    canvas.width  = width  * scale;
    canvas.height = (height + titleOffset) * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${title.replace(/\W+/g, '_').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.onerror = () => {
    // Fallback: download SVG
    URL.revokeObjectURL(url);
    const svgUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = svgUrl;
    a.download = `${title.replace(/\W+/g, '_').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(svgUrl);
  };
  img.src = url;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChartCard({
  title,
  subtitle,
  children,
  headerRight,
  minHeight = 240,
  withBorder = true,
  padding = 'md',
  // colspan and icon are accepted but used by parent layout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  colspan: _colspan,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  icon: _icon,
}: ChartCardProps) {
  const [zoomed, { open: openZoom, close: closeZoom }] = useDisclosure(false);
  // Two separate refs — one for the inline card, one for the modal
  const inlineRef = useRef<HTMLDivElement>(null);
  const modalRef  = useRef<HTMLDivElement>(null);

  const handleSnapshot = useCallback(() => {
    // Prefer the modal ref when zoomed (it's larger), else the inline
    const target = zoomed ? modalRef.current : inlineRef.current;
    captureChartSnapshot(target, title);
  }, [zoomed, title]);

  const headerButtons = (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      {headerRight}
      <Tooltip label="Download snapshot" withArrow fz="xs">
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleSnapshot}>
          <IconCamera size={13} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Expand" withArrow fz="xs">
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={openZoom}>
          <IconMaximize size={13} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );

  return (
    <>
      {/* ── Inline card ── */}
      <Paper
        withBorder={withBorder}
        p={padding}
        radius="md"
        className="chart-reveal"
        style={{
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          boxShadow: SHADOW.card,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = SHADOW.cardHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = SHADOW.card;
          e.currentTarget.style.transform = '';
        }}
      >
        <Group justify="space-between" mb="sm" wrap="nowrap" align="flex-start">
          <div>
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
              {title}
            </Text>
            {subtitle && (
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                {subtitle}
              </Text>
            )}
          </div>
          {headerButtons}
        </Group>
        <Box ref={inlineRef} style={{ minHeight }}>
          {children}
        </Box>
      </Paper>

      {/* ── Zoom modal ── */}
      <Modal
        opened={zoomed}
        onClose={closeZoom}
        title={
          <Group gap="xs">
            <Text fw={700} size="sm">{title}</Text>
          </Group>
        }
        size="80vw"
        centered
        radius="lg"
        overlayProps={{ blur: 2, backgroundOpacity: 0.3 }}
        styles={{ body: { paddingTop: 4, maxHeight: '80vh', overflow: 'auto' } }}
      >
        <Group justify="flex-end" mb="xs">
          <Tooltip label="Download snapshot" withArrow fz="xs">
            <ActionIcon size="sm" variant="light" color="gray" onClick={handleSnapshot}>
              <IconCamera size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Box ref={modalRef} style={{ minHeight: Math.min(minHeight * 1.8, 500) }}>
          {children}
        </Box>
      </Modal>
    </>
  );
}
