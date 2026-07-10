import { useState } from "react";
import QRCode from "qrcode";
import { Loader2, ScanLine, Copy, Trash2, Download, Sparkles, Link2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { tools, CREDIT_COST } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";

const tool = tools.find((t) => t.slug === "link-to-qr")!;

type Level = "L" | "M" | "Q" | "H";

/**
 * Normalizes and validates a user-entered URL.
 * - Prepends https:// when no protocol is present.
 * - Returns null when the value cannot be a valid http(s) URL.
 */
function normalizeUrl(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // Must have a dotted hostname (e.g. example.com) or localhost.
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const LinkToQr = () => {
  const [input, setInput] = useState("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Customization
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [level, setLevel] = useState<Level>("M");

  const { withCredits, upgradeOpen, setUpgradeOpen, credits } = useCreditGuard(tool.slug);

  const generate = async () => {
    const url = normalizeUrl(input);
    if (!url) {
      toast.error("Please enter a valid URL (e.g. https://example.com).");
      return;
    }

    // Verify balance up-front so we never start work the user can't pay for.
    if (credits && !credits.isUnlimited && credits.credits < CREDIT_COST) {
      toast.error("Not enough credits. Please recharge your balance.");
      setUpgradeOpen(true);
      return;
    }

    await withCredits(async () => {
      setLoading(true);
      setPngUrl(null);
      setSvgString(null);
      try {
        const opts = {
          width: size,
          margin,
          errorCorrectionLevel: level,
          color: { dark: fgColor, light: bgColor },
        } as const;

        const dataUrl = await QRCode.toDataURL(url, opts);
        const svg = await QRCode.toString(url, { ...opts, type: "svg" });

        setPngUrl(dataUrl);
        setSvgString(svg);
        setFinalUrl(url);
        toast.success("QR code generated");
      } catch (e) {
        console.error(e);
        toast.error("Generation failed. Please try again.");
        throw e;
      } finally {
        setLoading(false);
      }
    });
  };

  const copyImage = async () => {
    if (!pngUrl) return;
    try {
      const blob = await (await fetch(pngUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("QR image copied");
    } catch {
      toast.error("Copying images isn't supported in this browser.");
    }
  };

  const copyLink = async () => {
    if (!finalUrl) return;
    await navigator.clipboard.writeText(finalUrl);
    toast.success("Link copied");
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(href);
  };

  const clearAll = () => {
    setInput("");
    setFinalUrl(null);
    setPngUrl(null);
    setSvgString(null);
  };

  return (
    <Layout>
      <div className="container max-w-4xl py-10 md:py-14">
        <ToolPageHeader title={tool.title} description={tool.description} icon={tool.icon} />

        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          {/* Controls */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Label htmlFor="qr-url" className="text-sm font-semibold">
              Website link or URL
            </Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="qr-url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") generate();
                }}
                placeholder="https://example.com"
                className="font-mono text-sm"
              />
              <Button
                onClick={generate}
                disabled={loading}
                className="gradient-primary text-primary-foreground shadow-glow shrink-0"
              >
                {loading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                Generate
              </Button>
            </div>

            {/* Customization */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Size ({size}px)
                </Label>
                <Slider
                  value={[size]}
                  min={128}
                  max={1024}
                  step={32}
                  onValueChange={(v) => setSize(v[0])}
                  className="mt-3"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Margin ({margin})
                </Label>
                <Slider
                  value={[margin]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setMargin(v[0])}
                  className="mt-3"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Foreground
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />
                  <Input
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Background
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Error correction level
                </Label>
                <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L — Low (~7%)</SelectItem>
                    <SelectItem value="M">M — Medium (~15%)</SelectItem>
                    <SelectItem value="Q">Q — Quartile (~25%)</SelectItem>
                    <SelectItem value="H">H — High (~30%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {finalUrl && (
              <div className="mt-6">
                <Label className="text-xs font-medium text-muted-foreground">
                  Original link
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input value={finalUrl} readOnly className="font-mono text-xs" />
                  <Button onClick={copyLink} variant="outline" className="shrink-0">
                    <Link2 className="mr-1.5 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={clearAll}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div
              className="flex h-64 w-64 items-center justify-center rounded-xl bg-muted/40"
              style={pngUrl ? { backgroundColor: bgColor } : undefined}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : pngUrl ? (
                <img src={pngUrl} alt="Generated QR code" className="h-full w-full rounded-xl" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ScanLine className="h-8 w-8" />
                  <p className="text-sm">Live preview</p>
                </div>
              )}
            </div>

            {pngUrl && (
              <div className="grid w-full grid-cols-2 gap-2">
                <a href={pngUrl} download="qr-code.png" className="col-span-2">
                  <Button className="w-full gradient-primary text-primary-foreground shadow-glow">
                    <Download className="mr-1.5 h-4 w-4" />
                    Download PNG
                  </Button>
                </a>
                <Button variant="outline" onClick={downloadSvg}>
                  <Download className="mr-1.5 h-4 w-4" />
                  SVG
                </Button>
                <Button variant="outline" onClick={copyImage}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy image
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default LinkToQr;
