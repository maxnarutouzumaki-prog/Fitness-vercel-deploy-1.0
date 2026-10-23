import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { profileRepo, settingsRepo } from '../data/repositories';
import { normalizeAppearance } from '../domain/appearance';
import { nowISO } from '../domain/dates';
import { APPEARANCE_ID, PROFILE_ID, SCHEMA_VERSION } from '../domain/types';
import type { Appearance, Profile } from '../domain/types';
import { applyAppearance, readAppearanceMirror } from './appearanceDom';

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'schemaVersion'>>;

interface AppState {
  status: 'loading' | 'ready';
  profile: Profile | null;
  appearance: Appearance;
  /** true quando o armazenamento local falhou (ex.: navegação privada). */
  storageError: boolean;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  updateAppearance: (patch: Partial<Appearance>) => void;
}

const AppContext = createContext<AppState | null>(null);

function newProfile(): Profile {
  const now = nowISO();
  return {
    id: PROFILE_ID,
    schemaVersion: SCHEMA_VERSION,
    name: '',
    onboardingDone: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearanceMirror());
  const [storageError, setStorageError] = useState(false);

  const profileRef = useRef<Profile | null>(null);
  const appearanceRef = useRef<Appearance>(appearance);

  // Aplica a aparência sempre que mudar (imediato, sem recarregar).
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // Carrega perfil e aparência salvos no aparelho.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedProfile, savedAppearance] = await Promise.all([
          profileRepo.get(PROFILE_ID),
          settingsRepo.get(APPEARANCE_ID),
        ]);
        if (cancelled) return;
        if (savedProfile) {
          profileRef.current = savedProfile;
          setProfile(savedProfile);
        }
        if (savedAppearance) {
          const normalized = normalizeAppearance(savedAppearance);
          appearanceRef.current = normalized;
          setAppearance(normalized);
        }
      } catch {
        if (!cancelled) setStorageError(true);
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const base = profileRef.current ?? newProfile();
    const next: Profile = { ...base, ...patch, updatedAt: nowISO() };
    profileRef.current = next;
    setProfile(next);
    try {
      await profileRepo.put(next);
    } catch {
      setStorageError(true);
    }
  }, []);

  const updateAppearance = useCallback((patch: Partial<Appearance>) => {
    const next = normalizeAppearance({ ...appearanceRef.current, ...patch });
    appearanceRef.current = next;
    setAppearance(next);
    settingsRepo.put({ id: APPEARANCE_ID, ...next, updatedAt: nowISO() }).catch(() => setStorageError(true));
  }, []);

  const value = useMemo<AppState>(
    () => ({ status, profile, appearance, storageError, updateProfile, updateAppearance }),
    [status, profile, appearance, storageError, updateProfile, updateAppearance],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de <AppProvider>.');
  return context;
}
