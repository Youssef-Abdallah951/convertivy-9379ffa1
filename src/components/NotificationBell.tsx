import { useNavigate } from "react-router-dom";
import { Bell, ImageIcon, CheckCheck, Coins, Mail, User as UserIcon, Clock, Package } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unreadCount, markAllRead } = useAdminNotifications();

  async function viewProof(path: string) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Popover onOpenChange={(open) => { if (open && unreadCount > 0) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-glow">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[26rem]">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={n.is_read ? "" : "bg-primary/5"}>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Coins className="h-4 w-4 text-primary" />
                        New payment request
                      </div>
                      <Badge variant={n.status === "processed" ? "secondary" : "default"} className="capitalize text-[10px]">
                        {n.status === "processed" ? n.request_status : "pending"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5"><UserIcon className="h-3 w-3" /> {n.user_name || "Unknown"}</p>
                      <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {n.user_email || n.user_id.slice(0, 8)}</p>
                      <p className="flex items-center gap-1.5 capitalize"><Package className="h-3 w-3" /> {n.package} — {n.price_egp} EGP</p>
                      <p className="flex items-center gap-1.5"><Coins className="h-3 w-3" /> {n.credits_amount ? `${n.credits_amount} credits` : "Unlimited"}</p>
                      <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {n.proof_path && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => viewProof(n.proof_path!)}>
                          <ImageIcon className="h-3.5 w-3.5 mr-1" /> Proof
                        </Button>
                      )}
                      {n.status !== "processed" && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => navigate("/admin/payments")}>
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
