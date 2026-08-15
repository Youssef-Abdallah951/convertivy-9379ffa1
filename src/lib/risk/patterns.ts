/** Shared detectors for personal data and suspicious text patterns. */

import type { Finding } from "./engine";

export type Match = { label: string; samples: string[]; count: number };

const mask = (value: string) => {
  const v = value.trim();
  if (v.length <= 6) return `${v.slice(0, 2)}***`;
  return `${v.slice(0, 3)}***${v.slice(-2)}`;
};

const collect = (text: string, re: RegExp, limit = 3): string[] => {
  const out: string[] = [];
  const matches = text.match(re) ?? [];
  for (const m of matches) {
    if (!out.includes(m)) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
};

export const RE = {
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  url: /\b(?:https?:\/\/|www\.)[^\s"'<>()]+/gi,
  phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  card: /\b(?:\d[ -]?){13,19}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  egyptId: /\b[23]\d{13}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  address:
    /\b\d{1,5}\s+[A-Za-z][A-Za-z.]*\s+(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?)\b/gi,
  secret:
    /\b(?:sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})\b/g,
  passwordLabel: /\b(password|passcode|pin code|pin:|otp|one[- ]time (?:code|password)|verification code|cvv|seed phrase|recovery phrase)\b/gi,
};

/** Luhn check so random long digit strings aren't reported as card numbers. */
export function isLuhnValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Privacy findings for any text blob (extracted document text, OCR output, ...).
 * `context` is used in descriptions, e.g. "the document" or "the image text".
 */
export function analyzePrivacy(text: string, context: string): Finding[] {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  const emails = collect(text, RE.email);
  if (emails.length) {
    add({
      id: "pii-email",
      severity: "medium",
      category: "Privacy",
      title: "Email address detected",
      description: `${emails.length}+ email address(es) found in ${context}.`,
      reason:
        "Email addresses are personal data and are commonly harvested for spam, phishing and account-takeover attempts.",
      recommendation: "Remove or redact email addresses before sharing this publicly.",
      evidence: emails.map(mask),
    });
  }

  const phones = (text.match(RE.phone) ?? []).filter((m) => m.replace(/\D/g, "").length >= 9);
  if (phones.length) {
    add({
      id: "pii-phone",
      severity: "medium",
      category: "Privacy",
      title: "Phone number detected",
      description: `Possible phone number(s) found in ${context}.`,
      reason: "Phone numbers enable SMS scams, SIM-swap attacks and unwanted contact.",
      recommendation: "Redact phone numbers before sharing this file or screenshot.",
      evidence: phones.slice(0, 3).map(mask),
    });
  }

  const cards = (text.match(RE.card) ?? []).filter(isLuhnValid);
  if (cards.length) {
    add({
      id: "pii-card",
      severity: "critical",
      category: "Privacy",
      title: "Payment card number detected",
      description: `A digit sequence in ${context} passes payment-card validation.`,
      reason: "Exposed card numbers can be used directly for fraudulent payments.",
      recommendation:
        "Do not share this content. Redact the number and contact your bank if it was already shared.",
      evidence: cards.slice(0, 2).map(mask),
    });
  }

  const ibans = collect(text, RE.iban, 2);
  if (ibans.length) {
    add({
      id: "pii-iban",
      severity: "high",
      category: "Privacy",
      title: "Bank account / IBAN detected",
      description: `A bank-account style identifier was found in ${context}.`,
      reason: "Bank identifiers are frequently used in payment-redirection fraud.",
      recommendation: "Remove banking identifiers before sharing.",
      evidence: ibans.map(mask),
    });
  }

  const ids = [...collect(text, RE.egyptId, 2), ...collect(text, RE.ssn, 2)];
  if (ids.length) {
    add({
      id: "pii-national-id",
      severity: "high",
      category: "Privacy",
      title: "Personal identifier detected",
      description: `A national-ID style number was found in ${context}.`,
      reason: "Government identifiers are a primary ingredient for identity theft.",
      recommendation: "Redact the identifier and avoid uploading identity documents anywhere public.",
      evidence: ids.map(mask),
    });
  }

  const secrets = collect(text, RE.secret, 2);
  if (secrets.length) {
    add({
      id: "pii-secret",
      severity: "critical",
      category: "Security",
      title: "API key or token detected",
      description: `${context} contains a string matching a known API key / token format.`,
      reason: "Leaked keys let attackers use your paid services or access your accounts.",
      recommendation: "Revoke and rotate the key immediately, then remove it from this content.",
      evidence: secrets.map(mask),
    });
  }

  const addresses = collect(text, RE.address, 2);
  if (addresses.length) {
    add({
      id: "pii-address",
      severity: "low",
      category: "Privacy",
      title: "Physical address detected",
      description: `A street address pattern was found in ${context}.`,
      reason: "Home or office addresses can enable stalking and targeted social engineering.",
      recommendation: "Redact address details if this content will be shared.",
      evidence: addresses,
    });
  }

  const creds = collect(text, RE.passwordLabel, 3);
  if (creds.length) {
    add({
      id: "pii-credential-words",
      severity: "high",
      category: "Privacy",
      title: "Credential-related content detected",
      description: `${context} mentions passwords, OTP codes or card security codes.`,
      reason: "Content containing credentials is high value for attackers if it leaks.",
      recommendation: "Never store or share credentials in files, chats or screenshots.",
      evidence: creds,
    });
  }

  return findings;
}

/** Extracts URLs from any text, deduplicated. */
export function extractUrls(text: string): string[] {
  const found = text.match(RE.url) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const clean = raw.replace(/[.,;:)]+$/, "");
    const normalized = clean.startsWith("http") ? clean : `http://${clean}`;
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}
