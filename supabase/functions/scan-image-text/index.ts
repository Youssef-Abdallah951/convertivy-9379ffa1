// Edge function: scan-image-text
// Authenticated OCR for the Digital Risk Scanner. Extracts text from an image and
// returns normalised bounding boxes for regions that appear sensitive.
// The image is processed in memory only and is never stored.
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

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64_LEN = 12_000_000; // ~9 MB decoded

const SYSTEM_PROMPT = `You are an OCR and privacy-analysis engine.
Return ONLY minified JSON matching:
{"text":"<all readable text, exactly as shown>","regions":[{"label":"email|phone|id|card|address|name|qr|other","x":0.0,"y":0.0,"width":0.0,"height":0.0}]}
Rules:
- "text": every piece of readable text in the image. Empty string when there is none.
- "regions": ONLY rectangles around text that contains personal or sensitive data
  (emails, phone numbers, ID/passport numbers, card numbers, addresses, full names, credentials).
- Coordinates are fractions of image width/height between 0 and 1 (x,y = top-left corner).
- No commentary, no markdown fences.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { imageDataUrl, mimeType } = await req.json();

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return json({ error: "Provide the image as a data URL." }, 400);
    }
    if (imageDataUrl.length > MAX_BASE64_LEN) {
      return json({ error: "Image is too large. The limit is 8 MB." }, 400);
    }
    const declared = imageDataUrl.slice(5, imageDataUrl.indexOf(";"));
    if (!ALLOWED_MIME.includes(declared) || (mimeType && !ALLOWED_MIME.includes(mimeType))) {
      return json({ error: "Only JPG, PNG and WEBP images are supported." }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "Image analysis service is not configured." }, 500);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the text and sensitive regions from this image." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) return json({ error: "Rate limit reached. Try again shortly." }, 429);
    if (response.status === 402) return json({ error: "AI credits depleted." }, 402);
    if (!response.ok) {
      console.error("scan-image-text gateway error:", response.status, await response.text());
      return json({ error: "Could not analyse the image." }, 502);
    }

    const data = await response.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();

    let parsed: { text?: unknown; regions?: unknown } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Model returned prose; fall back to using it as plain OCR text.
      parsed = { text: cleaned, regions: [] };
    }

    const regions = Array.isArray(parsed.regions)
      ? (parsed.regions as Record<string, unknown>[])
          .filter((r) => ["x", "y", "width", "height"].every((k) => typeof r[k] === "number"))
          .slice(0, 40)
          .map((r) => ({
            label: typeof r.label === "string" ? r.label.slice(0, 32) : "sensitive",
            x: Number(r.x),
            y: Number(r.y),
            width: Number(r.width),
            height: Number(r.height),
          }))
      : [];

    return json({
      text: typeof parsed.text === "string" ? parsed.text.slice(0, 20000) : "",
      regions,
    });
  } catch (e) {
    console.error("scan-image-text error:", e);
    return json({ error: "Unexpected error while analysing the image." }, 500);
  }
});
