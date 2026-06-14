// Image metadata extraction — runs locally in the browser.
import exifr from "exifr";

export type ImageMeta = {
  fileName: string;
  format: string;
  fileSize: number; // bytes
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: string;
  colorProfile?: string;
  exif?: Record<string, string>;
  gps?: { latitude: number; longitude: number; mapsUrl: string };
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    img.src = url;
  });
}

const FORMAT_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
};

export async function extractMetadata(file: File): Promise<ImageMeta> {
  const { width, height } = await loadDimensions(file);
  const divisor = gcd(width, height) || 1;

  const meta: ImageMeta = {
    fileName: file.name,
    format: FORMAT_LABELS[file.type] ?? file.type ?? "Unknown",
    fileSize: file.size,
    width,
    height,
    megapixels: Math.round((width * height) / 100000) / 10,
    aspectRatio: `${width / divisor}:${height / divisor}`,
  };

  // EXIF parsing (best effort — mostly JPEG/TIFF).
  try {
    const exif = await exifr.parse(file, { gps: true, tiff: true, exif: true });
    if (exif) {
      const fields: Record<string, string> = {};
      const pick = (key: string, label: string, suffix = "") => {
        const v = exif[key];
        if (v !== undefined && v !== null && `${v}`.trim() !== "") {
          fields[label] = `${v}${suffix}`;
        }
      };
      pick("Make", "Camera Make");
      pick("Model", "Camera Model");
      pick("LensModel", "Lens");
      pick("ISO", "ISO");
      pick("FNumber", "Aperture", "");
      pick("ExposureTime", "Exposure");
      pick("FocalLength", "Focal Length", " mm");
      pick("DateTimeOriginal", "Taken At");
      pick("Software", "Software");
      pick("Orientation", "Orientation");
      if (exif.ColorSpace) {
        meta.colorProfile = exif.ColorSpace === 1 ? "sRGB" : `ColorSpace ${exif.ColorSpace}`;
      }
      if (Object.keys(fields).length) meta.exif = fields;

      if (typeof exif.latitude === "number" && typeof exif.longitude === "number") {
        meta.gps = {
          latitude: exif.latitude,
          longitude: exif.longitude,
          mapsUrl: `https://www.google.com/maps?q=${exif.latitude},${exif.longitude}`,
        };
      }
    }
  } catch {
    // No EXIF available — silently ignore.
  }

  return meta;
}
