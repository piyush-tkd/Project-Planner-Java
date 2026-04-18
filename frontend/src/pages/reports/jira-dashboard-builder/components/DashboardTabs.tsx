import { ScrollArea, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE_HEX, DEEP_BLUE_TINTS, FONT_FAMILY, SURFACE_LIGHT } from '../../../../brandTokens';
import { JiraDashboardConfig } from '../../../../api/jira';

interface DashboardTabsProps {
  dark: boolean;
  dashboards: JiraDashboardConfig[];
  activeDashId: number | null;
  dirty: boolean;
  onLoadDashboard: (dashboard: JiraDashboardConfig) => void;
  onNewDashboard: () => void;
}

export function DashboardTabs({
  dark,
  dashboards,
  activeDashId,
  dirty,
  onLoadDashboard,
  onNewDashboard,
}: DashboardTabsProps) {
  if (dashboards.length === 0) return null;

  return (
    <ScrollArea scrollbarSize={4} type="hover">
      <Group
        gap={0}
        wrap="nowrap"
        style={{
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,35,64,0.10)'}`,
          background: dark ? 'rgba(255,255,255,0.02)' : SURFACE_LIGHT,
          paddingLeft: 12,
          paddingRight: 12,
          minHeight: 44,
        }}
      >
        {dashboards.map(d => {
          const isActive = d.id === activeDashId;
          return (
            <button
              key={d.id}
              onClick={() => onLoadDashboard(d)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '0 14px',
                height: 44,
                fontFamily: FONT_FAMILY,
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? AQUA_HEX : dark ? 'rgba(255,255,255,0.55)' : DEEP_BLUE_TINTS[60],
                borderBottom: isActive ? `2px solid ${AQUA_HEX}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'all 140ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = dark
                    ? 'rgba(255,255,255,0.85)'
                    : DEEP_BLUE_HEX;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = dark
                    ? 'rgba(255,255,255,0.55)'
                    : DEEP_BLUE_TINTS[60];
                }
              }}
            >
              {d.name}
              {d.id === activeDashId && dirty && (
                <span style={{ marginLeft: 4, color: '#FFAA33', fontSize: 10 }}>●</span>
              )}
            </button>
          );
        })}
        <button
          onClick={onNewDashboard}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '0 10px',
            height: 44,
            color: dark ? 'rgba(255,255,255,0.35)' : DEEP_BLUE_TINTS[40],
            fontSize: '0.8rem',
            fontFamily: FONT_FAMILY,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="New Dashboard"
        >
          <IconPlus size={13} /> New
        </button>
      </Group>
    </ScrollArea>
  );
}
