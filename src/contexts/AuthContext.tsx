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
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      setAuthStatus('Connecting...');
      
      // Safety timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );

      try {
        // Run getSession first as it's often faster for initial hit
        const sessionPromise = supabase.auth.getSession();
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        const initialSession = result.data?.session;

        if (mounted) {
          setSession(initialSession);
          if (initialSession?.user) {
            setAuthStatus('Syncing profile...');
            const { data: profile, error: profileError } = await supabase
              .from('staff_profiles')
              .select('id, full_name, role, tenant_id')
              .eq('id', initialSession.user.id)
              .maybeSingle();
            
            if (profileError) throw profileError;
            if (mounted) setStaffProfile(profile);
          }
        }
      } catch (error: any) {
        if (error.message === 'TIMEOUT') {
          console.warn("Auth initialization timed out, proceeding with fallback...");
        } else {
          console.error("Auth initialization error:", error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setAuthStatus('');
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const { data: profile } = await supabase
            .from('staff_profiles')
            .select('id, full_name, role, tenant_id')
            .eq('id', currentSession.user.id)
            .maybeSingle();
          setStaffProfile(profile);
        } else if (event === 'SIGNED_OUT') {
          setStaffProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setStaffProfile(null);
    setLoading(false);
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
      {loading && authStatus && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xl font-semibold animate-pulse">{authStatus}</p>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
