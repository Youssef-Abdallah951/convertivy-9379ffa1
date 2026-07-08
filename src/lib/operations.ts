// Universal Encoder / Decoder — operation registry.
// Everything runs entirely in the browser. No data ever leaves the device.
import CryptoJS from "crypto-js";

export type Category =
  | "Encoding"
  | "Web"
  | "Unicode"
  | "Numbers"
  | "Text"
  | "Security"
  | "Ciphers"
  | "Developer"
  | "Utilities";

export const CATEGORY_ORDER: Category[] = [
  "Encoding",
  "Web",
  "Unicode",
  "Numbers",
  "Text",
  "Security",
  "Ciphers",
  "Developer",
  "Utilities",
];

export type OpParam = {
  key: string;
  label: string;
  type: "text" | "number";
  default: string;
};

export type Operation = {
  id: string;
  name: string;
  category: Category;
  keywords: string[];
  /** Reversible ops expose an Encode/Decode toggle. */
  reversible?: boolean;
  /** Label for the run button of one-way ops (default "Run"). */
  actionLabel?: string;
  params?: OpParam[];
  encode?: (input: string, p: Record<string, string>) => string;
  decode?: (input: string, p: Record<string, string>) => string;
  /** One-way transform (hashes, JSON, text utils). */
  run?: (input: string, p: Record<string, string>) => string;
};

// ============================================================
// Byte helpers
// ============================================================
const enc = new TextEncoder();
const dec = new TextDecoder();

function toBytes(str: string): Uint8Array {
  return enc.encode(str);
}
function fromBytes(bytes: Uint8Array): string {
  return dec.decode(bytes);
}

// ============================================================
// Base16 / Hex
// ============================================================
function toHex(str: string): string {
  return Array.from(toBytes(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function fromHex(str: string): string {
  const clean = str.trim().replace(/0x/gi, "").replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("Invalid hexadecimal input.");
  }
  return fromBytes(Uint8Array.from(clean.match(/.{2}/g)!.map((h) => parseInt(h, 16))));
}

// ============================================================
// Base32 (RFC 4648)
// ============================================================
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(str: string): string {
  const bytes = toBytes(str);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
}
function fromBase32(str: string): string {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  if (!/^[A-Z2-7]*$/.test(clean)) throw new Error("Invalid Base32 input.");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return fromBytes(Uint8Array.from(out));
}

// ============================================================
// Base45 (RFC 9285)
// ============================================================
const B45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
function toBase45(str: string): string {
  const bytes = toBytes(str);
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const x = bytes[i] * 256 + bytes[i + 1];
      const e = Math.floor(x / 2025);
      const d = Math.floor((x % 2025) / 45);
      const c = x % 45;
      out += B45_ALPHABET[c] + B45_ALPHABET[d] + B45_ALPHABET[e];
    } else {
      const x = bytes[i];
      const d = Math.floor(x / 45);
      const c = x % 45;
      out += B45_ALPHABET[c] + B45_ALPHABET[d];
    }
  }
  return out;
}
function fromBase45(str: string): string {
  const clean = str.replace(/\s+/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; ) {
    if (clean.length - i >= 3) {
      const c = B45_ALPHABET.indexOf(clean[i]);
      const d = B45_ALPHABET.indexOf(clean[i + 1]);
      const e = B45_ALPHABET.indexOf(clean[i + 2]);
      if (c < 0 || d < 0 || e < 0) throw new Error("Invalid Base45 input.");
      const x = c + d * 45 + e * 2025;
      if (x > 0xffff) throw new Error("Invalid Base45 input.");
      out.push(Math.floor(x / 256), x % 256);
      i += 3;
    } else if (clean.length - i === 2) {
      const c = B45_ALPHABET.indexOf(clean[i]);
      const d = B45_ALPHABET.indexOf(clean[i + 1]);
      if (c < 0 || d < 0) throw new Error("Invalid Base45 input.");
      out.push(c + d * 45);
      i += 2;
    } else {
      throw new Error("Invalid Base45 length.");
    }
  }
  return fromBytes(Uint8Array.from(out));
}

