/** Minimal, read-only JPEG/TIFF EXIF reader — enough for metadata risk reporting. */

export type ExifData = {
  present: boolean;
  hasGps: boolean;
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  artist?: string;
};

const TAGS: Record<number, keyof ExifData> = {
  0x010f: "make",
  0x0110: "model",
  0x0131: "software",
  0x0132: "dateTime",
  0x013b: "artist",
};

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

/** Parses EXIF from a JPEG buffer. Returns `present:false` when there is none. */
export function readExif(buffer: ArrayBuffer): ExifData {
  const result: ExifData = { present: false, hasGps: false };
  const view = new DataView(buffer);
  if (view.byteLength < 4) return result;
  if (view.getUint16(0) !== 0xffd8) return result; // not a JPEG

  let offset = 2;
  let tiffStart = -1;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && readAscii(view, offset + 4, 4) === "Exif") {
      tiffStart = offset + 10;
      break;
    }
    if (marker === 0xda) break; // start of scan
    offset += 2 + size;
  }
  if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return result;

  result.present = true;
  const little = view.getUint16(tiffStart) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (ifd0 + 2 > view.byteLength) return result;
  const entries = u16(ifd0);

  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    if (tag === 0x8825) {
      result.hasGps = true;
      continue;
    }
    const key = TAGS[tag];
    if (!key || type !== 2) continue;
    const valueOffset = count > 4 ? tiffStart + u32(entry + 8) : entry + 8;
    if (valueOffset + count > view.byteLength) continue;
    const value = readAscii(view, valueOffset, Math.min(count, 128));
    if (value) (result as Record<string, unknown>)[key] = value;
  }

  return result;
}

/** Re-encodes an image through a canvas, which drops all EXIF/metadata. */
export async function stripImageMetadata(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not re-encode the image."))),
      type,
      0.92,
    ),
  );
}
