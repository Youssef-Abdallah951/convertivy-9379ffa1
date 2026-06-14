// Crypto & encoding analysis — runs entirely in the browser.
// Reuses the encode/decode primitives from the Universal Encoder library.

import { decode, type FormatKey } from "./encoders";

export type DetectionType =
  | "base64"
  | "url"
  | "rot13"
  | "hex"
  | "binary"
  | "unicode"
  | "caesar"
  | "md5"
  | "sha1"
  | "sha256"
  | "sha512"
  | "unknown";

export type Detection = {
  type: DetectionType;
  label: string;
  confidence: number; // 0 - 100
  reversible: boolean;
  /** Best-effort decoded preview, when reversible and decoding succeeds. */
  decoded?: string;
  note?: string;
};

export type CharAnalysis = {
  length: number;
  letters: number;
  digits: number;
  uppercase: number;
  lowercase: number;
  spaces: number;
  symbols: number;
  unique: number;
  entropyBits: number; // Shannon entropy per character
};

const HEX_RE = /^[0-9a-fA-F]+$/;

/** Shannon entropy (bits per character). */
function shannonEntropy(s: string): number {
  if (!s.length) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  let h = 0;
  for (const k in freq) {
    const p = freq[k] / s.length;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 100) / 100;
}

export function analyzeCharacters(input: string): CharAnalysis {
  let letters = 0,
    digits = 0,
    uppercase = 0,
    lowercase = 0,
    spaces = 0,
    symbols = 0;
  for (const ch of input) {
    if (/[a-zA-Z]/.test(ch)) {
      letters++;
      if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) uppercase++;
      else lowercase++;
    } else if (/[0-9]/.test(ch)) digits++;
    else if (/\s/.test(ch)) spaces++;
    else symbols++;
  }
  return {
    length: input.length,
    letters,
    digits,
    uppercase,
    lowercase,
    spaces,
    symbols,
    unique: new Set(input).size,
    entropyBits: shannonEntropy(input),
  };
}

const LABELS: Record<DetectionType, string> = {
  base64: "Base64",
  url: "URL Encoding",
  rot13: "ROT13",
  hex: "Hexadecimal",
  binary: "Binary",
  unicode: "Unicode Escapes",
  caesar: "Caesar Cipher",
  md5: "MD5 Hash",
  sha1: "SHA-1 Hash",
  sha256: "SHA-256 Hash",
  sha512: "SHA-512 Hash",
  unknown: "Unknown / Plain Text",
};

const REVERSIBLE: DetectionType[] = [
  "base64",
  "url",
  "rot13",
  "hex",
  "binary",
  "unicode",
  "caesar",
];

const FORMAT_FOR: Partial<Record<DetectionType, FormatKey>> = {
  base64: "base64",
  url: "url",
  rot13: "rot13",
  hex: "hex",
  binary: "binary",
  unicode: "unicode",
};

/** How "readable" a decoded string looks (ratio of printable ASCII). */
function readability(s: string): number {
  if (!s.length) return 0;
  let printable = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) printable++;
  }
  return printable / s.length;
}

/** Detect possible hash type purely from hex length. */
function detectHash(s: string): DetectionType | null {
  if (!HEX_RE.test(s)) return null;
  switch (s.length) {
    case 32:
      return "md5";
    case 40:
      return "sha1";
    case 64:
      return "sha256";
    case 128:
      return "sha512";
    default:
      return null;
  }
}

