import { Group, ThemeIcon, Text, Badge, Tooltip, ActionIcon } from '@mantine/core';
import { IconLayoutGrid, IconPencil } from '@tabler/icons-react';
import { AQUA_HEX, AQUA_TINTS, DEEP_BLUE_HEX, FONT_FAMILY } from '../../../../brandTokens';

interface DashboardHeaderProps {
  dark: boolean;
  dashName: string;
  dirty: boolean;
  onRename: () => void;
}

export function DashboardHeader({ dark, dashName, dirty, onRename }: DashboardHeaderProps) {
  return (
    <div
      style={{
        background: dark
          ? `linear-gradient(135deg, ${'#1a2942'} 0%, ${'#243d5f'} 100%)`
          : `linear-gradient(135deg, ${DEEP_BLUE_HEX} 0%, ${AQUA_TINTS[90]} 100%)`,
        padding: '10px 16px 12px',
      }}
      className="page-enter"
    >
      <Group gap="sm" align="center">
        <ThemeIcon size={34} radius="md" style={{ background: AQUA_HEX, flexShrink: 0 }}>
          <IconLayoutGrid size={19} color={DEEP_BLUE_HEX} />
        </ThemeIcon>
        <div>
          <Group gap={6} align="center">
            <Text
              size="lg"
              fw={800}
              style={{ fontFamily: FONT_FAMILY, color: 'white', lineHeight: 1.2 }}
            >
              {dashName || 'Custom Dashboard'}
            </Text>
            {dirty && (
              <Badge size="xs" variant="light" color="orange">
                Unsaved
              </Badge>
            )}
            <Tooltip label="Rename dashboard" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                style={{ color: 'rgba(255,255,255,0.55)' }}
                onClick={onRename}
                aria-label="Edit"
              >
                <IconPencil size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Text size="xs" style={{ color: AQUA_TINTS[40] }}>
            Premium analytics — build, customize, and share data visualizations
          </Text>
        </div>
      </Group>
    </div>
  );
}
