import { useMemo, useState } from "react";
import { Copy, Download, Globe, ImageIcon, Palette, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tools, CREDIT_COST } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { PaletteGrid } from "@/components/PaletteGrid";
import { WebsiteAnalyzer } from "@/components/WebsiteAnalyzer";
import { ImageUploader } from "@/components/ImageUploader";
import {
  buildPalette,
  complementary,
  extractColorsFromImage,
  monochromatic,
  paletteToCss,
  paletteToJson,
  paletteToTxt,
  rgbToHex,
  type RGB,
  type Swatch,
} from "@/lib/colors";

const tool = tools.find((t) => t.slug === "color-palette-extractor")!;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const ColorPaletteExtractor = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [palette, setPalette] = useState<{ dominant: Swatch; swatches: Swatch[] } | null>(null);
  const { withCredits, upgradeOpen, setUpgradeOpen } = useCreditGuard(tool.slug);

  const extras = useMemo(() => {
    if (!palette) return null;
    const base = palette.dominant.rgb;
    const comp = complementary(base);
    const mono = monochromatic(base, 5);
    return { comp, mono };
  }, [palette]);

  // Website: fetch + extract on the server, then charge only on success.
  const analyzeWebsite = async () => {
    if (!url.trim()) {
      toast.error("Please enter a website URL.");
      return;
    }
    let colors: RGB[] = [];
    setLoading(true);
    const ok = await withCredits(async () => {
      const { data, error } = await supabase.functions.invoke("extract-website-colors", {
        body: { url: url.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.colors?.length) throw new Error("No colors detected.");
      colors = data.colors as RGB[];
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to analyze website.");
      return false;
    });
    setLoading(false);
    if (ok && colors.length) {
      setPreview(null);
      setPalette(buildPalette(colors));
      toast.success("Palette extracted from website");
    }
  };

  // Image: extract locally first; only charge if extraction succeeds.
  const analyzeImage = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    setLoading(true);
    let colors: RGB[] = [];
    try {
      colors = await extractColorsFromImage(file);
    } catch (e) {
      setLoading(false);
      toast.error(e instanceof Error ? e.message : "Could not read image.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const ok = await withCredits(async () => {
      /* colors already computed locally */
    });
    setLoading(false);
    if (ok) {
      setPreview(objectUrl);
      setPalette(buildPalette(colors));
      toast.success("Palette extracted from image");
    } else {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const copyAll = async () => {
    if (!palette) return;
    await navigator.clipboard.writeText(palette.swatches.map((s) => s.hex).join(", "));
    toast.success("Copied all HEX codes");
  };

  const download = (kind: "json" | "css" | "txt") => {
    if (!palette) return;
    const map = {
      json: { content: paletteToJson(palette.swatches), ext: "json", type: "application/json" },
      css: { content: paletteToCss(palette.swatches), ext: "css", type: "text/css" },
      txt: { content: paletteToTxt(palette.swatches), ext: "txt", type: "text/plain" },
    } as const;
    const { content, ext, type } = map[kind];
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `palette.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Downloaded palette.${ext}`);
  };

  return (
    <Layout>
      <div className="container max-w-5xl py-10 md:py-14">
        <ToolPageHeader title={tool.title} description={tool.description} icon={tool.icon} />

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 md:p-8">
          <Tabs defaultValue="website">
            <TabsList className="mb-6 grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="website">
                <Globe className="mr-1.5 h-4 w-4" /> Website
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImageIcon className="mr-1.5 h-4 w-4" /> Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="website" className="mt-0">
              <WebsiteAnalyzer url={url} onChange={setUrl} onAnalyze={analyzeWebsite} loading={loading} />
              <p className="mt-3 text-xs text-muted-foreground">
                We scan the page and its stylesheets to detect dominant brand colors.
              </p>
            </TabsContent>

            <TabsContent value="image" className="mt-0">
              <ImageUploader onFile={analyzeImage} loading={loading} preview={preview} />
            </TabsContent>
          </Tabs>
        </div>

        {palette && (
          <div className="mt-8 space-y-8 animate-fade-in">
            {/* Dominant color */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">Dominant Color</h2>
              <div
                className="flex flex-col items-start justify-end gap-1 rounded-2xl border border-border p-6 shadow-sm sm:h-40"
                style={{ backgroundColor: palette.dominant.hex }}
              >
                <span
                  className="rounded-full px-3 py-1 text-sm font-mono font-semibold"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.85)",
                    color: "#111",
                  }}
                >
                  {palette.dominant.hex} · {`RGB(${palette.dominant.rgb.r}, ${palette.dominant.rgb.g}, ${palette.dominant.rgb.b})`}
                </span>
              </div>
            </section>

            {/* Palette */}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Color Palette</h2>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyAll}>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy all
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="gradient-primary text-primary-foreground shadow-glow">
                        <Download className="mr-1.5 h-4 w-4" /> Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => download("json")}>JSON</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => download("css")}>CSS Variables</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => download("txt")}>Plain Text</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <PaletteGrid swatches={palette.swatches} />
            </section>

            {/* Generated extras */}
            {extras && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Generated Variations
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Complementary</p>
                    <PaletteGrid
                      swatches={[
                        { ...palette.dominant, label: "Base" },
                        {
                          rgb: extras.comp,
                          hex: rgbToHex(extras.comp),
                          role: "accent",
                          label: "Complement",
                        },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Monochromatic</p>
                    <PaletteGrid
                      swatches={extras.mono.map((rgb, i) => ({
                        rgb,
                        hex: rgbToHex(rgb),
                        role: "supporting" as const,
                        label: `Shade ${i + 1}`,
                      }))}
                    />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {!palette && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Palette className="h-7 w-7" />
            </span>
            <p className="max-w-md text-sm">
              Extract a beautiful, ready-to-use color palette from any website or image.
              Each extraction costs {CREDIT_COST} credits.
            </p>
          </div>
        )}
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default ColorPaletteExtractor;
