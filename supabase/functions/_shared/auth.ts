import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Validates the caller's JWT. Returns the user id, or null when unauthenticated.
 */
export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}
