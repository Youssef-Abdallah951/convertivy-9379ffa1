import {
  ArrowDownUp,
  Binary,
  Code,
  Cpu,
  FileCode,
  FileJson,
  Fingerprint,
  FolderOpen,
  Globe,
  Hash,
  Key,
  KeyRound,
  Languages,
  Layers,
  Lock,
  Minimize2,
  Type,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { OPERATIONS, type Operation } from "@/lib/operations";

export type DisplayCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  filter: (op: Operation) => boolean;
};

export const DISPLAY_CATEGORIES: DisplayCategory[] = [
  {
    id: "encoding",
    title: "Encoding",
    icon: Binary,
    description: "Convert text into alternate formats like Base64, Hex, and Base32.",
    filter: (op) => op.category === "Encoding",
  },
  {
    id: "decoding",
    title: "Decoding",
    icon: ArrowDownUp,
    description: "Reverse encoded data back to its original form.",
    filter: (op) => !!op.reversible,
  },
  {
    id: "hashing",
    title: "Hashing",
    icon: Fingerprint,
    description: "Generate one-way cryptographic digests.",
    filter: (op) => op.category === "Security",
  },
  {
    id: "encryption",
    title: "Encryption",
    icon: Lock,
    description: "Transform data with reversible cipher algorithms.",
    filter: (op) => op.category === "Ciphers",
  },
  {
    id: "ciphers",
    title: "Ciphers",
    icon: Key,
    description: "Classical and modern ciphers including Caesar and Vigenère.",
    filter: (op) => op.category === "Ciphers",
  },
  {
    id: "web",
    title: "Web",
    icon: Globe,
    description: "URL encode/decode and HTML entity conversions.",
    filter: (op) => op.category === "Web",
  },
  {
    id: "json",
    title: "JSON",
    icon: FileJson,
    description: "Pretty print, minify, and validate JSON data.",
    filter: (op) => op.category === "Developer" && op.keywords.some((k) => k.includes("json")),
  },
  {
    id: "xml",
    title: "XML",
    icon: FileCode,
    description: "Encode and decode XML entities and structures.",
    filter: () => false,
  },
  {
    id: "text",
    title: "Text",
    icon: Type,
    description: "ASCII, UTF-8, and UTF-16 code point conversions.",
    filter: (op) => op.category === "Text",
  },
  {
    id: "numbers",
    title: "Numbers",
    icon: Hash,
    description: "Binary, octal, decimal, and hexadecimal representations.",
    filter: (op) => op.category === "Numbers",
  },
  {
    id: "binary",
    title: "Binary",
    icon: Cpu,
    description: "Work with raw binary byte representations.",
    filter: (op) => op.id === "binary",
  },
  {
    id: "unicode",
    title: "Unicode",
    icon: Languages,
    description: "Unicode escape sequences and code point conversions.",
    filter: (op) => op.category === "Unicode",
  },
  {
    id: "base-encodings",
    title: "Base Encodings",
    icon: Layers,
    description: "Base16, Base32, Base45, Base58, Base62, Base64, and Base85.",
    filter: (op) => op.category === "Encoding",
  },
  {
    id: "jwt",
    title: "JWT",
    icon: KeyRound,
    description: "Decode JSON Web Tokens into readable headers and payloads.",
    filter: (op) => op.id === "jwt",
  },
  {
    id: "compression",
    title: "Compression",
    icon: Minimize2,
    description: "Compress and decompress data streams.",
    filter: () => false,
  },
  {
    id: "file-tools",
    title: "File Tools",
    icon: FolderOpen,
    description: "Load files directly into the input area.",
    filter: () => false,
  },
  {
    id: "developer",
    title: "Developer",
    icon: Code,
    description: "Developer utilities for JWT and JSON handling.",
    filter: (op) => op.category === "Developer",
  },
  {
    id: "utilities",
    title: "Utilities",
    icon: Wand2,
    description: "Text transformations, sorting, and character counting.",
    filter: (op) => op.category === "Utilities",
  },
];

export const countOperations = (id: string): number => {
  const category = DISPLAY_CATEGORIES.find((c) => c.id === id);
  if (!category) return 0;
  return OPERATIONS.filter(category.filter).length;
};
