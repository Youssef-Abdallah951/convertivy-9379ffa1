/** URL heuristics. Pure client-side; optional server data adds redirect checks. */

import type { Finding } from "./engine";
import { buildResult, type ScanResult } from "./engine";

export type UrlProbe = {
  reachable: boolean;
  status?: number;
  finalUrl?: string;
  redirectChain?: string[];
  hsts?: boolean;
  error?: string;
};

const SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
  "rebrand.ly", "shorturl.at", "rb.gy", "t.ly", "s.id", "bl.ink", "lnkd.in", "adf.ly",
];

const SUSPICIOUS_TLDS = [
  "zip", "mov", "top", "xyz", "tk", "ml", "ga", "cf", "gq", "work", "click", "loan",
  "country", "review", "kim", "rest", "quest", "cam", "sbs", "surf",
];

const BRAND_WORDS = [
  "paypal", "apple", "icloud", "microsoft", "office365", "outlook", "google", "gmail",
  "facebook", "instagram", "whatsapp", "netflix", "amazon", "binance", "metamask",
  "vodafone", "instapay", "bank", "visa", "mastercard", "dhl", "fedex", "steam",
];

const SENSITIVE_PARAMS = ["password", "passwd", "pwd", "token", "secret", "otp", "apikey", "api_key", "session", "auth"];

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function analyzeUrl(rawInput: string, probe?: UrlProbe): ScanResult {
  const findings: Finding[] = [];
  const passed: string[] = [];
  const normalized = normalizeUrl(rawInput);

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return buildResult("URL", rawInput.slice(0, 120), [
      {
        id: "url-invalid",
        severity: "medium",
        category: "Security",
        title: "Malformed URL",
        description: "The value entered is not a valid web address.",
        reason: "Malformed links are often used to hide the real destination or are simply typos.",
        recommendation: "Check the link and re-enter it, including the domain name.",
      },
    ], []);
  }

  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  const registrable = labels.slice(-2).join(".");

  if (!["http:", "https:"].includes(url.protocol)) {
    findings.push({
      id: "url-scheme",
      severity: "high",
      category: "Security",
      title: "Unusual URL scheme",
      description: `The link uses the "${url.protocol.replace(":", "")}" scheme instead of http/https.`,
      reason: "Non-web schemes can trigger app handlers or downloads instead of opening a page.",
      recommendation: "Do not open this link unless you know exactly which app will handle it.",
    });
  } else if (url.protocol === "http:") {
    findings.push({
      id: "url-no-https",
      severity: "medium",
      category: "Security",
      title: "No HTTPS encryption",
      description: "The link uses plain HTTP.",
      reason: "Traffic on HTTP can be read or modified by anyone on the network path.",
      recommendation: "Never enter passwords or payment details on an HTTP page.",
    });
  } else {
    passed.push("HTTPS enabled");
  }

  // IP-address host
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    findings.push({
      id: "url-ip-host",
      severity: "high",
      category: "Phishing",
      title: "Link points to a raw IP address",
      description: `The host is an IP address (${host}) instead of a domain name.`,
      reason:
        "Legitimate services almost always use domain names; raw IPs are common in phishing and malware hosting.",
      recommendation: "Do not open this link or enter any information on it.",
    });
  }

  // Userinfo trick: https://paypal.com@evil.com
  if (url.username || url.password) {
    findings.push({
      id: "url-userinfo",
      severity: "critical",
      category: "Phishing",
      title: "Hidden destination (credentials in URL)",
      description: "The URL contains an @ section before the real domain.",
      reason:
        "Everything before the @ is ignored by browsers, so a trusted-looking name can hide the real destination.",
      recommendation: `Ignore this link. The real destination is "${host}".`,
    });
  }

  // Punycode / look-alike
  if (host.includes("xn--")) {
    findings.push({
      id: "url-punycode",
      severity: "high",
      category: "Phishing",
      title: "Punycode (look-alike) domain",
      description: `The domain uses internationalised characters: ${host}`,
      reason:
        "Punycode lets attackers register domains that visually imitate well-known brands.",
      recommendation: "Type the brand's address manually instead of using this link.",
    });
  }

  const brandHit = BRAND_WORDS.find(
    (b) => host.includes(b) && !registrable.startsWith(`${b}.`) && registrable !== `${b}.com`,
  );
  if (brandHit) {
    findings.push({
      id: "url-brand-abuse",
      severity: "high",
      category: "Phishing",
      title: "Brand name used outside its official domain",
      description: `"${brandHit}" appears in the host, but the actual domain is "${registrable}".`,
      reason:
        "Placing a brand in a subdomain or path is one of the most common phishing techniques.",
      recommendation: `Verify by visiting ${brandHit} through a search engine or a saved bookmark instead.`,
    });
  }

  if (SHORTENERS.includes(registrable)) {
    findings.push({
      id: "url-shortener",
      severity: "medium",
      category: "Phishing",
      title: "URL shortener detected",
      description: `${registrable} hides the real destination of this link.`,
      reason: "Shortened links prevent you from seeing where you will actually land.",
      recommendation: "Expand the link with a preview service before opening it.",
    });
  }

  if (SUSPICIOUS_TLDS.includes(tld)) {
    findings.push({
      id: "url-tld",
      severity: "medium",
      category: "Phishing",
      title: "High-abuse domain ending",
      description: `The domain ends in ".${tld}", which is frequently abused.`,
      reason: "Cheap or free domain endings are heavily used for short-lived scam sites.",
      recommendation: "Treat this site as untrusted unless you can verify the owner.",
    });
  }

  const subdomainCount = Math.max(0, labels.length - 2);
  if (subdomainCount >= 3) {
    findings.push({
      id: "url-subdomains",
      severity: "medium",
      category: "Phishing",
      title: "Unusually deep subdomain chain",
      description: `The host has ${subdomainCount} subdomain levels.`,
      reason: "Long subdomain chains are used to push the real domain out of view on mobile.",
      recommendation: "Read the domain from right to left to identify the real owner.",
    });
  }

  if (host.split("-").length - 1 >= 3) {
    findings.push({
      id: "url-hyphens",
      severity: "low",
      category: "Phishing",
      title: "Many hyphens in the domain",
      description: `The host "${host}" contains several hyphens.`,
      reason: "Hyphen-heavy hosts often imitate brand names, e.g. secure-login-brand-verify.com.",
      recommendation: "Compare the domain letter by letter with the official one.",
    });
  }

  if (normalized.length > 120) {
    findings.push({
      id: "url-length",
      severity: "low",
      category: "Phishing",
      title: "Very long URL",
      description: `The URL is ${normalized.length} characters long.`,
      reason: "Excessive length is often used to bury the real destination or smuggle data.",
      recommendation: "Inspect the beginning of the URL — that is where the real domain lives.",
    });
  } else {
    passed.push("Normal URL length and structure");
  }

  if (/%[0-9a-f]{2}%[0-9a-f]{2}/i.test(normalized) || /[<>"'{}|\\^`]/.test(rawInput)) {
    findings.push({
      id: "url-encoding",
      severity: "medium",
      category: "Security",
      title: "Suspicious characters or heavy encoding",
      description: "The URL contains unusual characters or repeated percent-encoding.",
      reason: "Obfuscated URLs are used to evade filters and hide the real target.",
      recommendation: "Do not open the link; ask the sender for a plain, readable address.",
    });
  }

  const sensitive = [...url.searchParams.keys()].filter((k) =>
    SENSITIVE_PARAMS.some((s) => k.toLowerCase().includes(s)),
  );
  if (sensitive.length) {
    findings.push({
      id: "url-sensitive-params",
      severity: "high",
      category: "Privacy",
      title: "Sensitive data in query parameters",
      description: `The URL carries parameter(s): ${sensitive.join(", ")}.`,
      reason: "Values in the URL are stored in history, logs and referrer headers.",
      recommendation: "Do not share this link; request a login page that uses a form instead.",
    });
  }

  if (/\.(exe|scr|msi|bat|cmd|apk|jar|vbs|js|ps1|dmg|zip|rar|7z)(\?|$)/i.test(url.pathname)) {
    findings.push({
      id: "url-executable",
      severity: "high",
      category: "Security",
      title: "Link points directly to a downloadable program or archive",
      description: `The path ends with "${url.pathname.split(".").pop()}".`,
      reason: "Direct executable or archive downloads are a primary malware delivery method.",
      recommendation: "Do not download or run this file unless you fully trust the source.",
    });
  }

  // Server-side probe results
  if (probe) {
    if (!probe.reachable) {
      findings.push({
        id: "url-unreachable",
        severity: "low",
        category: "Security",
        title: "Site could not be reached",
        description: probe.error ?? "The server did not respond to a safe test request.",
        reason:
          "Unreachable or newly-created hosts are common with short-lived scam pages, but this can also be a temporary outage.",
        recommendation: "Do not assume the link is safe; verify the destination with the sender.",
      });
    } else {
      const chain = probe.redirectChain ?? [];
      if (chain.length > 0) {
        const finalHost = (() => {
          try {
            return new URL(probe.finalUrl ?? normalized).hostname;
          } catch {
            return "unknown";
          }
        })();
        const crossDomain = finalHost !== host;
        findings.push({
          id: "url-redirect",
          severity: crossDomain ? "high" : "low",
          category: "Phishing",
          title: crossDomain ? "Link redirects to a different domain" : "Link redirects internally",
          description: `${chain.length} redirect(s) ending at ${finalHost}.`,
          reason: crossDomain
            ? "Cross-domain redirects hide the true destination of a link."
            : "Internal redirects are common, but still change the address you land on.",
          recommendation: crossDomain
            ? `Verify that "${finalHost}" is the site you expected before entering anything.`
            : "Confirm the final address in your browser bar after opening.",
          evidence: chain.slice(0, 3),
        });
      } else {
        passed.push("No suspicious redirect detected");
      }
      if (probe.status && probe.status >= 400) {
        findings.push({
          id: "url-error-status",
          severity: "low",
          category: "Security",
          title: `Server returned status ${probe.status}`,
          description: "The page did not load successfully during the test request.",
          reason: "Broken or removed pages are typical of taken-down scam campaigns.",
          recommendation: "Treat the link as unverified.",
        });
      } else if (probe.hsts) {
        passed.push("Server enforces HTTPS (HSTS header present)");
      }
    }
  }

  if (!findings.some((f) => f.category === "Phishing")) {
    passed.push("No common phishing pattern in the domain");
  }

  return buildResult("URL", `${url.protocol}//${host}${url.pathname}`.slice(0, 140), findings, passed);
}
