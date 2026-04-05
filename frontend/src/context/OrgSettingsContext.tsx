import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import apiClient from '../api/client';
import { AQUA, DEEP_BLUE } from '../brandTokens';

export interface OrgConfig {
  id?: number;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  dateFormat: string;
  fiscalYearStart: string;
}

const DEFAULTS: OrgConfig = {
  orgName:         'Engineering Portfolio Planner',
  orgSlug:         'epp',
  logoUrl:         null,
  primaryColor:    AQUA,
  secondaryColor:  DEEP_BLUE,
  timezone:        'America/Chicago',
  dateFormat:      'MMM DD, YYYY',
  fiscalYearStart: 'January',
};

interface OrgSettingsCtx {
  orgSettings: OrgConfig;
  loading: boolean;
  refresh: () => void;
}

const OrgSettingsContext = createContext<OrgSettingsCtx>({
  orgSettings: DEFAULTS,
  loading: false,
  refresh: () => {},
});

export function OrgSettingsProvider({ children }: { children: ReactNode }) {
  const [orgSettings, setOrgSettings] = useState<OrgConfig>(DEFAULTS);
  const [loading, setLoading]         = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get<OrgConfig>('/org/settings');
      // Merge with defaults so null/missing fields fall back gracefully
      setOrgSettings({
        ...DEFAULTS,
        ...res.data,
        primaryColor:   res.data.primaryColor   ?? DEFAULTS.primaryColor,
        secondaryColor: res.data.secondaryColor ?? DEFAULTS.secondaryColor,
        orgName:        res.data.orgName        ?? DEFAULTS.orgName,
      });
    } catch {
      // Leave defaults in place if backend is unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  return (
    <OrgSettingsContext.Provider value={{ orgSettings, loading, refresh: fetchSettings }}>
      {children}
    </OrgSettingsContext.Provider>
  );
}

export function useOrgSettings(): OrgSettingsCtx {
  return useContext(OrgSettingsContext);
}
