/** Social-engineering / phishing heuristics for pasted messages. */

import type { Finding } from "./engine";
import { buildResult, type ScanResult } from "./engine";
import { analyzePrivacy, extractUrls } from "./patterns";
import { analyzeUrl } from "./url";

type Rule = {
  id: string;
  title: string;
  category: Finding["category"];
  severity: Finding["severity"];
  patterns: RegExp[];
  description: string;
  reason: string;
  recommendation: string;
};

const RULES: Rule[] = [
  {
    id: "txt-urgency",
    title: "Urgency manipulation",
    category: "Social Engineering",
    severity: "high",
    patterns: [
      /\b(urgent|immediately|right away|within \d+ (hours?|minutes?)|last chance|final warning|act now|expires? (today|soon|in)|as soon as possible)\b/i,
      /\b(عاجل|فورا|فوراً|خلال ساعة|آخر فرصة)\b/,
    ],
    description: "The message pushes you to act very quickly.",
    reason:
      "Artificial time pressure is the most common tactic used to stop people from verifying a request.",
    recommendation: "Slow down. Verify the request through an official channel you already trust.",
  },
  {
    id: "txt-threat",
    title: "Threatening or intimidating language",
    category: "Social Engineering",
    severity: "high",
    patterns: [
      /\b(account (will be )?(suspended|blocked|closed|terminated|deleted)|legal action|police|lawsuit|you will lose|permanently (blocked|deleted)|penalty|fine of)\b/i,
      /\b(سيتم إيقاف|سيتم حظر|إجراء قانوني)\b/,
    ],
    description: "The message threatens negative consequences.",
    reason: "Fear is used to make targets comply before thinking.",
    recommendation: "Contact the organisation directly using their official app or website.",
  },
  {
    id: "txt-prize",
    title: "Prize, reward or lottery claim",
    category: "Phishing",
    severity: "high",
    patterns: [
      /\b(you (have )?(won|win)|congratulations|winner|lottery|prize|free gift|claim your|reward of|lucky (winner|draw)|gift card)\b/i,
      /\b(مبروك|لقد فزت|جائزة|هدية مجانية)\b/,
    ],
    description: "The message claims you won something or offers a free reward.",
    reason: "Unsolicited prize claims are a classic bait used to collect data or fees.",
    recommendation: "Ignore it. You cannot win a competition you never entered.",
  },
  {
    id: "txt-credentials",
    title: "Request for credentials",
    category: "Phishing",
    severity: "critical",
    patterns: [
      /\b(confirm|verify|update|enter|send|provide|share)\b[^.\n]{0,40}\b(password|login|credentials|username|account details|pin|cvv|card number|full card)\b/i,
      /\b(sign in|log ?in) (here|now|to (?:verify|confirm|restore))\b/i,
      /\b(كلمة السر|كلمة المرور|بيانات الحساب)\b/,
    ],
    description: "The message asks you to supply login or card details.",
    reason: "Legitimate organisations never ask for passwords or full card details in a message.",
    recommendation: "Do not reply and do not enter credentials. Report the message as phishing.",
  },
  {
    id: "txt-otp",
    title: "One-time code (OTP) request",
    category: "Phishing",
    severity: "critical",
    patterns: [
      /\b(otp|one[- ]time (code|password)|verification code|security code|sms code|6[- ]digit code)\b[^.\n]{0,40}\b(send|share|forward|give|provide|tell)\b/i,
      /\b(send|share|forward|give|provide|tell)\b[^.\n]{0,40}\b(otp|one[- ]time (code|password)|verification code|security code)\b/i,
      /\b(الكود|رمز التحقق)\b/,
    ],
    description: "The message asks for a one-time verification code.",
    reason: "An OTP is the last barrier protecting your account; sharing it hands over full access.",
    recommendation: "Never share OTP codes with anyone, including people claiming to be support staff.",
  },
  {
    id: "txt-payment",
    title: "Suspicious payment or transfer request",
    category: "Phishing",
    severity: "high",
    patterns: [
      /\b(wire transfer|bank transfer|send money|transfer \d+|western union|instapay|vodafone cash|gift ?card code|bitcoin|usdt|crypto wallet|payment link|pay a (small )?fee|delivery fee|customs fee)\b/i,
      /\b(تحويل|فودافون كاش|انستاباي|حول مبلغ)\b/,
    ],
    description: "The message requests money, a fee or a transfer.",
    reason: "Fees and transfers are how most scams convert contact into financial loss.",
    recommendation: "Do not transfer money. Verify the request with the person or company directly.",
  },
  {
    id: "txt-impersonation",
    title: "Impersonation indicators",
    category: "Social Engineering",
    severity: "medium",
    patterns: [
      /\b(this is (your )?(bank|manager|ceo|it (support|department)|customer (service|support))|on behalf of (?:the )?(?:bank|company)|official (?:notice|notification) from)\b/i,
      /\b(support team|security team|account team)\b[^.\n]{0,30}\b(contact(ed)? you|needs? your)\b/i,
    ],
    description: "The sender claims an authority or support identity.",
    reason: "Claiming authority discourages questions and speeds up compliance.",
    recommendation: "Verify identity through an official number or channel, not the one in the message.",
  },
  {
    id: "txt-secrecy",
    title: "Request to keep the conversation secret",
    category: "Social Engineering",
    severity: "medium",
    patterns: [/\b(do not (tell|share|inform)|keep (this|it) (secret|confidential|between us)|don't tell anyone)\b/i],
    description: "The message asks you to keep it private.",
    reason: "Isolation stops targets from getting a second opinion — a hallmark of fraud.",
    recommendation: "Talk to someone you trust before acting on the message.",
  },
  {
    id: "txt-attachment",
    title: "Pressure to open an attachment",
    category: "Security",
    severity: "medium",
    patterns: [
      /\b(open the attach(ed|ment)|see attached (invoice|document|file)|download the attach(ed|ment)|enable (macros|editing))\b/i,
    ],
    description: "The message pushes you to open or enable an attachment.",
    reason: "Attachments and macros are a primary malware delivery route.",
    recommendation: "Do not open the attachment; confirm with the sender by phone first.",
  },
  {
    id: "txt-generic-greeting",
    title: "Generic, impersonal greeting",
    category: "Phishing",
    severity: "low",
    patterns: [/^\s*(dear (customer|user|client|sir\/madam|account holder|member))\b/i],
    description: "The message opens with a generic greeting instead of your name.",
    reason: "Mass phishing campaigns rarely know the recipient's real name.",
    recommendation: "Be cautious; check whether the sender normally addresses you by name.",
  },
];

export function analyzeText(input: string): ScanResult {
  const text = input.trim();
  const findings: Finding[] = [];
  const passed: string[] = [];

  for (const rule of RULES) {
    const hit = rule.patterns.map((re) => text.match(re)).find(Boolean);
    if (hit) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        reason: rule.reason,
        recommendation: rule.recommendation,
        evidence: [hit[0].slice(0, 90)],
      });
    }
  }

  // Links inside the message get the full URL heuristics treatment.
  const urls = extractUrls(text);
  if (urls.length) {
    const worst = urls
      .map((u) => ({ url: u, res: analyzeUrl(u) }))
      .sort((a, b) => b.res.score - a.res.score)[0];
    if (worst.res.score > 20) {
      findings.push({
        id: "txt-suspicious-link",
        severity: worst.res.score > 60 ? "critical" : "high",
        category: "Phishing",
        title: "Suspicious link in the message",
        description: `A link in the message scored ${worst.res.score}/100 on its own URL checks.`,
        reason:
          worst.res.findings[0]?.reason ??
          "The link shows characteristics commonly associated with suspicious destinations.",
        recommendation:
          "Do not open the link, and never enter passwords or payment details from a message link.",
        evidence: [worst.url.slice(0, 90)],
      });
    } else {
      findings.push({
        id: "txt-link-present",
        severity: "info",
        category: "Security",
        title: "Message contains a link",
        description: `${urls.length} link(s) found. No strong risk pattern in the link itself.`,
        reason: "Links are the usual delivery method for phishing pages even when they look normal.",
        recommendation: "Open links only if you were expecting them from this sender.",
        evidence: urls.slice(0, 3).map((u) => u.slice(0, 90)),
      });
    }
  } else {
    passed.push("No links found in the message");
  }

  findings.push(...analyzePrivacy(text, "the message"));

  if (!findings.some((f) => f.category === "Phishing" || f.category === "Social Engineering")) {
    passed.push("No known phishing or manipulation language detected");
  }

  return buildResult("Text", `Pasted text (${text.length} characters)`, findings, passed);
}
