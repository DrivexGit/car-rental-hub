import { useAuth } from '@/contexts/AuthContext';

export function useTenantId() {
  const { tenantId } = useAuth();
  return tenantId;
}
