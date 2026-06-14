// Local image enhancement — runs entirely in the browser via canvas.
// Performs upscaling, denoise, and unsharp-mask sharpening. No data leaves the device.

export type EnhanceResult = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  scale: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load the image."));
    };
    img.src = url;
  });
}

/** Light box-blur denoise pass on RGBA data. */
function denoise(data: Uint8ClampedArray, w: number, h: number, strength: number) {
  const src = new Uint8ClampedArray(data);
  const idx = (x: number, y: number, c: number) => (y * w + x) * 4 + c;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += src[idx(x + dx, y + dy, c)];
          }
        }
        const avg = sum / 9;
        const orig = src[idx(x, y, c)];
        data[idx(x, y, c)] = orig + (avg - orig) * strength;
      }
    }
  }
}

/** Unsharp mask sharpening. */
function sharpen(data: Uint8ClampedArray, w: number, h: number, amount: number) {
  const src = new Uint8ClampedArray(data);
  const idx = (x: number, y: number, c: number) => (y * w + x) * 4 + c;
  // Laplacian-style kernel
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += src[idx(x + dx, y + dy, c)] * k[ki++];
          }
        }
        const orig = src[idx(x, y, c)];
        data[idx(x, y, c)] = orig + (sum - orig) * amount;
      }
    }
  }
}

/**
 * Enhance an image: upscale (capped for performance), denoise, and sharpen.
 * Returns a new blob plus dimensions/size info.
 */
export async function enhanceImage(file: File): Promise<EnhanceResult> {
  const img = await loadImage(file);
  const ow = img.naturalWidth;
  const oh = img.naturalHeight;

  // Scale up to 2x but cap the longest side to keep things responsive.
  const MAX_SIDE = 4000;
  let scale = 2;
  if (Math.max(ow, oh) * scale > MAX_SIDE) {
    scale = Math.max(1, MAX_SIDE / Math.max(ow, oh));
  }
  const nw = Math.round(ow * scale);
  const nh = Math.round(oh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, nw, nh);

  // Only run pixel passes for reasonably sized images to stay snappy.
  if (nw * nh <= 6_000_000) {
    const imgData = ctx.getImageData(0, 0, nw, nh);
    denoise(imgData.data, nw, nh, 0.35);
    sharpen(imgData.data, nw, nh, 0.6);
    ctx.putImageData(imgData, 0, 0);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to render the enhanced image."))),
      "image/png",
      0.95,
    );
  });

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: nw,
    height: nh,
    size: blob.size,
    scale: Math.round(scale * 100) / 100,
  };
}
