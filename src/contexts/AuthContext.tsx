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

// In-memory profile cache – survives navigation but cleared on sign-out
const profileCache = new Map<string, StaffProfile>();

async function fetchProfile(userId: string): Promise<StaffProfile | null> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  try {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', userId)
      .maybeSingle();
    if (error) { console.error('fetchProfile error:', error); return null; }
    if (data) profileCache.set(userId, data);
    return data;
  } catch (e) {
    console.error('fetchProfile exception:', e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Helper: finish initial loading and set session+profile atomically
    const finishInit = (s: Session | null, p: StaffProfile | null) => {
      if (!mounted) return;
      setSession(s);
      setStaffProfile(p);
      initializedRef.current = true;
      setLoading(false);
    };

    // 1. Fast initial session check
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (initializedRef.current) return; // onAuthStateChange already handled it
      if (!s?.user) { finishInit(null, null); return; }
      const profile = await fetchProfile(s.user.id);
      finishInit(s, profile);
    }).catch(() => {
      if (!initializedRef.current) finishInit(null, null);
    });

    // Safety net in case both getSession and onAuthStateChange hang
    const safetyTimer = setTimeout(() => {
      if (!initializedRef.current && mounted) finishInit(null, null);
    }, 10000);

    // 2. Listen for ongoing session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'TOKEN_REFRESHED') {
        // Silent token refresh – just update session, keep existing profile
        setSession(currentSession);
        // Ensure we're not stuck in loading
        if (!initializedRef.current) finishInit(currentSession, null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        profileCache.clear();
        clearTimeout(safetyTimer);
        finishInit(null, null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (currentSession?.user) {
          // ✅ Set session FIRST so LoginRoute can redirect immediately
          setSession(currentSession);
          // Then load profile in background
          fetchProfile(currentSession.user.id).then(p => {
            if (mounted) setStaffProfile(p);
          });
        } else {
          setSession(null);
          setStaffProfile(null);
        }
        // Mark as initialized after INITIAL_SESSION so loading clears
        if (!initializedRef.current && event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimer);
          initializedRef.current = true;
          setLoading(false);
        }
        return;
      }

      // Fallback for any other event
      setSession(currentSession);
      if (!initializedRef.current) {
        clearTimeout(safetyTimer);
        finishInit(currentSession, null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
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
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