// ============================================================
// Generic big-integer base (Base58 / Base62)
// ============================================================
function baseXEncode(str: string, alphabet: string): string {
  const bytes = toBytes(str);
  if (bytes.length === 0) return "";
  const base = BigInt(alphabet.length);
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = "";
  while (num > 0n) {
    out = alphabet[Number(num % base)] + out;
    num /= base;
  }
  // Preserve leading zero bytes.
  for (const b of bytes) {
    if (b === 0) out = alphabet[0] + out;
    else break;
  }
  return out;
}
function baseXDecode(str: string, alphabet: string, name: string): string {
  const clean = str.trim().replace(/\s+/g, "");
  if (clean === "") return "";
  const base = BigInt(alphabet.length);
  let num = 0n;
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid ${name} input.`);
    num = num * base + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num /= 256n;
  }
  for (const ch of clean) {
    if (ch === alphabet[0]) bytes.unshift(0);
    else break;
  }
  return fromBytes(Uint8Array.from(bytes));
}
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// ============================================================
// Base64 (UTF-8 safe) + Base85 (ASCII85)
// ============================================================
function toBase64(str: string): string {
  let binary = "";
  toBytes(str).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
function fromBase64(str: string): string {
  const s = str.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Invalid Base64 input.");
  try {
    const binary = atob(s);
    return fromBytes(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error("Invalid Base64 input.");
  }
}
function toBase85(str: string): string {
  const bytes = toBytes(str);
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4);
    const pad = 4 - chunk.length;
    let n = 0;
    for (let j = 0; j < 4; j++) n = n * 256 + (chunk[j] ?? 0);
    if (n === 0 && pad === 0) {
      out += "z";
      continue;
    }
    const group: string[] = [];
    for (let j = 0; j < 5; j++) {
      group.unshift(String.fromCharCode((n % 85) + 33));
      n = Math.floor(n / 85);
    }
    out += group.join("").slice(0, 5 - pad);
  }
  return out;
}
function fromBase85(str: string): string {
  let s = str.trim().replace(/^<~/, "").replace(/~>$/, "").replace(/\s+/g, "");
  const out: number[] = [];
  s = s.replace(/z/g, "!!!!!"); // z → 4 zero bytes
  for (let i = 0; i < s.length; i += 5) {
    const chunk = s.slice(i, i + 5);
    const pad = 5 - chunk.length;
    let n = 0;
    for (let j = 0; j < 5; j++) {
      const c = j < chunk.length ? chunk.charCodeAt(j) - 33 : 84;
      if (c < 0 || c > 84) throw new Error("Invalid Base85 input.");
      n = n * 85 + c;
    }
    const bytes = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    for (let j = 0; j < 4 - pad; j++) out.push(bytes[j]);
  }
  return fromBytes(Uint8Array.from(out));
}

// ============================================================
// Web: URL + HTML
// ============================================================
function encodeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function decodeHtml(str: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

// ============================================================
// Unicode escape
// ============================================================
function toUnicode(str: string): string {
  return Array.from(str)
    .map((c) => "\\u" + c.codePointAt(0)!.toString(16).padStart(4, "0"))
    .join("");
}
function fromUnicode(str: string): string {
  const matches = str.match(/\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4}|./gs);
  if (!matches) return "";
  return matches
    .map((m) => {
      if (m.startsWith("\\u{")) return String.fromCodePoint(parseInt(m.slice(3, -1), 16));
      if (m.startsWith("\\u")) return String.fromCodePoint(parseInt(m.slice(2), 16));
      return m;
    })
    .join("");
}

// ============================================================
// Numbers: binary / octal / decimal / hex representations of bytes
// ============================================================
function bytesToRadix(str: string, radix: number, pad: number): string {
  return Array.from(toBytes(str))
    .map((b) => b.toString(radix).padStart(pad, "0"))
    .join(" ");
}
function radixToBytes(str: string, radix: number, name: string): string {
  const groups = str.trim().split(/\s+/).filter(Boolean);
  const valid = radix === 2 ? /^[01]+$/ : radix === 8 ? /^[0-7]+$/ : radix === 16 ? /^[0-9a-fA-F]+$/ : /^\d+$/;
  const bytes = groups.map((g) => {
    if (!valid.test(g)) throw new Error(`Invalid ${name} input.`);
    const n = parseInt(g, radix);
    if (n > 255) throw new Error(`${name} value out of byte range: ${g}`);
    return n;
  });
  return fromBytes(Uint8Array.from(bytes));
}

// ============================================================
// Text: ASCII / UTF-8 / UTF-16 code points
// ============================================================
function toCodePoints(str: string): string {
  return Array.from(str).map((c) => c.codePointAt(0)).join(" ");
}
function fromCodePoints(str: string): string {
  const codes = str.trim().split(/\s+/).filter(Boolean);
  return codes
    .map((c) => {
      if (!/^\d+$/.test(c)) throw new Error("Expected space-separated numbers.");
      return String.fromCodePoint(parseInt(c, 10));
    })
    .join("");
}
function toUtf8Bytes(str: string): string {
  return Array.from(toBytes(str)).join(" ");
}
function fromUtf8Bytes(str: string): string {
  const codes = str.trim().split(/\s+/).filter(Boolean);
  const bytes = codes.map((c) => {
    if (!/^\d+$/.test(c)) throw new Error("Expected space-separated numbers.");
    const n = parseInt(c, 10);
    if (n > 255) throw new Error(`Byte out of range: ${c}`);
    return n;
  });
  return fromBytes(Uint8Array.from(bytes));
}
function toUtf16(str: string): string {
  const out: string[] = [];
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i).toString());
  return out.join(" ");
}
function fromUtf16(str: string): string {
  const codes = str.trim().split(/\s+/).filter(Boolean);
  return codes
    .map((c) => {
      if (!/^\d+$/.test(c)) throw new Error("Expected space-separated numbers.");
      return String.fromCharCode(parseInt(c, 10));
    })
    .join("");
}

// ============================================================
// Ciphers
// ============================================================
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
function rot47(str: string): string {
  return str.replace(/[!-~]/g, (c) =>
    String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)),
  );
}
function caesar(str: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}
function vigenere(str: string, key: string, decrypt: boolean): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) throw new Error("Vigenère requires an alphabetic key.");
  let ki = 0;
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    let shift = k.charCodeAt(ki % k.length) - 97;
    if (decrypt) shift = 26 - shift;
    ki++;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}
function atbash(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)));
  });
}
function xorCipher(str: string, key: string): string {
  if (!key) throw new Error("XOR requires a key.");
  const kb = toBytes(key);
  const sb = toBytes(str);
  const out = new Uint8Array(sb.length);
  for (let i = 0; i < sb.length; i++) out[i] = sb[i] ^ kb[i % kb.length];
  return fromBytes(out);
}

// ============================================================
// Hashes (crypto-js)
// ============================================================
export const HASH_META: Record<string, { bits: number; security: "Broken" | "Weak" | "Strong" }> = {
  MD5: { bits: 128, security: "Broken" },
  SHA1: { bits: 160, security: "Weak" },
  SHA224: { bits: 224, security: "Strong" },
  SHA256: { bits: 256, security: "Strong" },
  SHA384: { bits: 384, security: "Strong" },
  SHA512: { bits: 512, security: "Strong" },
  SHA3: { bits: 512, security: "Strong" },
};
function hash(algo: string, input: string): string {
  switch (algo) {
    case "MD5":
      return CryptoJS.MD5(input).toString();
    case "SHA1":
      return CryptoJS.SHA1(input).toString();
    case "SHA224":
      return CryptoJS.SHA224(input).toString();
    case "SHA256":
      return CryptoJS.SHA256(input).toString();
    case "SHA384":
      return CryptoJS.SHA384(input).toString();
    case "SHA512":
      return CryptoJS.SHA512(input).toString();
    case "SHA3":
      return CryptoJS.SHA3(input, { outputLength: 512 }).toString();
    default:
      throw new Error("Unknown algorithm.");
  }
}

// ============================================================
// Developer: JWT + JSON
// ============================================================
function b64urlDecode(part: string): string {
  let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return fromBase64(b64);
}
function decodeJwt(token: string): string {
  const parts = token.trim().split(".");
  if (parts.length < 2) throw new Error("Not a valid JWT (expected header.payload.signature).");
  let header: unknown;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    throw new Error("Could not decode JWT segments.");
  }
  let extra = "";
  if (typeof payload.exp === "number") {
    const d = new Date(payload.exp * 1000);
    extra += `\n\n// Expiration: ${d.toLocaleString()} ${d.getTime() < Date.now() ? "(EXPIRED)" : "(valid)"}`;
  }
  return (
    "// Header\n" +
    JSON.stringify(header, null, 2) +
    "\n\n// Payload\n" +
    JSON.stringify(payload, null, 2) +
    "\n\n// Signature\n" +
    (parts[2] || "(none)") +
    extra
  );
}

