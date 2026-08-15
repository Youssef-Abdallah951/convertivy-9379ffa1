/** Image scanner: OCR (server-side), QR detection and metadata/privacy analysis. */

import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import type { Finding } from "./engine";
import { buildResult, type ScanResult } from "./engine";
import { analyzePrivacy, extractUrls } from "./patterns";
import { analyzeUrl } from "./url";
import { readExif } from "./exif";

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Normalised 0..1 rectangle around a sensitive text region, for redaction. */
export type SensitiveRegion = { label: string; x: number; y: number; width: number; height: number };

export type ImageOcr = { text: string; regions: SensitiveRegion[] };

export function validateImage(file: File): { ok: true } | { ok: false; reason: string } {
  if (!IMAGE_MIME.includes(file.type)) {
    return { ok: false, reason: "Please upload a JPG, PNG or WEBP image." };
  }
  if (file.size === 0) return { ok: false, reason: "The image is empty." };
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `Image is too large (${(file.size / 1048576).toFixed(1)} MB). The limit is 8 MB.`,
    };
  }
  return { ok: true };
}

async function toDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Runs OCR through the authenticated edge function (no API key in the browser). */
export async function ocrImage(file: File): Promise<ImageOcr> {
  const dataUrl = await toDataUrl(file);
  const { data, error } = await supabase.functions.invoke("scan-image-text", {
    body: { imageDataUrl: dataUrl, mimeType: file.type },
  });
  if (error) throw new Error(error.message || "Image analysis failed.");
  if (data?.error) throw new Error(data.error);
  const regions: SensitiveRegion[] = Array.isArray(data?.regions)
    ? data.regions
        .filter(
          (r: SensitiveRegion) =>
            typeof r?.x === "number" && typeof r?.y === "number" &&
            typeof r?.width === "number" && typeof r?.height === "number",
        )
        .map((r: SensitiveRegion) => ({
          label: String(r.label ?? "sensitive"),
          x: Math.max(0, Math.min(1, r.x)),
          y: Math.max(0, Math.min(1, r.y)),
          width: Math.max(0, Math.min(1, r.width)),
          height: Math.max(0, Math.min(1, r.height)),
        }))
    : [];
  return { text: typeof data?.text === "string" ? data.text : "", regions };
}

async function detectQr(file: File): Promise<string | null> {
  const host = document.createElement("div");
  host.id = `qr-scan-${Math.random().toString(36).slice(2)}`;
  host.style.display = "none";
  document.body.appendChild(host);
  try {
    const scanner = new Html5Qrcode(host.id, { verbose: false });
    const value = await scanner.scanFile(file, false);
    return value || null;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

export async function analyzeImage(
  file: File,
): Promise<{ result: ScanResult; ocr: ImageOcr; qr: string | null }> {
  const findings: Finding[] = [];
  const passed: string[] = [];

  const buffer = await file.arrayBuffer();
  const exif = readExif(buffer);
  const [ocr, qr] = await Promise.all([ocrImage(file), detectQr(file)]);

  const text = ocr.text.trim();
  if (text) {
    const privacy = analyzePrivacy(text, "the image text");
    findings.push(...privacy);
    if (privacy.length === 0) passed.push("No personal information found in the image text");

    if (/\b(passport|national id|driver'?s licen[cs]e|id card|birth certificate|bank statement|invoice|payslip|visa)\b/i.test(text)) {
      findings.push({
        id: "img-document",
        severity: "high",
        category: "Privacy",
        title: "Sensitive document detected",
        description: "The image text mentions an identity or financial document.",
        reason: "Photos of official documents are the most valuable material for identity fraud.",
        recommendation: "Do not share this image; redact identifiers before any upload.",
      });
    }

    const urls = extractUrls(text);
    if (urls.length) {
      const worst = urls.map((u) => ({ url: u, score: analyzeUrl(u).score })).sort((a, b) => b.score - a.score)[0];
      findings.push({
        id: "img-url",
        severity: worst.score > 40 ? "high" : "low",
        category: worst.score > 40 ? "Phishing" : "Security",
        title: worst.score > 40 ? "Suspicious URL inside the image" : "URL detected in the image",
        description: `${urls.length} link(s) recognised in the image text.`,
        reason:
          "Links inside screenshots are often used because image text bypasses automated link filters.",
        recommendation: "Type the address manually after verifying the domain, or avoid it entirely.",
        evidence: urls.slice(0, 3).map((u) => u.slice(0, 80)),
      });
    }
  } else {
    passed.push("No readable text found in the image");
  }

  if (qr) {
    const qrUrl = /^https?:\/\//i.test(qr) ? analyzeUrl(qr) : null;
    findings.push({
      id: "img-qr",
      severity: qrUrl && qrUrl.score > 40 ? "high" : "medium",
      category: qrUrl && qrUrl.score > 40 ? "Phishing" : "Security",
      title: "QR code detected",
      description: qrUrl
        ? `The QR code opens a link (risk score ${qrUrl.score}/100).`
        : "The QR code contains non-link data.",
      reason: "QR codes hide their destination, which is why they are widely used in payment scams.",
      recommendation: "Always read the decoded address before opening a QR link.",
      evidence: [qr.slice(0, 90)],
    });
  } else {
    passed.push("No QR code detected");
  }

  if (exif.present) {
    const bits = [
      exif.make && `Camera: ${exif.make} ${exif.model ?? ""}`.trim(),
      exif.software && `Software: ${exif.software}`,
      exif.dateTime && `Captured: ${exif.dateTime}`,
      exif.artist && `Author: ${exif.artist}`,
    ].filter(Boolean) as string[];
    findings.push({
      id: "img-exif",
      severity: "low",
      category: "Metadata",
      title: "Image metadata (EXIF) detected",
      description: bits.length ? bits.join(" · ") : "The image carries an EXIF metadata block.",
      reason: "EXIF reveals the device, software and exact time the photo was taken.",
      recommendation: "Use “Remove Metadata” below before sharing the image.",
    });
  } else {
    passed.push("No EXIF metadata found");
  }

  if (exif.hasGps) {
    findings.push({
      id: "img-gps",
      severity: "high",
      category: "Privacy",
      title: "GPS location metadata detected",
      description: "The photo contains embedded coordinates.",
      reason: "Location metadata can expose where you live, study or work.",
      recommendation: "Remove the metadata before sharing this photo anywhere.",
    });
  }

  return {
    result: buildResult("Image", `${file.name} (${(file.size / 1024).toFixed(0)} KB)`, findings, passed),
    ocr,
    qr,
  };
}

/** Draws opaque boxes over detected sensitive regions and returns a PNG blob. */
export async function redactImage(file: File, regions: SensitiveRegion[]): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0);
  ctx.fillStyle = "#000000";
  regions.forEach((r) => {
    ctx.fillRect(
      r.x * canvas.width,
      r.y * canvas.height,
      Math.max(4, r.width * canvas.width),
      Math.max(4, r.height * canvas.height),
    );
  });
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the redacted image."))),
      "image/png",
    ),
  );
}
