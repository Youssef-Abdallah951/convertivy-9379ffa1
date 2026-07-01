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

  const refresh = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data: ensured } = await (supabase as any).rpc("ensure_user_account");
      if (ensured && typeof ensured.credits === "number") {
        const unlimitedUntil = ensured.unlimited_until ?? null;
        setData({
          credits: ensured.credits,
          unlimited_until: unlimitedUntil,
          isUnlimited: !!unlimitedUntil && new Date(unlimitedUntil) > new Date(),
        });
        setLoading(false);
        return;
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
        return;
      }
      const isUnlimited =
        !!row.unlimited_until && new Date(row.unlimited_until) > new Date();
      setData({ credits: row.credits, unlimited_until: row.unlimited_until, isUnlimited });
    } catch (error) {
      console.error("Credit balance load failed:", error);
      setData(null);
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
