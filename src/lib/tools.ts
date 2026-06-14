import {
  Braces,
  Image as ImageIcon,
  
  QrCode,
  Link2,
  Download,
  Code2,
  Ruler,
  Timer,
  Binary,
  Palette,
  ScanSearch,
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
    premium: false,
  },
  {
    slug: "image-compressor",
    title: "Image Compressor",
    description: "Shrink image file size in your browser without losing quality.",
    icon: ImageIcon,
    category: "Media",
    keywords: ["image", "compress", "optimize", "photo", "size"],
    premium: true,
  },
  {
    slug: "file-to-qr",
    title: "File to QR Code",
    description: "Upload any file and get a scannable QR code that links to it.",
    icon: QrCode,
    category: "QR",
    keywords: ["qr", "file", "share", "code", "upload"],
    premium: true,
  },
  {
    slug: "file-to-link",
    title: "File to Link",
    description: "Upload a file and instantly get a shareable download link.",
    icon: Link2,
    category: "Files",
    keywords: ["share", "link", "upload", "url", "file"],
    premium: true,
  },
  {
    slug: "link-to-file",
    title: "Link to File",
    description: "Paste a URL and download the file directly to your device.",
    icon: Download,
    category: "Files",
    keywords: ["link", "url", "download", "file", "fetch"],
    premium: true,
  },
  {
    slug: "code-generator",
    title: "AI Code Generator",
    description: "Describe what you want and get clean, working code in your favorite language.",
    icon: Code2,
    category: "AI",
    keywords: ["code", "generator", "ai", "developer", "html", "css", "javascript", "python", "java", "cpp"],
    premium: true,
  },
  {
    slug: "unit-converter",
    title: "Unit Converter",
    description: "Convert between length, weight, temperature, time, speed, and data units instantly.",
    icon: Ruler,
    category: "Utilities",
    keywords: ["unit", "converter", "length", "weight", "temperature", "time", "speed", "data", "measurement"],
    premium: true,
  },
  {
    slug: "study-timer",
    title: "Study Timer (Pomodoro)",
    description: "Fully customizable focus and break timer with stats, sound, and notifications.",
    icon: Timer,
    category: "Utilities",
    keywords: ["pomodoro", "study", "timer", "focus", "break", "productivity"],
    premium: false,
  },
  {
    slug: "universal-encoder",
    title: "Universal Encoder / Decoder",
    description:
      "Encode and decode Base64, URL, HTML, Binary, Hex, ASCII, Unicode, Morse, ROT13, and JWT — all in one place.",
    icon: Binary,
    category: "Developer",
    keywords: [
      "encode", "decode", "base64", "url", "html", "binary", "hex", "ascii",
      "unicode", "morse", "rot13", "jwt", "converter", "cipher",
    ],
    premium: true,
  },
  {
    slug: "color-palette-extractor",
    title: "Color Palette Extractor",
    description:
      "Extract beautiful, ready-to-use color palettes from any website URL or uploaded image.",
    icon: Palette,
    category: "Media",
    keywords: [
      "color", "palette", "extractor", "hex", "rgb", "design", "website",
      "image", "swatch", "brand", "css variables", "dominant color",
    ],
    premium: true,
  },
  {
    slug: "crypto-image-analyzer",
    title: "Crypto & Image Analyzer",
    description:
      "Enhance images, read EXIF metadata, detect encodings & ciphers, and analyze hashes — all in one tool.",
    icon: ScanSearch,
    category: "Developer",
    keywords: [
      "crypto", "image", "analyzer", "enhance", "upscale", "metadata", "exif",
      "gps", "base64", "hash", "md5", "sha256", "caesar", "cipher", "decode", "detect",
    ],
    premium: true,
  },
];
