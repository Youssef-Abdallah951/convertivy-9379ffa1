import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type UserCredits = {
  credits: number;
  unlimited_until: string | null;
  isUnlimited: boolean;
};

export function useUserCredits() {
  const { user } = useAuth();
  const [data, setData] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const channelId = useRef(`uc-${Math.random().toString(36).slice(2)}`);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: row } = await supabase
      .from("user_credits")
      .select("credits, unlimited_until")
      .eq("user_id", user.id)
      .maybeSingle();
    if (row) {
      const isUnlimited =
        !!row.unlimited_until && new Date(row.unlimited_until) > new Date();
      setData({ credits: row.credits, unlimited_until: row.unlimited_until, isUnlimited });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: keep the balance in sync instantly across the whole app.
  useEffect(() => {
    if (!user) return;
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
  }, [user, refresh]);

  return { credits: data, loading, refresh };
}
