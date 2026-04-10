/**
 * useToast — PP Design Language toast helper (DL-7)
 *
 * Wraps @mantine/notifications with PP-styled presets for success / error /
 * warning / info, plus an optional "Undo" action variant.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved', 'Project updated successfully');
 *   toast.withUndo('Deleted project', () => restoreProject(id));
 */
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react';
import React from 'react';
import { AQUA, DARK_SIDEBAR, SIDEBAR_INACTIVE} from '../brandTokens';

/** Notification type → accent colour */
const TYPE_COLOR: Record<ToastType, string> = {
  success: '#2E7D32',
  error:   '#D32F2F',
  warning: '#FF8F00',
  info:    AQUA,
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  /** Callback for an "Undo" action button */
  undoAction?: () => void;
  /** Auto-close delay in ms. 0 = persistent. Default: 4000 */
  duration?: number;
}

function getIcon(type: ToastType): React.ReactElement {
  const size = 18;
  const color = TYPE_COLOR[type];
  switch (type) {
    case 'success': return React.createElement(IconCheck,         { size, color });
    case 'error':   return React.createElement(IconX,             { size, color });
    case 'warning': return React.createElement(IconAlertTriangle, { size, color });
    case 'info':    return React.createElement(IconInfoCircle,    { size, color });
  }
}

/**
 * Core show function — applies PP dark-theme styling to every notification.
 */
function show(options: ToastOptions): void {
  const { type, title, message, undoAction, duration = 4000 } = options;
  const accentColor = TYPE_COLOR[type];

  notifications.show({
    title,
    message: undoAction
      ? React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
          React.createElement('span', { style: { fontSize: 13, color: '#b0b3c1' } }, message),
          React.createElement(
            'button',
            {
              onClick: () => {
                undoAction();
                notifications.hide('pp-undo-toast');
              },
              style: {
                background: 'none',
                border: 'none',
                color: AQUA,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0 4px',
                flexShrink: 0,
              },
            },
            'Undo',
          ),
        )
      : message,
    icon: getIcon(type),
    autoClose: duration === 0 ? false : duration,
    withCloseButton: true,
    id: undoAction ? 'pp-undo-toast' : undefined,
    styles: {
      root: {
        background: DARK_SIDEBAR,
        border: `1px solid #2e3346`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        boxShadow: '0 8px 16px rgba(0,0,0,0.30)',
      },
      title: {
        fontSize: 14,
        fontWeight: 600,
        color: '#e2e4eb',
      },
      description: {
        fontSize: 13,
        color: '#b0b3c1',
      },
      closeButton: {
        color: SIDEBAR_INACTIVE,
      },
      icon: {
        background: 'transparent',
      },
    },
  });
}

/** Public hook — returns typed convenience methods */
export function useToast() {
  return {
    success(title: string, message?: string) {
      show({ type: 'success', title, message });
    },
    error(title: string, message?: string) {
      show({ type: 'error', title, message, duration: 6000 });
    },
    warning(title: string, message?: string) {
      show({ type: 'warning', title, message });
    },
    info(title: string, message?: string) {
      show({ type: 'info', title, message });
    },
    withUndo(title: string, undoAction: () => void, message?: string) {
      show({ type: 'info', title, message, undoAction, duration: 6000 });
    },
    show,
  };
}

export default useToast;
