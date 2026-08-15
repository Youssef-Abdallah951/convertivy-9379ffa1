// Edge function: scan-url-probe
// Safely inspects a URL for the Digital Risk Scanner: follows redirects manually
// (max 5 hops), reports the final destination and HSTS, and never returns body content.
// SSRF-hardened: every hop is re-validated against private/loopback/metadata ranges.
import { getAuthenticatedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BLOCKED_HOST = /^(localhost|.*\.localhost|.*\.internal|.*\.local|metadata\..*)$/i;
const BLOCKED_IP =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|192\.0\.0\.|198\.1[89]\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc|fd|fe80:)/i;

async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST.test(host)) return true;
  if (/^[0-9.]+$/.test(host) || host.includes(":")) return BLOCKED_IP.test(host);

  const records: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      records.push(...(await Deno.resolveDns(host, type)));
    } catch {
      // ignore individual lookup failures
    }
  }
  if (records.length === 0) return true; // unresolvable -> reject
  return records.some((ip) => BLOCKED_IP.test(ip));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { url } = await req.json();
    if (!url || typeof url !== "string" || url.length > 2048) {
      return json({ error: "Provide a valid 'url'." }, 400);
    }

    let current: URL;
    try {
      current = new URL(url);
    } catch {
      return json({ error: "Malformed URL." }, 400);
    }
    if (!["http:", "https:"].includes(current.protocol)) {
      return json({ error: "Only http and https URLs can be probed." }, 400);
    }

    const chain: string[] = [];
    let hsts = false;
    let status = 0;

    for (let hop = 0; hop < 6; hop++) {
      if (await isBlockedHost(current.hostname)) {
        return json({ reachable: false, error: "Destination host is not allowed.", redirectChain: chain });
      }

      let response: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        response = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "Convertify-RiskScanner/1.0" },
        });
        clearTimeout(timer);
      } catch {
        return json({
          reachable: false,
          error: "The destination did not respond.",
          redirectChain: chain,
          finalUrl: current.toString(),
        });
      }

      // Body is never read or returned — only response metadata is used.
      await response.body?.cancel();
      status = response.status;
      if (response.headers.get("strict-transport-security")) hsts = true;

      const location = response.headers.get("location");
      if (status >= 300 && status < 400 && location) {
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          break;
        }
        chain.push(next.toString());
        if (!["http:", "https:"].includes(next.protocol)) {
          return json({
            reachable: true,
            status,
            finalUrl: next.toString(),
            redirectChain: chain,
            hsts,
            error: "Redirects to a non-web scheme.",
          });
        }
        current = next;
        continue;
      }
      break;
    }

    return json({ reachable: true, status, finalUrl: current.toString(), redirectChain: chain, hsts });
  } catch (e) {
    console.error("scan-url-probe error:", e);
    return json({ error: "Unexpected error while probing the URL." }, 500);
  }
});
