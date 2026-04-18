import React from 'react';
import { Button, Text, Title, Group } from '@mantine/core';
import { IconRefresh, IconHome, IconBug } from '@tabler/icons-react';
import { logErrorToServer } from '../../api/errorLogs';
import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW } from '../../brandTokens';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Render a compact inline card instead of full-page error UI (for widget-level boundaries) */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const WITTY_MESSAGES = [
  "Well, that wasn't in the sprint plan.",
  "Houston, we have a problem.",
  "The bytes hit a bump in the road.",
  "Something tripped over its own code.",
  "Our hamster fell off the wheel.",
  "Looks like we divided by zero somewhere.",
  "The matrix had a hiccup.",
  "Oops. Even good code has bad days.",
];

function getWittyMessage() {
  return WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private wittyMessage: string;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.wittyMessage = getWittyMessage();
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.wittyMessage = getWittyMessage();
    logErrorToServer({
      source: 'FRONTEND',
      severity: 'ERROR',
      errorType: error.name || 'ReactError',
      message: error.message,
      stackTrace: [error.stack, '\n--- Component Stack ---\n', errorInfo.componentStack].filter(Boolean).join(''),
      pageUrl: window.location.pathname,
      component: errorInfo.componentStack
        ? (errorInfo.componentStack.match(/at\s+(\w+)/)?.[1] || undefined)
        : undefined,
      userAgent: navigator.userAgent,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // ── Compact widget-level error card ────────────────────────────────────
      if ((this.props as ErrorBoundaryProps).compact) {
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
            padding: '16px 20px',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 12,
            background: 'var(--mantine-color-default)',
            gap: 8,
          }}>
            <IconBug size={22} color={AQUA} stroke={1.5} />
            <Text size="xs" fw={600} c="dimmed">
              Widget failed to render
            </Text>
            {this.state.error?.message && (
              <Text size="xs" ff="monospace" c="dimmed" style={{ maxWidth: 280, wordBreak: 'break-word', textAlign: 'center', lineHeight: 1.4 }}>
                {this.state.error.message}
              </Text>
            )}
            {this.state.error?.stack && (
              <Text size="xs" ff="monospace" c="dimmed" style={{ maxWidth: 320, wordBreak: 'break-word', textAlign: 'left', lineHeight: 1.4, fontSize: 10, opacity: 0.7, whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack.split('\n').slice(0, 6).join('\n')}
              </Text>
            )}
            <Button size="xs" variant="subtle" color="gray" onClick={this.handleReset}>
              Retry
            </Button>
          </div>
        );
      }

      // ── Full-page error UI ─────────────────────────────────────────────────
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '65vh',
          padding: 32,
        }}>
          {/* Keyframe animation injected inline — safe for class components */}
          <style>{`
            @keyframes errPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(45,204,211,0.4); }
              50%       { box-shadow: 0 0 0 14px rgba(45,204,211,0); }
            }
            @keyframes errFloat {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-6px); }
            }
          `}</style>

          <div style={{
            maxWidth: 520,
            width: '100%',
            textAlign: 'center',
            background: 'var(--mantine-color-default)',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 20,
            padding: '48px 40px 40px',
            boxShadow: SHADOW.lg,
            position: 'relative',
            overflow: 'hidden',
          }}>

            {/* Decorative background dots */}
            <svg width="320" height="120" viewBox="0 0 320 120"
              style={{ position: 'absolute', top: 0, right: 0, opacity: 0.04, pointerEvents: 'none' }}>
              {[0,1,2,3,4,5,6,7].map(col => [0,1,2,3].map(row => (
                <circle key={`${col}-${row}`} cx={col * 44 + 12} cy={row * 30 + 12} r={3}
                  fill="currentColor" />
              )))}
            </svg>

            {/* Pulsing teal icon */}
            <div style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${AQUA} 0%, #1a8fa8 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 28px',
              animation: 'errPulse 2.4s ease-in-out infinite, errFloat 3s ease-in-out infinite',
              position: 'relative',
              zIndex: 1,
            }}>
              <IconBug size={40} color="#fff" stroke={1.5} />
            </div>

            <Title order={2} style={{
              color: 'var(--mantine-color-text)',
              fontWeight: 300,
              fontSize: 26,
              marginBottom: 10,
              position: 'relative',
            }}>
              {this.wittyMessage}
            </Title>

            <Text size="sm" c="dimmed" style={{
              marginBottom: 28,
              lineHeight: 1.7,
              maxWidth: 380,
              margin: '0 auto 28px',
            }}>
              Something unexpected happened on this page. The error has been logged automatically —
              no action needed on your end. You can reload the page or return to the dashboard.
            </Text>

            {/* Error detail — shown only in development or when meaningful */}
            {this.state.error?.message && (
              <details style={{ marginBottom: 28, textAlign: 'left' }}>
                <summary style={{
                  fontSize: 12,
                  color: 'var(--mantine-color-dimmed)',
                  cursor: 'pointer',
                  marginBottom: 8,
                  userSelect: 'none',
                }}>
                  Technical details
                </summary>
                <div style={{
                  background: 'var(--mantine-color-default-hover)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  border: '1px solid var(--mantine-color-default-border)',
                  marginTop: 6,
                }}>
                  <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {this.state.error.message}
                  </Text>
                </div>
              </details>
            )}

            <Group justify="center" gap="sm">
              <Button
                leftSection={<IconRefresh size={15} />}
                variant="filled"
                color="dark"
                onClick={this.handleReload}
                style={{ fontFamily: FONT_FAMILY, fontWeight: 500, borderRadius: 10, backgroundColor: DEEP_BLUE }}
                styles={{ label: { color: '#ffffff' }, section: { color: '#ffffff' } }}
              >
                Reload page
              </Button>
              <Button
                leftSection={<IconRefresh size={15} />}
                variant="subtle"
                color="gray"
                onClick={this.handleReset}
                style={{ fontFamily: FONT_FAMILY, borderRadius: 10 }}
              >
                Try again
              </Button>
              <Button
                leftSection={<IconHome size={15} />}
                variant="light"
                color="teal"
                onClick={this.handleGoHome}
                style={{ fontFamily: FONT_FAMILY, borderRadius: 10 }}
              >
                Dashboard
              </Button>
            </Group>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
