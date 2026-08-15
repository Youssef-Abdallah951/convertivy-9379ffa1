/**
 * File scanner. Everything runs locally in the browser — uploaded files are read
 * as bytes only and are never executed, never uploaded and never stored.
 */

import mammoth from "mammoth";
import type { Finding } from "./engine";
import { buildResult, type ScanResult } from "./engine";
import { analyzePrivacy, extractUrls } from "./patterns";
import { analyzeUrl } from "./url";
import { readExif } from "./exif";

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Extensions accepted for analysis (document / text / archive / image formats). */
export const ALLOWED_EXTENSIONS = [
  "pdf", "docx", "doc", "txt", "md", "csv", "json", "xml", "rtf", "log",
  "zip", "png", "jpg", "jpeg", "webp", "gif", "svg", "xlsx", "pptx",
];

/** Extensions we refuse to analyse at all — they are executable/script formats. */
export const DANGEROUS_EXTENSIONS = [
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "ps1", "psm1", "sh", "bash", "jar", "apk", "app", "dmg", "deb",
  "rpm", "dll", "sys", "hta", "reg", "iso", "img",
];

const DOUBLE_EXT =
  /\.(pdf|docx?|txt|jpe?g|png|xlsx?|pptx?|zip|csv)\.(exe|scr|bat|cmd|js|vbs|jar|apk|ps1|com|pif|hta)$/i;

export type FileValidation =
  | { ok: true; extension: string }
  | { ok: false; reason: string };

export function extensionOf(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop()! : "";
}

