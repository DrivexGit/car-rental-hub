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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data } = await supabase
          .from('staff_profiles')
          .select('id, full_name, role, tenant_id')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (!data) {
          // Auto-create tenant + staff profile on first login
          const { data: tenant } = await supabase
            .from('tenants')
            .insert({ name: session.user.email || 'My Company', slug: session.user.id.slice(0, 8) })
            .select('id')
            .single();

          if (tenant) {
            const { data: newProfile } = await supabase
              .from('staff_profiles')
              .insert({ id: session.user.id, full_name: session.user.email, role: 'admin', tenant_id: tenant.id })
              .select('id, full_name, role, tenant_id')
              .single();
            setStaffProfile(newProfile);
          }
        } else {
          setStaffProfile(data);
        }
      } else {
        setStaffProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStaffProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, staffProfile, tenantId: staffProfile?.tenant_id ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
