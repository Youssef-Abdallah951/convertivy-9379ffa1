export type RGB = { r: number; g: number; b: number };

export type SwatchRole =
  | "dominant"
  | "primary"
  | "secondary"
  | "accent"
  | "supporting"
  | "background"
  | "text";

export type Swatch = {
  hex: string;
  rgb: RGB;
  role: SwatchRole;
  label: string;
};

/** Clamp a number into the 0–255 byte range. */
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbString({ r, g, b }: RGB): string {
  return `RGB(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

/** Perceived luminance (0–255). Used to pick readable text on a swatch. */
export function luminance({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function readableText(rgb: RGB): string {
  return luminance(rgb) > 150 ? "#111111" : "#FFFFFF";
}

/* ---------- RGB <-> HSL ---------- */

function rgbToHsl({ r, g, b }: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: clamp(r * 255), g: clamp(g * 255), b: clamp(b * 255) };
}

/** Complementary color (hue rotated 180°). */
export function complementary(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb(h + 180, s, l);
}

/** A monochromatic ramp of `count` shades from the base color. */
export function monochromatic(rgb: RGB, count = 5): RGB[] {
  const [h, s] = rgbToHsl(rgb);
  const out: RGB[] = [];
  for (let i = 0; i < count; i++) {
    const l = 0.18 + (0.7 * i) / Math.max(1, count - 1);
    out.push(hslToRgb(h, Math.min(1, s + 0.05), l));
  }
  return out;
}

/* ---------- Image extraction ---------- */

function colorDistance(a: RGB, b: RGB): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/**
 * Extract the most frequent, visually distinct colors from an image File.
 * Runs entirely in the browser via a canvas. Resolves to ordered RGB list.
 */
export function extractColorsFromImage(file: File, maxColors = 8): Promise<RGB[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const MAX = 160;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        // Bucket colors by quantizing into a coarse grid, count frequencies.
        const buckets = new Map<string, { rgb: RGB; count: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 125) continue; // skip near-transparent pixels
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.count++;
            existing.rgb.r += r;
            existing.rgb.g += g;
            existing.rgb.b += b;
          } else {
            buckets.set(key, { rgb: { r, g, b }, count: 1 });
          }
        }

        const averaged = Array.from(buckets.values())
          .map((b) => ({
            count: b.count,
            rgb: {
              r: Math.round(b.rgb.r / b.count),
              g: Math.round(b.rgb.g / b.count),
              b: Math.round(b.rgb.b / b.count),
            },
          }))
          .sort((a, b) => b.count - a.count);

        // De-duplicate visually similar colors.
        const picked: RGB[] = [];
        for (const { rgb } of averaged) {
          if (picked.every((p) => colorDistance(p, rgb) > 40)) {
            picked.push(rgb);
          }
          if (picked.length >= maxColors) break;
        }

        URL.revokeObjectURL(url);
        if (picked.length === 0) {
          reject(new Error("No colors found in image."));
          return;
        }
        resolve(picked);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };
    img.src = url;
  });
}

/* ---------- Palette assembly ---------- */

const ROLE_LABELS: Record<SwatchRole, string> = {
  dominant: "Dominant",
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  supporting: "Supporting",
  background: "Background",
  text: "Text",
};

/** Turn an ordered list of colors into a labelled palette. */
export function buildPalette(colors: RGB[]): { dominant: Swatch; swatches: Swatch[] } {
  const make = (rgb: RGB, role: SwatchRole): Swatch => ({
    rgb,
    hex: rgbToHex(rgb),
    role,
    label: ROLE_LABELS[role],
  });

  const roleOrder: SwatchRole[] = [
    "primary",
    "secondary",
    "accent",
    "supporting",
    "supporting",
    "supporting",
    "supporting",
    "supporting",
  ];

  const dominant = make(colors[0], "dominant");
  const swatches = colors.map((c, i) => make(c, roleOrder[i] ?? "supporting"));

  return { dominant, swatches };
}

/* ---------- Exports ---------- */

export function paletteToCss(swatches: Swatch[]): string {
  const lines = swatches.map((s, i) => {
    const name =
      s.role === "supporting" ? `supporting-${i}` : s.role;
    return `  --${name}: ${s.hex.toLowerCase()};`;
  });
  return `:root {\n${lines.join("\n")}\n}`;
}

export function paletteToJson(swatches: Swatch[]): string {
  return JSON.stringify(
    swatches.map((s) => ({
      role: s.role,
      hex: s.hex,
      rgb: { r: s.rgb.r, g: s.rgb.g, b: s.rgb.b },
    })),
    null,
    2,
  );
}

export function paletteToTxt(swatches: Swatch[]): string {
  return swatches
    .map((s) => `${s.label.padEnd(12)} ${s.hex}   ${rgbString(s.rgb)}`)
    .join("\n");
}
