import { getAuthenticatedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-type, content-length, content-disposition, x-filename",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function filenameFromUrl(url: string, contentDisposition: string | null): string {
  if (contentDisposition) {
    const m =
      contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
      contentDisposition.match(/filename="?([^";]+)"?/i);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // ignore
  }
  return "download";
}

const BLOCKED_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|::$|fe80|fc|fd)/i;
const BLOCKED_HOST = /^(localhost|\[?::1\]?|0\.0\.0\.0|.*\.local|.*\.internal)$/i;

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url' in request body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Only http(s) URLs are supported." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (await isBlockedHost(parsed.hostname)) {
      return new Response(JSON.stringify({ error: "URL not allowed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(parsed.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "SmartTools-LinkToFile/1.0" },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response(JSON.stringify({ error: "Redirects are not supported." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch (status ${upstream.status}).` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large. Max 50 MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large. Max 50 MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const filename = filenameFromUrl(parsed.toString(), upstream.headers.get("content-disposition"));

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(buf.byteLength),
        "X-Filename": encodeURIComponent(filename),
      },
    });
  } catch (e) {
    console.error("fetch-url-file error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