/** Caesar cipher shift helper. */
export function caesarShift(input: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return input.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

const COMMON_WORDS = [
  "the", "and", "you", "that", "this", "with", "have", "for", "are", "hello",
  "world", "from", "your", "what", "when", "name", "test", "secret", "message",
];

/** Score how English-like a string is (0 - 1) using common-word hits. */
function englishScore(s: string): number {
  const lower = s.toLowerCase();
  let hits = 0;
  for (const w of COMMON_WORDS) if (lower.includes(w)) hits++;
  const vowels = (lower.match(/[aeiou]/g) || []).length;
  const vowelRatio = s.length ? vowels / s.length : 0;
  return Math.min(1, hits * 0.25 + (vowelRatio > 0.25 && vowelRatio < 0.6 ? 0.3 : 0));
}

/** Try every Caesar shift and return the most English-like result. */
export function bestCaesar(input: string): { shift: number; text: string; score: number } {
  let best = { shift: 0, text: input, score: englishScore(input) };
  for (let shift = 1; shift < 26; shift++) {
    const text = caesarShift(input, shift);
    const score = englishScore(text);
    if (score > best.score) best = { shift, text, score };
  }
  return best;
}

function safeDecode(type: DetectionType, input: string): string | undefined {
  const fmt = FORMAT_FOR[type];
  if (!fmt) return undefined;
  try {
    const out = decode(fmt, input);
    return out;
  } catch {
    return undefined;
  }
}

/**
 * Analyze the input and return ranked detections (highest confidence first).
 */
export function analyzeCrypto(rawInput: string): Detection[] {
  const input = rawInput.trim();
  const results: Detection[] = [];
  if (!input) return results;

  // --- Hashes (check first; they are non-reversible) ---
  const hash = detectHash(input);
  if (hash) {
    results.push({
      type: hash,
      label: LABELS[hash],
      confidence: 95,
      reversible: false,
      note: "Cryptographic hash — cannot be reversed to the original input.",
    });
  }

  // --- Binary ---
  if (/^[01\s]+$/.test(input) && input.replace(/\s/g, "").length % 8 === 0) {
    const decoded = safeDecode("binary", input);
    results.push({
      type: "binary",
      label: LABELS.binary,
      confidence: decoded && readability(decoded) > 0.8 ? 96 : 80,
      reversible: true,
      decoded,
    });
  }

  // --- Unicode escapes ---
  if (/\\u[0-9a-fA-F]{4}/.test(input)) {
    const decoded = safeDecode("unicode", input);
    results.push({
      type: "unicode",
      label: LABELS.unicode,
      confidence: 92,
      reversible: true,
      decoded,
    });
  }

  // --- URL encoding ---
  if (/%[0-9a-fA-F]{2}/.test(input)) {
    const decoded = safeDecode("url", input);
    results.push({
      type: "url",
      label: LABELS.url,
      confidence: 90,
      reversible: true,
      decoded,
    });
  }

  // --- Hexadecimal (text, not hash length) ---
  const compactHex = input.replace(/0x/gi, "").replace(/\s/g, "");
  if (
    !hash &&
    HEX_RE.test(compactHex) &&
    compactHex.length >= 4 &&
    compactHex.length % 2 === 0
  ) {
    const decoded = safeDecode("hex", input);
    const conf = decoded && readability(decoded) > 0.85 ? 88 : 55;
    results.push({
      type: "hex",
      label: LABELS.hex,
      confidence: conf,
      reversible: true,
      decoded,
    });
  }

  // --- Base64 ---
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(input) && input.length % 4 === 0 && input.length >= 4) {
    const decoded = safeDecode("base64", input);
    const conf = decoded && readability(decoded) > 0.85 ? 97 : 60;
    results.push({
      type: "base64",
      label: LABELS.base64,
      confidence: conf,
      reversible: true,
      decoded,
    });
  }

  // --- Caesar / ROT13 (alphabetic content) ---
  if (/[a-zA-Z]/.test(input) && !/^[A-Za-z0-9+/]+={0,2}$/.test(input.replace(/\s/g, ""))) {
    const rot = safeDecode("rot13", input);
    if (rot && englishScore(rot) > englishScore(input) && englishScore(rot) > 0.2) {
      results.push({
        type: "rot13",
        label: LABELS.rot13,
        confidence: 78,
        reversible: true,
        decoded: rot,
      });
    }
    const caesar = bestCaesar(input);
    if (caesar.shift !== 0 && caesar.shift !== 13 && caesar.score > 0.25) {
      results.push({
        type: "caesar",
        label: `${LABELS.caesar} (shift ${caesar.shift})`,
        confidence: Math.round(60 + caesar.score * 30),
        reversible: true,
        decoded: caesar.text,
        note: `Best-guess shift of ${caesar.shift}.`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      type: "unknown",
      label: LABELS.unknown,
      confidence: 100,
      reversible: false,
      note: "Looks like plain text or an unrecognized format.",
    });
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .map((r) => ({ ...r, reversible: REVERSIBLE.includes(r.type) }));
}

// ---------------- Hash information ----------------
export type HashInfo = {
  type: string;
  bits: number;
  hexLength: number;
  security: "Broken" | "Weak" | "Strong";
  reversible: false;
  usage: string;
  matches: boolean;
};

const HASH_TABLE: Record<number, Omit<HashInfo, "matches" | "reversible">> = {
  32: {
    type: "MD5",
    bits: 128,
    hexLength: 32,
    security: "Broken",
    usage: "Legacy checksums & file integrity. Not safe for passwords or signatures.",
  },
  40: {
    type: "SHA-1",
    bits: 160,
    hexLength: 40,
    security: "Weak",
    usage: "Legacy Git object IDs & certificates. Deprecated for security.",
  },
  64: {
    type: "SHA-256",
    bits: 256,
    hexLength: 64,
    security: "Strong",
    usage: "Blockchain, TLS certificates, password hashing (with salt), signatures.",
  },
  128: {
    type: "SHA-512",
    bits: 512,
    hexLength: 128,
    security: "Strong",
    usage: "High-security hashing, digital signatures, key derivation.",
  },
};

export function identifyHash(rawInput: string): HashInfo | null {
  const s = rawInput.trim();
  if (!HEX_RE.test(s)) return null;
  const base = HASH_TABLE[s.length];
  if (!base) return null;
  return { ...base, reversible: false, matches: true };
}

/** Compute common hashes for a given text (SHA family via Web Crypto). */
export async function computeHashes(
  text: string,
): Promise<{ algo: string; hex: string }[]> {
  const data = new TextEncoder().encode(text);
  const algos: { name: string; algo: AlgorithmIdentifier }[] = [
    { name: "SHA-1", algo: "SHA-1" },
    { name: "SHA-256", algo: "SHA-256" },
    { name: "SHA-512", algo: "SHA-512" },
  ];
  const out: { algo: string; hex: string }[] = [];
  for (const { name, algo } of algos) {
    const buf = await crypto.subtle.digest(algo, data);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    out.push({ algo: name, hex });
  }
  return out;
}
