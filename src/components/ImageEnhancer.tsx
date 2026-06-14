import { useState } from "react";
import { Download, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ImageUploader";
import { MetadataViewer } from "@/components/MetadataViewer";
import { extractMetadata, formatBytes, type ImageMeta } from "@/lib/imageMeta";
import { enhanceImage, type EnhanceResult } from "@/lib/imageEnhance";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_CREDIT_COST = 4;

type Props = {
  /** Charges credits and runs the action; resolves true when charged. */
  charge: (action: () => Promise<void>, amount: number) => Promise<boolean>;
};

export function ImageEnhancer({ charge }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const onFile = async (f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    setResult(null);
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setLoadingMeta(true);
    try {
      const m = await extractMetadata(f);
      setMeta(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read image metadata.");
      setMeta(null);
    } finally {
      setLoadingMeta(false);
    }
  };

  const runEnhance = async () => {
    if (!file) {
      toast.error("Please upload an image first.");
      return;
    }
    setEnhancing(true);
    let enhanced: EnhanceResult | null = null;
    const ok = await charge(async () => {
      // Throws on failure → no credits charged.
      enhanced = await enhanceImage(file);
    }, IMAGE_CREDIT_COST);
    setEnhancing(false);

    if (ok && enhanced) {
      setResult(enhanced);
      toast.success("Image enhanced successfully");
    } else if (!ok && enhanced === null) {
      // charge() handled the error/insufficient-credits messaging.
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `enhanced-${file?.name?.replace(/\.[^.]+$/, "") ?? "image"}.png`;
    a.click();
    toast.success("Downloaded enhanced image");
  };

  return (
    <div className="space-y-6">
      <ImageUploader onFile={onFile} loading={loadingMeta} preview={originalUrl} />

      {file && (
        <>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              AI-style enhancement: upscaling, denoise &amp; sharpening — runs locally.
            </p>
            <Button
              onClick={runEnhance}
              disabled={enhancing}
              className="w-full gradient-primary text-primary-foreground shadow-glow sm:w-auto"
            >
              {enhancing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Enhance ({IMAGE_CREDIT_COST} credits)
            </Button>
          </div>

          {result && originalUrl && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <figure className="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <figcaption className="border-b border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Before — {meta && formatBytes(meta.fileSize)} · {meta?.width}×{meta?.height}
                  </figcaption>
                  <img src={originalUrl} alt="Original" className="h-auto w-full object-contain" />
                </figure>
                <figure className="overflow-hidden rounded-xl border border-primary/40 bg-muted/30">
                  <figcaption className="border-b border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    After — {formatBytes(result.size)} · {result.width}×{result.height} ({result.scale}×)
                  </figcaption>
                  <img src={result.url} alt="Enhanced" className="h-auto w-full object-contain" />
                </figure>
              </div>
              <div className="flex justify-end">
                <Button onClick={download} variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Download enhanced
                </Button>
              </div>
            </div>
          )}

          {meta && !loadingMeta && <MetadataViewer meta={meta} />}
        </>
      )}
    </div>
  );
}
