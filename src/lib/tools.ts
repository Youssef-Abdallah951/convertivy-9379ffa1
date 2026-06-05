import {
  Braces,
  Image as ImageIcon,
  
  QrCode,
  Link2,
  Download,
  Code2,
  Ruler,
  Timer,
  type LucideIcon,
} from "lucide-react";

export type Tool = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: "Text" | "Developer" | "AI" | "Media" | "Files" | "QR" | "Utilities";
  keywords: string[];
  /** Premium tools deduct credits per use. Free tools never charge. */
  premium: boolean;
};

/** Credits deducted each time a premium tool is used. */
export const CREDIT_COST = 2;

/** Tools that are always free and never deduct credits. */
export const FREE_TOOL_SLUGS = ["json-formatter", "study-timer"] as const;

export const isPremiumTool = (slug: string) =>
  !FREE_TOOL_SLUGS.includes(slug as (typeof FREE_TOOL_SLUGS)[number]);

export const tools: Tool[] = [
  {
    slug: "json-formatter",
    title: "JSON Formatter",
    description: "Beautify, validate, and minify JSON with helpful error messages.",
    icon: Braces,
    category: "Developer",
    keywords: ["json", "format", "validate", "developer", "api"],
  },
  {
    slug: "image-compressor",
    title: "Image Compressor",
    description: "Shrink image file size in your browser without losing quality.",
    icon: ImageIcon,
    category: "Media",
    keywords: ["image", "compress", "optimize", "photo", "size"],
  },
  {
    slug: "file-to-qr",
    title: "File to QR Code",
    description: "Upload any file and get a scannable QR code that links to it.",
    icon: QrCode,
    category: "QR",
    keywords: ["qr", "file", "share", "code", "upload"],
  },
  {
    slug: "file-to-link",
    title: "File to Link",
    description: "Upload a file and instantly get a shareable download link.",
    icon: Link2,
    category: "Files",
    keywords: ["share", "link", "upload", "url", "file"],
  },
  {
    slug: "link-to-file",
    title: "Link to File",
    description: "Paste a URL and download the file directly to your device.",
    icon: Download,
    category: "Files",
    keywords: ["link", "url", "download", "file", "fetch"],
  },
  {
    slug: "code-generator",
    title: "AI Code Generator",
    description: "Describe what you want and get clean, working code in your favorite language.",
    icon: Code2,
    category: "AI",
    keywords: ["code", "generator", "ai", "developer", "html", "css", "javascript", "python", "java", "cpp"],
  },
  {
    slug: "unit-converter",
    title: "Unit Converter",
    description: "Convert between length, weight, temperature, time, speed, and data units instantly.",
    icon: Ruler,
    category: "Utilities",
    keywords: ["unit", "converter", "length", "weight", "temperature", "time", "speed", "data", "measurement"],
  },
  {
    slug: "study-timer",
    title: "Study Timer (Pomodoro)",
    description: "Fully customizable focus and break timer with stats, sound, and notifications.",
    icon: Timer,
    category: "Utilities",
    keywords: ["pomodoro", "study", "timer", "focus", "break", "productivity"],
  },
];
