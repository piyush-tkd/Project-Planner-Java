import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TextInput, Button, Text, Title, Stack, Alert,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../api/client';
import {
  DEEP_BLUE, AQUA, DEEP_BLUE_TINTS,
  FONT_FAMILY, SHADOW,
} from '../brandTokens';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: FONT_FAMILY }}>

      {/* ── Left brand panel ── */}
      <div style={{
        flex: '0 0 45%', backgroundColor: DEEP_BLUE,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 30% 40%, rgba(45,204,211,0.08) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <svg width="52" height="48" viewBox="0 0 52 48" fill="none" style={{ marginBottom: 16, position: 'relative' }}>
          <polygon points="26,0 52,48 0,48" fill="none" stroke={AQUA} strokeWidth="4" />
          <polygon points="26,10 44,44 8,44" fill={AQUA} opacity="0.25" />
        </svg>
        <Title order={1} style={{
          color: '#FFFFFF', fontFamily: FONT_FAMILY, fontWeight: 300,
          fontSize: 36, letterSpacing: '0.04em', textAlign: 'center',
          lineHeight: 1.1, position: 'relative',
        }}>
          ENGINEERING<br />PORTFOLIO<br />PLANNER
        </Title>
        <div style={{
          width: 48, height: 3, backgroundColor: AQUA,
          borderRadius: 2, marginTop: 24, marginBottom: 24, position: 'relative',
        }} />
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1, backgroundColor: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: 396 }}>

          <Title order={2} style={{
            color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 300, fontSize: 32, marginBottom: 6,
          }}>
            Forgot password?
          </Title>
          <Text style={{ color: DEEP_BLUE_TINTS[50], fontSize: 14, fontFamily: FONT_FAMILY, marginBottom: 32 }}>
            Enter your email address and we'll send you a reset link.
          </Text>

          {sent ? (
            <Alert icon={<IconCircleCheck size={16} />} color="teal" variant="light" radius="md">
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>Check your inbox</Text>
              <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                If an account with that email exists, a password reset link has been sent.
                The link expires in 1 hour.
              </Text>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" radius="md">
                  {error}
                </Alert>
              )}
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <TextInput
                    label="Email address"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.currentTarget.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    styles={{
                      label: { fontFamily: FONT_FAMILY, fontWeight: 500, fontSize: 13, color: DEEP_BLUE, marginBottom: 4 },
                      input: { fontFamily: FONT_FAMILY, fontSize: 14, borderColor: DEEP_BLUE_TINTS[10], borderRadius: 6, height: 42 },
                    }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    disabled={!email}
                    style={{
                      backgroundColor: DEEP_BLUE, borderRadius: 6, height: 44,
                      fontFamily: FONT_FAMILY, fontWeight: 500, fontSize: 16,
                      border: 'none', marginTop: 8, boxShadow: SHADOW.sm,
                    }}
                  >
                    Send reset link
                  </Button>
                </Stack>
              </form>
            </>
          )}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: AQUA, fontFamily: FONT_FAMILY, textDecoration: 'none',
            }}>
              <IconArrowLeft size={13} />
              Back to sign in
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