export function validateFile(file: File): FileValidation {
  const extension = extensionOf(file.name);

  if (file.size === 0) return { ok: false, reason: "The file is empty." };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `File is too large (${(file.size / 1048576).toFixed(1)} MB). The limit is 15 MB.`,
    };
  }
  if (DOUBLE_EXT.test(file.name)) {
    return {
      ok: false,
      reason: "Rejected: this file uses a double extension, a common malware disguise.",
    };
  }
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: `Rejected for safety: ".${extension}" is an executable or script format and is never analysed here.`,
    };
  }
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: `Unsupported file type ".${extension || "unknown"}". Supported: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    };
  }
  return { ok: true, extension };
}

/** Magic-byte sniffing (no execution, just header comparison). */
function sniffType(bytes: Uint8Array): string | null {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return "zip"; // also docx/xlsx/pptx
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith([0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith([0x52, 0x49, 0x46, 0x46])) return "webp";
  if (startsWith([0x4d, 0x5a])) return "mz-executable";
  if (startsWith([0x7f, 0x45, 0x4c, 0x46])) return "elf-executable";
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) return "ole"; // legacy .doc/.xls
  if (startsWith([0x52, 0x61, 0x72, 0x21])) return "rar";
  if (startsWith([0x37, 0x7a, 0xbc, 0xaf])) return "7z";
  return null;
}

const EXPECTED_SNIFF: Record<string, string[]> = {
  pdf: ["pdf"],
  docx: ["zip"],
  xlsx: ["zip"],
  pptx: ["zip"],
  zip: ["zip"],
  doc: ["ole"],
  png: ["png"],
  jpg: ["jpeg"],
  jpeg: ["jpeg"],
  gif: ["gif"],
  webp: ["webp"],
};

/** Reads ZIP local-file-header names without decompressing any content. */
function listZipEntries(bytes: Uint8Array): string[] {
  const names: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i + 30 < bytes.length && names.length < 400; i++) {
    if (
      bytes[i] === 0x50 && bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04
    ) {
      const nameLen = view.getUint16(i + 26, true);
      const extraLen = view.getUint16(i + 28, true);
      if (nameLen > 0 && nameLen < 512 && i + 30 + nameLen <= bytes.length) {
        const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
        if (name) names.push(name);
        i += 29 + nameLen + extraLen;
      }
    }
  }
  return names;
}

const RISKY_IN_ARCHIVE = new RegExp(
  `\\.(${[...DANGEROUS_EXTENSIONS, "lnk", "chm", "docm", "xlsm", "pptm"].join("|")})$`,
  "i",
);

/** Latin-1 decode so binary formats can still be pattern-scanned safely. */
function toLatin1(bytes: Uint8Array, limit = 3_000_000): string {
  const slice = bytes.subarray(0, limit);
  let out = "";
  const chunk = 32768;
  for (let i = 0; i < slice.length; i += chunk) {
    out += String.fromCharCode(...slice.subarray(i, i + chunk));
  }
  return out;
}

function pdfMeta(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const grab = (key: string) => {
    const m = raw.match(new RegExp(`/${key}\\s*\\(([^)]{1,120})\\)`));
    return m?.[1]?.replace(/\\/g, "").trim();
  };
  for (const key of ["Author", "Creator", "Producer", "Title", "CreationDate", "ModDate"]) {
    const v = grab(key);
    if (v) meta[key] = v;
  }
  return meta;
}

export type FileScanInput = { file: File; extractedText?: string };

export async function analyzeFile(file: File): Promise<{ result: ScanResult; text: string }> {
  const findings: Finding[] = [];
  const passed: string[] = [];
  const extension = extensionOf(file.name);

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sniffed = sniffType(bytes);

  // --- File security -------------------------------------------------------
  if (sniffed === "mz-executable" || sniffed === "elf-executable") {
    findings.push({
      id: "file-executable-content",
      severity: "critical",
      category: "Security",
      title: "Executable content detected",
      description: `The file's internal header identifies it as a program (${sniffed.replace("-executable", "").toUpperCase()}), not a "${extension}" document.`,
      reason: "A program disguised as a document is a direct malware indicator.",
      recommendation: "Delete this file and do not open it. Never run files received unexpectedly.",
    });
  }

  const expected = EXPECTED_SNIFF[extension];
  if (expected && sniffed && !expected.includes(sniffed)) {
    findings.push({
      id: "file-mime-mismatch",
      severity: "high",
      category: "Security",
      title: "File type mismatch",
      description: `The name says ".${extension}" but the actual content looks like "${sniffed}".`,
      reason: "Attackers rename files so victims open them with an unexpected application.",
      recommendation: "Do not open the file with the application implied by its name.",
    });
  } else if (expected && sniffed) {
    passed.push("File content matches its extension");
  }

  if (file.type && expected) {
    const declaredOk =
      file.type.includes(extension) ||
      (extension === "jpg" && file.type === "image/jpeg") ||
      (["docx", "xlsx", "pptx", "zip"].includes(extension) && /zip|officedocument|msword/.test(file.type));
    if (!declaredOk) {
      findings.push({
        id: "file-declared-mime",
        severity: "low",
        category: "Security",
        title: "Declared MIME type is inconsistent",
        description: `The browser reported "${file.type}" for a ".${extension}" file.`,
        reason: "Inconsistent MIME reporting can indicate a manipulated or mislabelled file.",
        recommendation: "Confirm with the sender that the file is what it claims to be.",
      });
    }
  }

  let text = "";
  const raw = toLatin1(bytes);

  // --- Format-specific analysis -------------------------------------------
  if (extension === "pdf" || sniffed === "pdf") {
    const active = [
      { pattern: /\/JavaScript|\/JS\b/, label: "embedded JavaScript" },
      { pattern: /\/OpenAction/, label: "auto-run action on open" },
      { pattern: /\/Launch/, label: "external program launch action" },
      { pattern: /\/EmbeddedFile/, label: "embedded file attachment" },
      { pattern: /\/SubmitForm/, label: "form data submission" },
    ].filter((c) => c.pattern.test(raw));
    if (active.length) {
      findings.push({
        id: "file-pdf-active",
        severity: active.some((a) => /JavaScript|launch|auto-run/i.test(a.label)) ? "high" : "medium",
        category: "Security",
        title: "Active content inside the PDF",
        description: `Detected: ${active.map((a) => a.label).join(", ")}.`,
        reason: "PDFs can run scripts or launch programs — a known malware delivery technique.",
        recommendation: "Open the PDF only in a browser viewer with JavaScript disabled, if at all.",
      });
    } else {
      passed.push("No executable or active content detected");
    }

    const meta = pdfMeta(raw);
    if (Object.keys(meta).length) {
      findings.push({
        id: "file-pdf-metadata",
        severity: "low",
        category: "Metadata",
        title: "Document metadata detected",
        description: Object.entries(meta)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
          .slice(0, 300),
        reason: "Metadata can reveal the author, organisation and software used to create the file.",
        recommendation: "Remove metadata before publishing the document if it should stay anonymous.",
      });
    }

    // Readable text streams (uncompressed) give a useful privacy signal.
    text = (raw.match(/\((?:[^()\\]|\\.){2,}\)/g) ?? [])
      .map((s) => s.slice(1, -1))
      .join(" ")
      .slice(0, 200_000);
  }

  if (["docx", "xlsx", "pptx", "zip"].includes(extension) || sniffed === "zip") {
    const entries = listZipEntries(bytes);
    const risky = entries.filter((e) => RISKY_IN_ARCHIVE.test(e));
    const traversal = entries.filter((e) => e.includes("../") || e.startsWith("/"));
    const macros = entries.filter((e) => /vbaProject\.bin|\.bin$/i.test(e) && /vba/i.test(e));

    if (entries.length) {
      passed.push(`Archive listed safely (${entries.length} entries, nothing extracted)`);
    }
    if (risky.length) {
      findings.push({
        id: "file-archive-risky",
        severity: "critical",
        category: "Security",
        title: "Archive contains executable or script files",
        description: `${risky.length} risky entry(ies) inside the archive.`,
        reason: "Archives are used to smuggle executables past email and chat filters.",
        recommendation: "Do not extract or run the contents. Delete the archive.",
        evidence: risky.slice(0, 3),
      });
    }
    if (macros.length) {
      findings.push({
        id: "file-macros",
        severity: "high",
        category: "Security",
        title: "Office macros detected",
        description: "The document contains a VBA macro project.",
        reason: "Macros execute code as soon as editing is enabled and are a classic infection route.",
        recommendation: "Never enable macros or editing on documents from untrusted sources.",
        evidence: macros.slice(0, 2),
      });
    }
    if (traversal.length) {
      findings.push({
        id: "file-zip-traversal",
        severity: "high",
        category: "Security",
        title: "Path traversal entries in archive",
        description: "Entry names try to escape the extraction folder.",
        reason: "Zip-slip archives can overwrite files elsewhere on your system when extracted.",
        recommendation: "Do not extract this archive.",
        evidence: traversal.slice(0, 3),
      });
    }
    if (entries.some((e) => /^docProps\//i.test(e))) {
      findings.push({
        id: "file-office-metadata",
        severity: "low",
        category: "Metadata",
        title: "Office document metadata present",
        description: "The document carries author/creation properties (docProps).",
        reason: "Office metadata commonly exposes the author name, company and edit history.",
        recommendation: "Use Inspect Document → Remove Personal Information before sharing.",
      });
    }
  }

  if (extension === "docx") {
    try {
      const out = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = out.value ?? "";
    } catch {
      // Unreadable docx: privacy scan simply falls back to raw strings.
    }
  }

  if (["txt", "md", "csv", "json", "xml", "log", "rtf", "svg"].includes(extension)) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 2_000_000));
    if (extension === "svg" && /<script|onload=|javascript:/i.test(text)) {
      findings.push({
        id: "file-svg-script",
        severity: "high",
        category: "Security",
        title: "Script content inside SVG image",
        description: "The SVG contains script tags or inline event handlers.",
        reason: "SVG files are XML and can execute JavaScript when opened in a browser.",
        recommendation: "Do not open this SVG in a browser; convert it to PNG instead.",
      });
    }
  }

  if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) {
    const exif = readExif(buffer);
    if (exif.present) {
      const bits = [
        exif.make && `Camera: ${exif.make} ${exif.model ?? ""}`.trim(),
        exif.software && `Software: ${exif.software}`,
        exif.dateTime && `Captured: ${exif.dateTime}`,
        exif.artist && `Author: ${exif.artist}`,
      ].filter(Boolean) as string[];
      findings.push({
        id: "file-exif",
        severity: "low",
        category: "Metadata",
        title: "Image metadata (EXIF) detected",
        description: bits.length ? bits.join(" · ") : "The image carries an EXIF metadata block.",
        reason: "EXIF can reveal your device, editing software and exact capture time.",
        recommendation: "Strip metadata before publishing the image online.",
      });
    }
    if (exif.hasGps) {
      findings.push({
        id: "file-gps",
        severity: "high",
        category: "Privacy",
        title: "GPS location metadata detected",
        description: "The image contains embedded geolocation data.",
        reason: "GPS metadata can reveal your home, school or workplace to anyone who receives the file.",
        recommendation: "Remove the location metadata before sharing this photo.",
      });
    }
  }

  // --- URLs & privacy ------------------------------------------------------
  const scanText = text && text.length > 40 ? text : raw.slice(0, 400_000);
  const urls = extractUrls(scanText).slice(0, 40);
  if (urls.length) {
    const scored = urls.map((u) => ({ url: u, score: analyzeUrl(u).score }));
    const risky = scored.filter((s) => s.score > 20).sort((a, b) => b.score - a.score);
    if (risky.length) {
      findings.push({
        id: "file-suspicious-url",
        severity: risky[0].score > 60 ? "critical" : "high",
        category: "Phishing",
        title: "Suspicious external URL",
        description: `${risky.length} of ${urls.length} embedded link(s) show suspicious characteristics.`,
        reason: "Documents are frequently used to deliver phishing links that bypass email filters.",
        recommendation:
          "Do not enter passwords or financial information on these links until the destination is verified.",
        evidence: risky.slice(0, 3).map((r) => r.url.slice(0, 80)),
      });
    } else {
      findings.push({
        id: "file-urls",
        severity: "info",
        category: "Security",
        title: "External links found",
        description: `${urls.length} external link(s) embedded in the file.`,
        reason: "Even normal-looking links should be verified before they are opened.",
        recommendation: "Hover over links to check their destination before clicking.",
        evidence: urls.slice(0, 3).map((u) => u.slice(0, 80)),
      });
    }
  } else {
    passed.push("No external URLs found");
  }

  const privacy = analyzePrivacy(scanText, "the document");
  findings.push(...privacy);
  if (privacy.length === 0) passed.push("No personal information detected");

  if (!findings.some((f) => f.category === "Metadata")) {
    passed.push("No identifying metadata detected");
  }

  return {
    result: buildResult(
      "File",
      `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
      findings,
      passed,
    ),
    text: scanText,
  };
}
