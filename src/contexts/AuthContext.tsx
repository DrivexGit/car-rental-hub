import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface StaffProfile {
  id: string;
  full_name: string | null;
  role: string;
  tenant_id: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  staffProfile: StaffProfile | null;
  tenantId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, staffProfile: null, tenantId: null, loading: true, signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

// Cache the profile in memory to avoid redundant fetches on navigation
const profileCache = new Map<string, StaffProfile>();

async function fetchProfile(userId: string): Promise<StaffProfile | null> {
  if (profileCache.has(userId)) {
    return profileCache.get(userId)!;
  }
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, tenant_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error fetching staff profile:', error);
    return null;
  }
  if (data) profileCache.set(userId, data);
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Track initialized to skip redundant work on token refresh
  const initialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    // 1. Subscribe FIRST so we don't miss any events during async init
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      // TOKEN_REFRESHED: just update session silently; profile is already cached
      if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        return;
      }

      if (event === 'SIGNED_OUT') {
        profileCache.clear();
        setSession(null);
        setStaffProfile(null);
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentSession?.user) {
        const profile = await fetchProfile(currentSession.user.id);
        if (!mounted) return;
        setSession(currentSession);
        setStaffProfile(profile);
        if (!initialized.current) {
          initialized.current = true;
          setLoading(false);
        }
        return;
      }

      // Any other event: just sync session
      setSession(currentSession);
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    // 2. Safety timeout - if onAuthStateChange never fires (network blocked)
    const timeout = setTimeout(() => {
      if (mounted && !initialized.current) {
        console.warn('Auth timeout: proceeding unauthenticated');
        initialized.current = true;
        setLoading(false);
      }
    }, 10000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    profileCache.clear();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      staffProfile,
      tenantId: staffProfile?.tenant_id ?? null,
      loading,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}
