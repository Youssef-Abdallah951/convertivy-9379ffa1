// Universal Encoder / Decoder logic — runs entirely in the browser.
// No data ever leaves the device.

export type FormatKey =
  | "base64"
  | "url"
  | "html"
  | "binary"
  | "hex"
  | "ascii"
  | "unicode"
  | "morse"
  | "rot13"
  | "jwt";

export type FormatDef = {
  key: FormatKey;
  label: string;
  /** JWT only supports decoding. */
  decodeOnly?: boolean;
};

export const FORMATS: FormatDef[] = [
  { key: "base64", label: "Base64" },
  { key: "url", label: "URL Encoding" },
  { key: "html", label: "HTML Entities" },
  { key: "binary", label: "Binary" },
  { key: "hex", label: "Hexadecimal" },
  { key: "ascii", label: "ASCII" },
  { key: "unicode", label: "Unicode" },
  { key: "morse", label: "Morse Code" },
  { key: "rot13", label: "ROT13" },
  { key: "jwt", label: "JWT Decoder", decodeOnly: true },
];

// ---------- UTF-8 safe Base64 ----------
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------- HTML entities ----------
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

// ---------- Binary ----------
function textToBinary(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(2).padStart(8, "0"))
    .join(" ");
}

function binaryToText(str: string): string {
  const clean = str.trim().replace(/\s+/g, " ");
  const groups = clean.split(" ").filter(Boolean);
  if (!groups.every((g) => /^[01]+$/.test(g))) {
    throw new Error("Binary must contain only 0 and 1, separated by spaces.");
  }
  const bytes = groups.map((g) => parseInt(g, 2));
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

// ---------- Hexadecimal ----------
function textToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function hexToText(str: string): string {
  const clean = str.trim().replace(/0x/gi, "").replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("Invalid hexadecimal input.");
  }
  const bytes = clean.match(/.{2}/g)!.map((h) => parseInt(h, 16));
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

// ---------- ASCII ----------
function textToAscii(str: string): string {
  return Array.from(str)
    .map((c) => c.codePointAt(0))
    .join(" ");
}

function asciiToText(str: string): string {
  const codes = str.trim().split(/\s+/).filter(Boolean);
  if (!codes.every((c) => /^\d+$/.test(c))) {
    throw new Error("ASCII must be numbers separated by spaces.");
  }
  return codes.map((c) => String.fromCodePoint(parseInt(c, 10))).join("");
}

// ---------- Unicode (\uXXXX) ----------
function textToUnicode(str: string): string {
  return Array.from(str)
    .map((c) => {
      const code = c.codePointAt(0)!;
      return "\\u" + code.toString(16).padStart(4, "0");
    })
    .join("");
}

function unicodeToText(str: string): string {
  const matches = str.match(/\\u[0-9a-fA-F]{4,6}|./gs);
  if (!matches) return "";
  return matches
    .map((m) => {
      if (m.startsWith("\\u")) {
        return String.fromCodePoint(parseInt(m.slice(2), 16));
      }
      return m;
    })
    .join("");
}

// ---------- Morse code ----------
const MORSE_MAP: Record<string, string> = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.",
  h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.",
  o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-",
  v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};
const REVERSE_MORSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([k, v]) => [v, k]),
);

function textToMorse(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) =>
      Array.from(word)
        .map((ch) => {
          if (ch === "") return "";
          const code = MORSE_MAP[ch];
          if (!code) throw new Error(`Cannot encode character: "${ch}"`);
          return code;
        })
        .join(" "),
    )
    .join(" / ");
}

function morseToText(str: string): string {
  return str
    .trim()
    .split("/")
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => {
          const ch = REVERSE_MORSE[code];
          if (!ch) throw new Error(`Invalid Morse sequence: "${code}"`);
          return ch;
        })
        .join(""),
    )
    .join(" ");
}

// ---------- ROT13 ----------
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

// ---------- JWT decode ----------
function base64UrlDecode(part: string): string {
  let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return base64ToUtf8(b64);
}

function decodeJwt(token: string): string {
  const parts = token.trim().split(".");
  if (parts.length < 2) {
    throw new Error("Not a valid JWT (expected header.payload.signature).");
  }
  let header: unknown;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw new Error("Could not decode JWT segments.");
  }

  let expiry = "";
  if (typeof payload.exp === "number") {
    const expDate = new Date(payload.exp * 1000);
    const expired = expDate.getTime() < Date.now();
    expiry = `\n// Expiration: ${expDate.toLocaleString()} ${expired ? "(EXPIRED)" : "(valid)"}`;
  }

  return (
    "// Header\n" +
    JSON.stringify(header, null, 2) +
    "\n\n// Payload\n" +
    JSON.stringify(payload, null, 2) +
    expiry
  );
}

// ---------- Public API ----------
export function encode(format: FormatKey, input: string): string {
  switch (format) {
    case "base64":
      return utf8ToBase64(input);
    case "url":
      return encodeURIComponent(input);
    case "html":
      return encodeHtml(input);
    case "binary":
      return textToBinary(input);
    case "hex":
      return textToHex(input);
    case "ascii":
      return textToAscii(input);
    case "unicode":
      return textToUnicode(input);
    case "morse":
      return textToMorse(input);
    case "rot13":
      return rot13(input);
    case "jwt":
      throw new Error("JWT only supports decoding.");
    default:
      throw new Error("Unsupported format.");
  }
}

export function decode(format: FormatKey, input: string): string {
  switch (format) {
    case "base64":
      try {
        return base64ToUtf8(input);
      } catch {
        throw new Error("Invalid Base64 input.");
      }
    case "url":
      try {
        return decodeURIComponent(input);
      } catch {
        throw new Error("Invalid URL-encoded input.");
      }
    case "html":
      return decodeHtml(input);
    case "binary":
      return binaryToText(input);
    case "hex":
      return hexToText(input);
    case "ascii":
      return asciiToText(input);
    case "unicode":
      return unicodeToText(input);
    case "morse":
      return morseToText(input);
    case "rot13":
      return rot13(input);
    case "jwt":
      return decodeJwt(input);
    default:
      throw new Error("Unsupported format.");
  }
}

/** Best-effort auto-detection of the input format. */
export function detectFormat(input: string): FormatKey | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(s)) return "jwt";
  if (/^[01]{8}(\s+[01]{8})*$/.test(s)) return "binary";
  if (/^[.\-/\s]+$/.test(s) && /[.\-]/.test(s)) return "morse";
  if (/^(\\u[0-9a-fA-F]{4})+$/.test(s)) return "unicode";
  if (/%[0-9a-fA-F]{2}/.test(s)) return "url";
  if (/&[a-z]+;|&#\d+;/i.test(s)) return "html";
  if (/^(\d{1,3})(\s+\d{1,3})*$/.test(s)) return "ascii";
  if (/^([0-9a-fA-F]{2}\s*)+$/.test(s) && s.replace(/\s/g, "").length % 2 === 0)
    return "hex";
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length % 4 === 0) return "base64";
  return null;
}
