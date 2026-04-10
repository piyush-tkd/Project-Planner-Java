import React, { useEffect, useState } from 'react';
import { Breadcrumbs, Anchor, Tabs, ActionIcon, Tooltip, Text } from '@mantine/core';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFavoritesContext } from '../../context/FavoritesContext';
import styles from './PPPageLayout.module.css';
import { COLOR_WARNING } from '../../brandTokens';
import { getBreadcrumbs } from '../../utils/routeBreadcrumbs';

export interface PPPageLayoutBreadcrumb {
  label: string;
  href?: string;
}

export interface PPPageLayoutTab {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface PPPageLayoutProps {
  /** Breadcrumb items. Last item is the current page (non-clickable). */
  breadcrumbs?: PPPageLayoutBreadcrumb[];
  /** Page title */
  title: string;
  /** Optional subtitle beneath the title */
  subtitle?: string;
  /** Action buttons rendered right-aligned in the header */
  actions?: React.ReactNode;
  /** When true, shows a star/favourite toggle in the page header (default true) */
  showFavorite?: boolean;
  /** Tab items for pages with multiple views */
  tabs?: PPPageLayoutTab[];
  /** Currently active tab value */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (value: string) => void;
  /** Filter bar rendered between tabs and main content */
  filterBar?: React.ReactNode;
  /** Page content */
  children: React.ReactNode;
  /** Whether the page is loading — shows skeleton placeholders */
  loading?: boolean;
  /** Number of skeleton rows to render when loading (default 4) */
  skeletonRows?: number;
  /** Whether to play the page fade-in animation (default true) */
  animate?: boolean;
  /** Max-width applied to the container (default '100%') */
  maxWidth?: string | number;
  /**
   * When provided, renders a small "Last synced X ago" line below the subtitle.
   * Pass the timestamp of the most recent data fetch (e.g. from useQuery dataUpdatedAt).
   */
  dataUpdatedAt?: number;
}

/** Format a timestamp as "X minutes ago" / "X hours ago" / "just now" */
function useTimeAgo(ts: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!ts) { setLabel(null); return; }
    const compute = () => {
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 10)         return 'just now';
      if (diff < 60)         return `${diff}s ago`;
      if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 30_000);
    return () => clearInterval(id);
  }, [ts]);

  return label;
}

/** Shimmer skeleton shown when loading=true */
function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.skeletonContainer}>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeleton} ${styles.skeletonSubtitle}`} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
      ))}
    </div>
  );
}

/**
 * PPPageLayout — universal page structure wrapper (DL-3).
 *
 * Enforces consistent layout: breadcrumb → header → optional tabs
 * → optional filter bar → content area.
 *
 * Usage:
 * ```tsx
 * <PPPageLayout title="Projects" subtitle="All active projects" actions={<Button>New</Button>}>
 *   <ProjectsTable />
 * </PPPageLayout>
 * ```
 */
export function PPPageLayout({
  breadcrumbs,
  title,
  subtitle,
  actions,
  showFavorite = true,
  tabs,
  activeTab,
  onTabChange,
  filterBar,
  children,
  loading = false,
  skeletonRows = 4,
  animate = true,
  maxWidth = '100%',
  dataUpdatedAt,
}: PPPageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isFavorite, toggle } = useFavoritesContext();
  const pagePath = location.pathname;
  const starred = isFavorite(pagePath);
  const timeAgo = useTimeAgo(dataUpdatedAt);

  // Auto-derive breadcrumbs from route if caller didn't provide them
  const resolvedBreadcrumbs = breadcrumbs ?? getBreadcrumbs(pagePath);

  const containerClass = [
    styles.pageContainer,
    !animate ? styles.noAnimate : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass} style={{ maxWidth }}>
      {/* Breadcrumbs */}
      {resolvedBreadcrumbs && resolvedBreadcrumbs.length > 0 && (
        <div className={styles.breadcrumb}>
          <Breadcrumbs separator="/">
            {resolvedBreadcrumbs.map((crumb, i) => {
              const isLast = i === resolvedBreadcrumbs.length - 1;
              if (isLast) {
                return (
                  <span key={i} className={styles.breadcrumbCurrent}>
                    {crumb.label}
                  </span>
                );
              }
              return (
                <Anchor
                  key={i}
                  className={styles.breadcrumbLink}
                  onClick={() => crumb.href && navigate(crumb.href)}
                  style={{ textDecoration: 'none' }}
                >
                  {crumb.label}
                </Anchor>
              );
            })}
          </Breadcrumbs>
        </div>
      )}

      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {showFavorite && (
              <Tooltip
                label={starred ? 'Remove from Favorites' : 'Add to Favorites'}
                withArrow
                position="right"
              >
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  className={styles.starBtn}
                  aria-label={starred ? 'Unstar page' : 'Star page'}
                  onClick={() => toggle(pagePath, title)}
                  style={{
                    color: starred ? COLOR_WARNING : 'var(--pp-text-muted)',
                    opacity: starred ? 1 : 0.45,
                    transition: 'color 150ms, opacity 150ms, transform 150ms',
                    transform: starred ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {starred ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {timeAgo && (
            <Text size="xs" c="dimmed" style={{ opacity: 0.55 }}>
              Last synced: {timeAgo}
            </Text>
          )}
        </div>
        {actions && <div className={styles.headerActions}>{actions}</div>}
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className={styles.tabs}>
          <Tabs
            value={activeTab}
            onChange={(v) => v && onTabChange?.(v)}
            variant="pills"
            radius="md"
          >
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
      )}

      {/* Filter bar */}
      {filterBar && <div className={styles.filterBar}>{filterBar}</div>}

      {/* Content / skeleton */}
      <div className={styles.content}>
        {loading ? <PageSkeleton rows={skeletonRows} /> : children}
      </div>
    </div>
  );
}

export default PPPageLayout;
