import { Center, Stack, Text } from '@mantine/core';
import { AQUA, AQUA_TINTS, DEEP_BLUE, GRAY_100 } from '../../brandTokens';

/* ── Inject keyframes once via <style> ─────────────────────────────── */
const STYLE_ID = 'bg-loader-keyframes';
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes bg-pulse {
      0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @keyframes bg-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bg-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes bg-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
ensureKeyframes();

const AQUA_LIGHT = AQUA_TINTS[10]; // #EAFAFB

/* ── Variant: Dots ─────────────────────────────────────────────────── */
function DotLoader({ size = 10 }: { size?: number }) {
  const dots = [DEEP_BLUE, AQUA, DEEP_BLUE];
  return (
    <div style={{ display: 'flex', gap: size * 0.8, alignItems: 'center' }}>
      {dots.map((color, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: color,
            animation: 'bg-pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`
          }}
        />
      ))}
    </div>
  );
}

/* ── Variant: Ring ─────────────────────────────────────────────────── */
function RingLoader({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${AQUA_LIGHT}`,
        borderTopColor: AQUA,
        borderRightColor: DEEP_BLUE,
        animation: 'bg-rotate 0.9s linear infinite'
      }}
    />
  );
}

/* ── Variant: Skeleton bar ─────────────────────────────────────────── */
function SkeletonBar({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${AQUA_LIGHT} 25%, #f0fafa 50%, ${AQUA_LIGHT} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'bg-shimmer 1.6s ease-in-out infinite'
      }}
    />
  );
}

/* ── Skeleton presets ──────────────────────────────────────────────── */
function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', padding: '0 4px' }}>
      {/* header */}
      <div style={{ display: 'flex', gap: 16 }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBar key={c} width={`${100 / cols}%`} height={12} />
        ))}
      </div>
      <div style={{ height: 1, background: GRAY_100 }} />
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, opacity: 1 - r * 0.12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBar key={c} width={`${100 / cols}%`} height={10} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)`, gap: 16, width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            border: '1px solid #e9ecef',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <SkeletonBar width="50%" height={10} />
          <SkeletonBar width="70%" height={20} />
          <SkeletonBar width="40%" height={8} />
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', animation: 'bg-fade-in 0.3s ease-out' }}>
      <CardsSkeleton count={4} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 16, height: 200 }}>
          <SkeletonBar width="30%" height={12} />
          <div style={{ marginTop: 16 }}><SkeletonBar width="100%" height={140} /></div>
        </div>
        <div style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 16, height: 200 }}>
          <SkeletonBar width="30%" height={12} />
          <div style={{ marginTop: 16 }}><SkeletonBar width="100%" height={140} /></div>
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', animation: 'bg-fade-in 0.3s ease-out' }}>
      <CardsSkeleton count={3} />
      <div style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 20, height: 260 }}>
        <SkeletonBar width="25%" height={12} />
        <div style={{ marginTop: 16 }}><SkeletonBar width="100%" height={200} /></div>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 600, animation: 'bg-fade-in 0.3s ease-out' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBar width={80 + i * 20} height={10} />
          <SkeletonBar width="100%" height={36} />
        </div>
      ))}
      <SkeletonBar width={120} height={36} />
    </div>
  );
}

/* ── Main LoadingSpinner (default — backwards-compatible) ──────────── */
export type LoadingVariant = 'default' | 'table' | 'dashboard' | 'chart' | 'cards' | 'form' | 'inline';

interface LoadingSpinnerProps {
  /** Which skeleton/loader style to show */
  variant?: LoadingVariant;
  /** Optional message below the loader */
  message?: string;
  /** For inline variant — compact without min-height */
  inline?: boolean;
}

export default function LoadingSpinner({ variant = 'default', message, inline }: LoadingSpinnerProps) {
  if (variant === 'inline' || inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <DotLoader size={6} />
        {message && <Text size="xs" c="dimmed">{message}</Text>}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div style={{ minHeight: 200, padding: 16, animation: 'bg-fade-in 0.3s ease-out' }}>
        <TableSkeleton />
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div style={{ minHeight: 300, padding: 16 }}>
        <DashboardSkeleton />
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div style={{ minHeight: 300, padding: 16 }}>
        <ChartSkeleton />
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div style={{ minHeight: 120, padding: 16, animation: 'bg-fade-in 0.3s ease-out' }}>
        <CardsSkeleton />
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <Center style={{ minHeight: 200, animation: 'bg-fade-in 0.3s ease-out' }}>
        <FormSkeleton />
      </Center>
    );
  }

  /* ── Default: branded ring + dots ──────────────────────────────── */
  return (
    <Center style={{ minHeight: 240 }}>
      <Stack align="center" gap="md" style={{ animation: 'bg-fade-in 0.3s ease-out' }}>
        <RingLoader size={44} />
        <DotLoader />
        {message && (
          <Text size="sm" c="dimmed" ta="center">
            {message}
          </Text>
        )}
      </Stack>
    </Center>
  );
}

/* ── Named exports for direct use ──────────────────────────────────── */
export { DotLoader, RingLoader, SkeletonBar, TableSkeleton, CardsSkeleton, DashboardSkeleton, ChartSkeleton, FormSkeleton };
