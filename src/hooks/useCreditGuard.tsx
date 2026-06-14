import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserCredits } from "./useUserCredits";
import { CREDIT_COST } from "@/lib/tools";

/**
 * Guards a premium tool action behind a server-side credit check + deduction.
 *
 * Flow:
 *  1. Require an authenticated user.
 *  2. Block (and show the upgrade dialog) when the balance is below CREDIT_COST.
 *  3. Run the tool action.
 *  4. On success, deduct credits server-side (and log the transaction).
 *
 * Free tools should NOT use this hook — they run unconditionally.
 */
export function useCreditGuard(toolSlug: string) {
  const { user } = useAuth();
  const { credits, refresh } = useUserCredits();
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const hasEnough = !!credits && (credits.isUnlimited || credits.credits >= CREDIT_COST);

  /**
   * Wraps a premium tool action. Returns true when the action ran and was charged.
   * The provided action MUST throw on failure so no credits are deducted.
   * `amount` lets a tool charge a custom number of credits (defaults to CREDIT_COST).
   */
  const withCredits = useCallback(
    async (
      action: () => Promise<void> | void,
      amount: number = CREDIT_COST,
    ): Promise<boolean> => {
      if (!user) {
        toast.error("Please sign in to use this tool.");
        navigate("/auth");
        return false;
      }
      if (!credits) {
        toast.error("Couldn't verify your credits. Please try again.");
        return false;
      }
      if (!credits.isUnlimited && credits.credits < amount) {
        setUpgradeOpen(true);
        return false;
      }

      // Run the tool. If it throws, we never charge.
      try {
        await action();
      } catch (e) {
        // Tools surface their own error toasts; just skip the deduction.
        return false;
      }

      // Deduct credits server-side after a successful run.
      const { error } = await supabase.rpc("spend_credits", {
        _amount: amount,
        _tool_slug: toolSlug,
      });

      if (error) {
        if (error.message?.includes("INSUFFICIENT_CREDITS")) {
          setUpgradeOpen(true);
        } else {
          console.error("spend_credits error:", error);
        }
      } else {
        refresh();
      }

      return true;
    },
    [user, credits, navigate, refresh, toolSlug],
  );

  return { withCredits, upgradeOpen, setUpgradeOpen, hasEnough, credits };
}
