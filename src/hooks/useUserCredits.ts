import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type UserCredits = {
  credits: number;
  unlimited_until: string | null;
  isUnlimited: boolean;
};

export function useUserCredits() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const channelId = useRef(`uc-${Math.random().toString(36).slice(2)}`);

  const refresh = useCallback(async (): Promise<UserCredits | null> => {
    if (authLoading) {
      setLoading(true);
      return null;
    }
    if (!user) {
      setData(null);
      setLoading(false);
      return null;
    }
    setLoading(true);

    try {
      const { data: ensured } = await (supabase as any).rpc("ensure_user_account");
      if (ensured && typeof ensured.credits === "number") {
        const unlimitedUntil = ensured.unlimited_until ?? null;
        const next = {
          credits: ensured.credits,
          unlimited_until: unlimitedUntil,
          isUnlimited: !!unlimitedUntil && new Date(unlimitedUntil) > new Date(),
        };
        setData(next);
        setLoading(false);
        return next;
      }

      const { data: row, error } = await supabase
        .from("user_credits")
        .select("credits, unlimited_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        setData(null);
        setLoading(false);
        return null;
      }
      const isUnlimited =
        !!row.unlimited_until && new Date(row.unlimited_until) > new Date();
      const next = { credits: row.credits, unlimited_until: row.unlimited_until, isUnlimited };
      setData(next);
      return next;
    } catch (error) {
      console.error("Credit balance load failed:", error);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: keep the balance in sync instantly across the whole app.
  useEffect(() => {
    if (!user || authLoading) return;
    const channel = supabase
      .channel(channelId.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user, refresh]);

  return { credits: data, loading, refresh };
}
