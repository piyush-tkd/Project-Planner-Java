import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PasswordInput, Button, Text, Title, Stack, Alert, Progress, useComputedColorScheme,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../api/client';
import {
  DEEP_BLUE, AQUA, AQUA_HEX, DEEP_BLUE_TINTS,
  FONT_FAMILY, SHADOW,
} from '../brandTokens';

// ── Password strength meter ───────────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'red' };
  if (score <= 2) return { score, label: 'Fair', color: 'orange' };
  if (score <= 3) return { score, label: 'Good', color: 'yellow' };
  return { score, label: 'Strong', color: 'teal' };
}

export default function ResetPasswordPage() {
  const isDark = useComputedColorScheme('light') === 'dark';
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const strength = getStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_FAMILY }}>
        <Alert icon={<IconAlertCircle size={16} />} color="red" maw={400}>
          No reset token found. Please click the link in your email or request a new one.
          <div style={{ marginTop: 12 }}>
            <Link to="/forgot-password" style={{ color: AQUA, fontSize: 13 }}>Request new link</Link>
          </div>
        </Alert>
      </div>
    );
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
          <polygon points="26,0 52,48 0,48" fill="none" stroke={AQUA_HEX} strokeWidth="4" />
          <polygon points="26,10 44,44 8,44" fill={AQUA_HEX} opacity="0.25" />
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
        flex: 1, backgroundColor: isDark ? 'rgba(26,29,39,0.95)' : '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: 396 }}>

          <Title order={2} style={{
            color: isDark ? '#ffffff' : DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 300, fontSize: 32, marginBottom: 6,
          }}>
            Set new password
          </Title>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : DEEP_BLUE_TINTS[50], fontSize: 14, fontFamily: FONT_FAMILY, marginBottom: 32 }}>
            Choose a strong password of at least 8 characters.
          </Text>

          {done ? (
            <>
              <Alert icon={<IconCircleCheck size={16} />} color="teal" variant="light" radius="md" mb="md">
                <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>Password updated!</Text>
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                  Your password has been changed successfully. You can now sign in with your new password.
                </Text>
              </Alert>
              <Link to="/login" style={{
                display: 'inline-block', textAlign: 'center', width: '100%',
                backgroundColor: DEEP_BLUE, color: '#fff', borderRadius: 6,
                padding: '12px 0', fontFamily: FONT_FAMILY, fontWeight: 500,
                fontSize: 15, textDecoration: 'none', boxShadow: SHADOW.sm,
              }}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" radius="md">
                  <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{error}</Text>
                  {(error.includes('expired') || error.includes('Invalid')) && (
                    <Link to="/forgot-password" style={{ color: isDark ? '#4ecca9' : AQUA, fontSize: 13, display: 'block', marginTop: 6 }}>
                      Request a new link →
                    </Link>
                  )}
                </Alert>
              )}
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <div>
                    <PasswordInput
                      label="New password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.currentTarget.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      styles={{
                        label: { fontFamily: FONT_FAMILY, fontWeight: 500, fontSize: 13, color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE, marginBottom: 4 },
                        input: { fontFamily: FONT_FAMILY, fontSize: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : DEEP_BLUE_TINTS[10], color: isDark ? '#fff' : undefined, borderRadius: 6, height: 42 },
                      }}
                    />
                    {newPassword.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <Progress
                          value={(strength.score / 5) * 100}
                          color={strength.color}
                          size={4}
                          radius="xl"
                        />
                        <Text size="xs" c={strength.color} mt={4} style={{ fontFamily: FONT_FAMILY }}>
                          {strength.label} password
                        </Text>
                      </div>
                    )}
                  </div>
                  <PasswordInput
                    label="Confirm password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.currentTarget.value)}
                    required
                    autoComplete="new-password"
                    error={mismatch ? "Passwords don't match" : undefined}
                    styles={{
                      label: { fontFamily: FONT_FAMILY, fontWeight: 500, fontSize: 13, color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE, marginBottom: 4 },
                      input: { fontFamily: FONT_FAMILY, fontSize: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : DEEP_BLUE_TINTS[10], color: isDark ? '#fff' : undefined, borderRadius: 6, height: 42 },
                    }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    disabled={!newPassword || !confirmPassword || mismatch || newPassword.length < 8}
                    style={{
                      backgroundColor: DEEP_BLUE, borderRadius: 6, height: 44,
                      fontFamily: FONT_FAMILY, fontWeight: 500, fontSize: 16,
                      border: 'none', marginTop: 8, boxShadow: SHADOW.sm,
                    }}
                  >
                    Update password
                  </Button>
                </Stack>
              </form>
            </>
          )}

          {!done && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 13, color: isDark ? '#4ecca9' : AQUA, fontFamily: FONT_FAMILY, textDecoration: 'none',
              }}>
                <IconArrowLeft size={13} />
                Back to sign in
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
