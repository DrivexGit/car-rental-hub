import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  // loading = true until we know both session + profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // The canonical Supabase pattern: onAuthStateChange fires INITIAL_SESSION
    // synchronously on mount, so this is the single source of truth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        // Token silently refreshed – keep existing profile, no flicker
        if (event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setStaffProfile(null);
          setLoading(false);
          return;
        }

        // INITIAL_SESSION or SIGNED_IN
        if (currentSession?.user) {
          // Fetch profile before revealing the app so tenantId is always ready
          const { data: profile } = await supabase
            .from('staff_profiles')
            .select('id, full_name, role, tenant_id')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (!mounted) return;
          setSession(currentSession);
          setStaffProfile(profile ?? null);
        } else {
          setSession(null);
          setStaffProfile(null);
        }

        setLoading(false);
      }
    );

    // Guard: if Supabase never fires (network totally blocked), unblock UI
    const fallback = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 12000);

    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
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
