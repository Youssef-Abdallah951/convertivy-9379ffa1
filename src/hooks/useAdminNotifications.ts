import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AdminNotification = {
  id: string;
  payment_request_id: string;
  user_id: string;
  status: "pending" | "processed";
  is_read: boolean;
  created_at: string;
  // joined details
  package: string;
  credits_amount: number;
  price_egp: number;
  proof_path: string | null;
  reference_number: string | null;
  request_status: string;
  user_email: string | null;
  user_name: string | null;
};

export function useAdminNotifications() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data: notifs } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = notifs ?? [];
    if (rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const reqIds = Array.from(new Set(rows.map((r: any) => r.payment_request_id)));
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));

    const [{ data: reqs }, { data: profs }] = await Promise.all([
      supabase.from("payment_requests").select("*").in("id", reqIds),
      supabase.from("profiles").select("user_id,email,display_name").in("user_id", userIds),
    ]);

    const reqMap: Record<string, any> = {};
    reqs?.forEach((r: any) => { reqMap[r.id] = r; });
    const profMap: Record<string, any> = {};
    profs?.forEach((p: any) => { profMap[p.user_id] = p; });

    const merged: AdminNotification[] = rows.map((n: any) => {
      const r = reqMap[n.payment_request_id] ?? {};
      const p = profMap[n.user_id] ?? {};
      return {
        id: n.id,
        payment_request_id: n.payment_request_id,
        user_id: n.user_id,
        status: n.status,
        is_read: n.is_read,
        created_at: n.created_at,
        package: r.package ?? "—",
        credits_amount: r.credits_amount ?? 0,
        price_egp: r.price_egp ?? 0,
        proof_path: r.proof_path ?? null,
        reference_number: r.reference_number ?? null,
        request_status: r.status ?? "pending",
        user_email: p.email ?? null,
        user_name: p.display_name ?? null,
      };
    });

    setItems(merged);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markAllRead = useCallback(async () => {
    if (!isAdmin) return;
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("admin_notifications").update({ is_read: true }).in("id", ids);
    load();
  }, [isAdmin, items, load]);

  return { items, unreadCount, loading, reload: load, markAllRead };
}
