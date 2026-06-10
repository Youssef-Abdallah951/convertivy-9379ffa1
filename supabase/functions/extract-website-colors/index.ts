const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RGB = { r: number; g: number; b: number };

const NAMED: Record<string, RGB> = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
};

function hexToRgb(hex: string): RGB | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function key(rgb: RGB) {
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

/** Pull every color token out of a chunk of CSS/HTML, weighting by frequency. */
function collectColors(text: string, counts: Map<string, { rgb: RGB; n: number }>) {
  const add = (rgb: RGB) => {
    const k = key(rgb);
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { rgb, n: 1 });
  };

  // #rrggbb / #rgb
  for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const rgb = hexToRgb(m[1]);
    if (rgb) add(rgb);
  }
  // rgb()/rgba()
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    add({ r: +m[1], g: +m[2], b: +m[3] });
  }
  // named colors
  for (const [name, rgb] of Object.entries(NAMED)) {
    const re = new RegExp(`[:\\s]${name}[;\\s}]`, "g");
    const found = text.match(re);
    if (found) for (let i = 0; i < found.length; i++) add(rgb);
  }
}

function dist(a: RGB, b: RGB) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ error: "Missing 'url'." }, 400);
    }

    let parsed: URL;
    try {
      parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return json({ error: "Invalid URL." }, 400);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return json({ error: "Only http(s) URLs are supported." }, 400);
    }

    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ConvertifyColorBot/1.0)" },
    });
    if (!res.ok) return json({ error: `Failed to fetch site (status ${res.status}).` }, 502);

    const html = await res.text();
    const counts = new Map<string, { rgb: RGB; n: number }>();
    collectColors(html, counts);

    // Fetch a few linked stylesheets for richer color data.
    const cssLinks = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)]
      .map((m) => m[1])
      .slice(0, 5);
    await Promise.all(
      cssLinks.map(async (href) => {
        try {
          const cssUrl = new URL(href, parsed).toString();
          const r = await fetch(cssUrl, { headers: { "User-Agent": "ConvertifyColorBot/1.0" } });
          if (r.ok) collectColors(await r.text(), counts);
        } catch {
          // ignore individual stylesheet failures
        }
      }),
    );

    if (counts.size === 0) {
      return json({ error: "No colors could be detected on that site." }, 422);
    }

    const sorted = [...counts.values()].sort((a, b) => b.n - a.n);

    // De-duplicate visually similar colors, keep the most frequent distinct ones.
    const picked: RGB[] = [];
    for (const { rgb } of sorted) {
      if (picked.every((p) => dist(p, rgb) > 36)) picked.push(rgb);
      if (picked.length >= 8) break;
    }

    return json({ colors: picked });
  } catch (e) {
    console.error("extract-website-colors error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
