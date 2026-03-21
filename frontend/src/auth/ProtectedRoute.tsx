import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Center, Stack, ThemeIcon, Title, Text, Button } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { DEEP_BLUE, FONT_FAMILY } from '../brandTokens';

interface Props {
  /** Optional page key to enforce page-level permission check. */
  pageKey?: string;
}

function AccessDenied() {
  const navigate = useNavigate();
  return (
    <Center style={{ height: '60vh' }}>
      <Stack align="center" gap="md" maw={400}>
        <ThemeIcon size={64} radius="xl" color="red" variant="light">
          <IconLock size={32} />
        </ThemeIcon>
        <Title order={2} ta="center" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
          Access Denied
        </Title>
        <Text ta="center" c="dimmed" size="sm">
          You don't have permission to view this page.
          Contact your administrator to request access.
        </Text>
        <Button variant="light" color="teal" onClick={() => navigate('/')}>
          Go to Dashboard
        </Button>
      </Stack>
    </Center>
  );
}

/** Wraps a set of routes — redirects unauthenticated users to /login.
 *  If a pageKey is provided and the user lacks access, shows an Access Denied screen. */
export default function ProtectedRoute({ pageKey }: Props = {}) {
  const { isAuthenticated, canAccess } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (pageKey && !canAccess(pageKey)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
