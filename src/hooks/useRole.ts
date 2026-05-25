import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "owner" | "admin" | "user";

interface RoleState {
  loading: boolean;
  roles: AppRole[];
  isOwner: boolean;
  isAdmin: boolean; // true for owner OR admin
  refresh: () => void;
}

export function useRole(): RoleState {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[useRole]", error.message);
          setRoles([]);
        } else {
          setRoles((data ?? []).map((r) => r.role as AppRole));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, tick]);

  const isOwner = roles.includes("owner");
  const isAdmin = isOwner || roles.includes("admin");

  return { loading, roles, isOwner, isAdmin, refresh: () => setTick((t) => t + 1) };
}
