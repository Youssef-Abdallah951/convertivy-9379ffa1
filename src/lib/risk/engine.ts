/**
 * Shared risk-analysis engine.
 *
 * Every scanner (file / url / text / image) produces `Finding[]`, and the score
 * is derived deterministically from those findings — never randomly generated.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type RiskCategory =
  | "Security"
  | "Privacy"
  | "Phishing"
  | "Social Engineering"
  | "Metadata";

export type Finding = {
  id: string;
  severity: Severity;
  category: RiskCategory;
  /** Short headline, e.g. "Suspicious external URL" */
  title: string;
  /** What was detected. */
  description: string;
  /** Why it matters, in plain language. */
  reason: string;
  /** What the user should do about it. */
  recommendation: string;
  /** Optional short evidence samples (already truncated/safe to show). */
  evidence?: string[];
};

export type RiskLevel = "LOW" | "MODERATE" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ScanType = "File" | "URL" | "Text" | "Image";

export type ScanResult = {
  scanType: ScanType;
  /** e.g. file name, hostname, "Pasted text (412 characters)" */
  subject: string;
  score: number;
  level: RiskLevel;
  findings: Finding[];
  /** Checks that passed — shown as green reassurance items. */
  passed: string[];
  scannedAt: string;
};

/** Points contributed per finding severity. Transparent and fixed. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 42,
  high: 26,
  medium: 14,
  low: 6,
  info: 2,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

/** Emoji dots used in copied/downloaded reports. */
export const SEVERITY_DOT: Record<Severity, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "🟢",
};

export function scoreFindings(findings: Finding[]): number {
  const total = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function riskLevel(score: number): RiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 40) return "MODERATE";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

export const LEVEL_HINT: Record<RiskLevel, string> = {
  LOW: "No strong risk indicators were found by the available checks.",
  MODERATE: "A few weak indicators were found. Stay cautious.",
  MEDIUM: "Several indicators were found. Verify before trusting this content.",
  HIGH: "Multiple strong indicators were found. Treat this as unsafe until verified.",
  CRITICAL: "Very strong risk indicators were found. Do not act on this content.",
};

export function buildResult(
  scanType: ScanType,
  subject: string,
  findings: Finding[],
  passed: string[],
): ScanResult {
  // Highest severity first, then category for stable grouping.
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  const sorted = [...findings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );
  const score = scoreFindings(sorted);
  return {
    scanType,
    subject,
    score,
    level: riskLevel(score),
    findings: sorted,
    passed,
    scannedAt: new Date().toISOString(),
  };
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((f) => (counts[f.severity] += 1));
  return counts;
}

export function countByCategory(findings: Finding[]): { category: RiskCategory; count: number }[] {
  const cats: RiskCategory[] = ["Security", "Privacy", "Phishing", "Social Engineering", "Metadata"];
  return cats.map((category) => ({
    category,
    count: findings.filter((f) => f.category === category).length,
  }));
}

/** Plain-text report. Evidence is intentionally limited to short samples. */
export function buildReportText(result: ScanResult): string {
  const lines: string[] = [];
  lines.push("DIGITAL RISK SCANNER REPORT");
  lines.push("Convertify — https://convertivy.lovable.app/tools/digital-risk-scanner");
  lines.push("");
  lines.push(`Scan Type:  ${result.scanType}`);
  lines.push(`Subject:    ${result.subject}`);
  lines.push(`Scanned At: ${new Date(result.scannedAt).toUTCString()}`);
  lines.push(`Risk Score: ${result.score}/100`);
  lines.push(`Risk Level: ${result.level}`);
  lines.push("");
  lines.push("FINDINGS");
  if (result.findings.length === 0) {
    lines.push("- No risk indicators detected by the available checks.");
  } else {
    result.findings.forEach((f, i) => {
      lines.push(
        `${i + 1}. ${SEVERITY_DOT[f.severity]} [${SEVERITY_LABEL[f.severity]} · ${f.category}] ${f.title}`,
      );
      lines.push(`   What: ${f.description}`);
      lines.push(`   Why:  ${f.reason}`);
      lines.push(`   Do:   ${f.recommendation}`);
      if (f.evidence?.length) lines.push(`   Sample: ${f.evidence.slice(0, 3).join(" | ")}`);
      lines.push("");
    });
  }
  if (result.passed.length) {
    lines.push("CHECKS PASSED");
    result.passed.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  lines.push("RECOMMENDATIONS");
  lines.push(`- ${LEVEL_HINT[result.level]}`);
  result.findings.slice(0, 6).forEach((f) => lines.push(`- ${f.recommendation}`));
  lines.push("");
  lines.push(
    "NOTE: This report is based on automated heuristic checks only. It cannot prove that content is safe or malicious.",
  );
  return lines.join("\n");
}