// ============================================================
// Operation registry
// ============================================================
export const OPERATIONS: Operation[] = [
  // ---- Encoding ----
  { id: "base16", name: "Base16 (Hex)", category: "Encoding", keywords: ["hex", "base16"], reversible: true, encode: (i) => toHex(i), decode: (i) => fromHex(i) },
  { id: "base32", name: "Base32", category: "Encoding", keywords: ["base32"], reversible: true, encode: (i) => toBase32(i), decode: (i) => fromBase32(i) },
  { id: "base45", name: "Base45", category: "Encoding", keywords: ["base45"], reversible: true, encode: (i) => toBase45(i), decode: (i) => fromBase45(i) },
  { id: "base58", name: "Base58", category: "Encoding", keywords: ["base58", "bitcoin"], reversible: true, encode: (i) => baseXEncode(i, B58), decode: (i) => baseXDecode(i, B58, "Base58") },
  { id: "base62", name: "Base62", category: "Encoding", keywords: ["base62"], reversible: true, encode: (i) => baseXEncode(i, B62), decode: (i) => baseXDecode(i, B62, "Base62") },
  { id: "base64", name: "Base64", category: "Encoding", keywords: ["base64"], reversible: true, encode: (i) => toBase64(i), decode: (i) => fromBase64(i) },
  { id: "base85", name: "Base85 (ASCII85)", category: "Encoding", keywords: ["base85", "ascii85"], reversible: true, encode: (i) => toBase85(i), decode: (i) => fromBase85(i) },

  // ---- Web ----
  { id: "url", name: "URL Encoding", category: "Web", keywords: ["url", "percent", "uri"], reversible: true, encode: (i) => encodeURIComponent(i), decode: (i) => { try { return decodeURIComponent(i); } catch { throw new Error("Invalid URL-encoded input."); } } },
  { id: "html", name: "HTML Entities", category: "Web", keywords: ["html", "entity", "entities"], reversible: true, encode: (i) => encodeHtml(i), decode: (i) => decodeHtml(i) },

  // ---- Unicode ----
  { id: "unicode", name: "Unicode Escape", category: "Unicode", keywords: ["unicode", "escape", "\\u"], reversible: true, encode: (i) => toUnicode(i), decode: (i) => fromUnicode(i) },

  // ---- Numbers ----
  { id: "binary", name: "Binary", category: "Numbers", keywords: ["binary", "bits", "01"], reversible: true, encode: (i) => bytesToRadix(i, 2, 8), decode: (i) => radixToBytes(i, 2, "binary") },
  { id: "octal", name: "Octal", category: "Numbers", keywords: ["octal", "base8"], reversible: true, encode: (i) => bytesToRadix(i, 8, 3), decode: (i) => radixToBytes(i, 8, "octal") },
  { id: "decimal", name: "Decimal", category: "Numbers", keywords: ["decimal", "base10"], reversible: true, encode: (i) => bytesToRadix(i, 10, 0), decode: (i) => radixToBytes(i, 10, "decimal") },
  { id: "hexadecimal", name: "Hexadecimal", category: "Numbers", keywords: ["hexadecimal", "hex", "base16"], reversible: true, encode: (i) => bytesToRadix(i, 16, 2), decode: (i) => radixToBytes(i, 16, "hexadecimal") },

  // ---- Text ----
  { id: "ascii", name: "ASCII Code Points", category: "Text", keywords: ["ascii", "code", "points"], reversible: true, encode: (i) => toCodePoints(i), decode: (i) => fromCodePoints(i) },
  { id: "utf8", name: "UTF-8 Bytes", category: "Text", keywords: ["utf8", "utf-8", "bytes"], reversible: true, encode: (i) => toUtf8Bytes(i), decode: (i) => fromUtf8Bytes(i) },
  { id: "utf16", name: "UTF-16 Code Units", category: "Text", keywords: ["utf16", "utf-16", "code", "units"], reversible: true, encode: (i) => toUtf16(i), decode: (i) => fromUtf16(i) },

  // ---- Security (hashes, one-way) ----
  ...(["MD5", "SHA1", "SHA224", "SHA256", "SHA384", "SHA512", "SHA3"] as const).map(
    (algo): Operation => ({
      id: `hash-${algo.toLowerCase()}`,
      name: algo,
      category: "Security",
      keywords: ["hash", algo.toLowerCase(), "digest"],
      actionLabel: `Hash ${algo}`,
      run: (i) => hash(algo, i),
    }),
  ),

  // ---- Ciphers ----
  { id: "rot13", name: "ROT13", category: "Ciphers", keywords: ["rot13", "cipher"], reversible: true, encode: (i) => rot13(i), decode: (i) => rot13(i) },
  { id: "rot47", name: "ROT47", category: "Ciphers", keywords: ["rot47", "cipher"], reversible: true, encode: (i) => rot47(i), decode: (i) => rot47(i) },
  {
    id: "caesar",
    name: "Caesar Cipher",
    category: "Ciphers",
    keywords: ["caesar", "shift", "cipher"],
    reversible: true,
    params: [{ key: "shift", label: "Shift", type: "number", default: "3" }],
    encode: (i, p) => caesar(i, parseInt(p.shift || "3", 10)),
    decode: (i, p) => caesar(i, -parseInt(p.shift || "3", 10)),
  },
  {
    id: "vigenere",
    name: "Vigenère Cipher",
    category: "Ciphers",
    keywords: ["vigenere", "vigenère", "cipher", "key"],
    reversible: true,
    params: [{ key: "key", label: "Key", type: "text", default: "key" }],
    encode: (i, p) => vigenere(i, p.key || "", false),
    decode: (i, p) => vigenere(i, p.key || "", true),
  },
  { id: "atbash", name: "Atbash Cipher", category: "Ciphers", keywords: ["atbash", "cipher"], reversible: true, encode: (i) => atbash(i), decode: (i) => atbash(i) },
  {
    id: "xor",
    name: "XOR (Custom Key)",
    category: "Ciphers",
    keywords: ["xor", "cipher", "key"],
    reversible: true,
    params: [{ key: "key", label: "Key", type: "text", default: "key" }],
    encode: (i, p) => xorCipher(i, p.key || ""),
    decode: (i, p) => xorCipher(i, p.key || ""),
  },

  // ---- Developer ----
  { id: "jwt", name: "JWT Decode", category: "Developer", keywords: ["jwt", "token", "json web token"], actionLabel: "Decode JWT", run: (i) => decodeJwt(i) },
  {
    id: "json-pretty",
    name: "JSON Pretty Print",
    category: "Developer",
    keywords: ["json", "pretty", "format", "beautify"],
    actionLabel: "Pretty Print",
    run: (i) => {
      try {
        return JSON.stringify(JSON.parse(i), null, 2);
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
    },
  },
  {
    id: "json-minify",
    name: "JSON Minify",
    category: "Developer",
    keywords: ["json", "minify", "compact"],
    actionLabel: "Minify",
    run: (i) => {
      try {
        return JSON.stringify(JSON.parse(i));
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
    },
  },
  {
    id: "json-validate",
    name: "JSON Validate",
    category: "Developer",
    keywords: ["json", "validate", "check"],
    actionLabel: "Validate",
    run: (i) => {
      try {
        JSON.parse(i);
        return "✓ Valid JSON";
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
    },
  },

  // ---- Utilities ----
  { id: "uppercase", name: "Uppercase", category: "Utilities", keywords: ["uppercase", "caps"], actionLabel: "Transform", run: (i) => i.toUpperCase() },
  { id: "lowercase", name: "Lowercase", category: "Utilities", keywords: ["lowercase"], actionLabel: "Transform", run: (i) => i.toLowerCase() },
  { id: "reverse", name: "Reverse Text", category: "Utilities", keywords: ["reverse", "flip"], actionLabel: "Transform", run: (i) => Array.from(i).reverse().join("") },
  { id: "dedupe-lines", name: "Remove Duplicate Lines", category: "Utilities", keywords: ["duplicate", "unique", "lines"], actionLabel: "Transform", run: (i) => Array.from(new Set(i.split("\n"))).join("\n") },
  { id: "remove-empty", name: "Remove Empty Lines", category: "Utilities", keywords: ["empty", "blank", "lines"], actionLabel: "Transform", run: (i) => i.split("\n").filter((l) => l.trim() !== "").join("\n") },
  { id: "trim", name: "Trim Spaces", category: "Utilities", keywords: ["trim", "spaces", "whitespace"], actionLabel: "Transform", run: (i) => i.split("\n").map((l) => l.trim()).join("\n") },
  { id: "sort-lines", name: "Sort Lines", category: "Utilities", keywords: ["sort", "lines", "order"], actionLabel: "Transform", run: (i) => i.split("\n").sort((a, b) => a.localeCompare(b)).join("\n") },
  { id: "count-chars", name: "Count Characters", category: "Utilities", keywords: ["count", "characters", "length"], actionLabel: "Count", run: (i) => `Characters: ${Array.from(i).length}\nCharacters (no spaces): ${Array.from(i.replace(/\s/g, "")).length}\nLines: ${i === "" ? 0 : i.split("\n").length}` },
  { id: "count-words", name: "Count Words", category: "Utilities", keywords: ["count", "words"], actionLabel: "Count", run: (i) => `Words: ${(i.trim().match(/\S+/g) || []).length}` },
];

export const OPERATION_MAP: Record<string, Operation> = Object.fromEntries(
  OPERATIONS.map((o) => [o.id, o]),
);

/** Execute an operation. Throws on failure so no credits are charged. */
export function runOperation(
  op: Operation,
  input: string,
  mode: "encode" | "decode",
  params: Record<string, string>,
): string {
  if (op.reversible) {
    const fn = mode === "encode" ? op.encode : op.decode;
    if (!fn) throw new Error("Unsupported direction.");
    return fn(input, params);
  }
  if (!op.run) throw new Error("Operation not runnable.");
  return op.run(input, params);
}

// ============================================================
// Auto detection
// ============================================================
export type Detection = {
  opId: string;
  label: string;
  confidence: number;
  mode: "decode";
};

export function autoDetect(input: string): Detection[] {
  const s = input.trim();
  const results: Detection[] = [];
  if (!s) return results;

  const push = (opId: string, label: string, confidence: number) =>
    results.push({ opId, label, confidence, mode: "decode" });

  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(s)) push("jwt", "JWT", 0.97);
  if (/^[01]{8}(\s+[01]{8})*$/.test(s)) push("binary", "Binary", 0.95);
  if (/^(\\u[0-9a-fA-F]{4})+$/.test(s)) push("unicode", "Unicode", 0.95);
  if (/%[0-9a-fA-F]{2}/.test(s)) push("url", "URL Encoding", 0.8);
  if (/&[a-z]+;|&#\d+;/i.test(s)) push("html", "HTML Entity", 0.8);

  const noSpace = s.replace(/\s+/g, "");
  if (/^[0-9a-f]{32}$/i.test(noSpace)) push("hash-md5", "MD5 Hash", 0.85);
  if (/^[0-9a-f]{40}$/i.test(noSpace)) push("hash-sha1", "SHA-1 Hash", 0.85);
  if (/^[0-9a-f]{56}$/i.test(noSpace)) push("hash-sha224", "SHA-224 Hash", 0.8);
  if (/^[0-9a-f]{64}$/i.test(noSpace)) push("hash-sha256", "SHA-256 Hash", 0.85);
  if (/^[0-9a-f]{96}$/i.test(noSpace)) push("hash-sha384", "SHA-384 Hash", 0.8);
  if (/^[0-9a-f]{128}$/i.test(noSpace)) push("hash-sha512", "SHA-512 Hash", 0.8);

  if (/^([0-9a-fA-F]{2}\s*)+$/.test(s) && noSpace.length % 2 === 0 && noSpace.length > 2 && !/^[0-9a-f]{32,128}$/i.test(noSpace)) {
    push("base16", "Hex", 0.6);
  }
  if (/^[A-Z2-7]+=*$/.test(noSpace) && noSpace.length % 8 === 0) push("base32", "Base32", 0.6);
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(noSpace) && noSpace.length % 4 === 0 && noSpace.length >= 4) {
    push("base64", "Base64", 0.7);
  }

  // Hashes are one-way; mark their suggested action as "hash" not decode.
  return results
    .map((r) => (r.opId.startsWith("hash-") ? { ...r, mode: "decode" as const } : r))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}
