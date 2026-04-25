import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Membership = {
  tenantId: string;
  role: string;
  tenant?: { id: string; nome: string; logo_url?: string | null } | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;

    const load = async (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);

      const nextUserId = nextSession?.user?.id || null;

      if (!nextUserId) {
        setIsPlatformAdmin(false);
        setMemberships([]);
        setActiveTenantId(null);
        currentUserId = null;
        setLoading(false);
        return;
      }

      if (nextUserId !== currentUserId) {
        setIsPlatformAdmin(false);
        setMemberships([]);
        setActiveTenantId(null);
      }

      currentUserId = nextUserId;

      const [{ data: adminRow }, { data: memberRows }] = await Promise.all([
        supabase.from("platform_admins").select("user_id").eq("user_id", nextUserId).maybeSingle(),
        supabase
          .from("tenant_members")
          .select("tenant_id, role, imobiliarias(id, nome, logo_url)")
          .eq("user_id", nextUserId),
      ]);

      if (!isMounted) return;

      const admin = Boolean(adminRow?.user_id);
      setIsPlatformAdmin(admin);

      const mapped: Membership[] =
        (memberRows as any[] | null)?.map((r) => ({
          tenantId: r.tenant_id,
          role: r.role,
          tenant: r.imobiliarias || null,
        })) || [];

      setMemberships(mapped);
      setActiveTenantId((prev) => {
        if (prev && mapped.some((m) => m.tenantId === prev)) return prev;
        return mapped[0]?.tenantId || null;
      });
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      load(nextSession);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      isPlatformAdmin,
      memberships,
      activeTenantId,
      setActiveTenantId,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, isPlatformAdmin, memberships, activeTenantId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

