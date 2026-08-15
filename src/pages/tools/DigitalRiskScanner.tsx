import { useRef, useState } from "react";
import {
  ShieldAlert, FileText, Link2, Type, Image as ImageIcon, Copy, Download,
  RotateCcw, CheckCircle2, AlertTriangle, Eraser, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { ToolSeo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { tools, CREDIT_COST } from "@/lib/tools";
import { supabase } from "@/integrations/supabase/client";
import {
  buildReportText, countByCategory, countBySeverity, LEVEL_HINT, SEVERITY_LABEL,
  type ScanResult, type Severity,
} from "@/lib/risk/engine";
import { analyzeFile, validateFile } from "@/lib/risk/file";
import { analyzeText } from "@/lib/risk/text";
import { analyzeUrl, normalizeUrl, type UrlProbe } from "@/lib/risk/url";
import { analyzeImage, redactImage, validateImage, type ImageOcr } from "@/lib/risk/image";
import { stripImageMetadata } from "@/lib/risk/exif";

const tool = tools.find((t) => t.slug === "digital-risk-scanner")!;

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-secondary/15 text-secondary-foreground border-secondary/30",
  low: "bg-accent text-accent-foreground border-border",
  info: "bg-muted text-muted-foreground border-border",
};

const LEVEL_STYLE: Record<ScanResult["level"], string> = {
  LOW: "text-emerald-500",
  MODERATE: "text-emerald-500",
  MEDIUM: "text-amber-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-destructive",
};

const downloadBlob = (blob: Blob, name: string) => {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
};

const ScoreRing = ({ result }: { result: ScanResult }) => (
  <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
    <div
      className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(hsl(var(--primary)) ${result.score * 3.6}deg, hsl(var(--muted)) 0deg)`,
      }}
      role="img"
      aria-label={`Risk score ${result.score} of 100`}
    >
      <div className="flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full bg-card">
        <span className="text-2xl font-bold">{result.score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
    <div className="text-center sm:text-left">
      <p className={`text-xl font-bold ${LEVEL_STYLE[result.level]}`}>{result.level} RISK</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{LEVEL_HINT[result.level]}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {result.scanType} scan · {result.subject}
      </p>
    </div>
  </div>
);

const FindingsList = ({ result }: { result: ScanResult }) => {
  const counts = countBySeverity(result.findings);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(counts) as Severity[])
          .filter((s) => counts[s] > 0)
          .map((s) => (
            <Badge key={s} variant="outline" className={SEVERITY_STYLE[s]}>
              {counts[s]} {SEVERITY_LABEL[s]}
            </Badge>
          ))}
        {countByCategory(result.findings).map((c) => (
          <Badge key={c.category} variant="secondary">
            {c.category}: {c.count}
          </Badge>
        ))}
      </div>

      {result.findings.length === 0 ? (
        <Card className="flex items-center gap-3 p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          No risks detected in this scan.
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full">
          {result.findings.map((f, i) => (
            <AccordionItem key={`${f.id}-${i}`} value={`${f.id}-${i}`}>
              <AccordionTrigger className="text-left">
                <span className="flex flex-wrap items-center gap-2 pr-2">
                  <Badge variant="outline" className={SEVERITY_STYLE[f.severity]}>
                    {SEVERITY_LABEL[f.severity]}
                  </Badge>
                  <span className="text-sm font-medium">{f.title}</span>
                  <span className="text-xs text-muted-foreground">{f.category}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm">
                <p>{f.description}</p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Why it matters: </strong>
                  {f.reason}
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">What to do: </strong>
                  {f.recommendation}
                </p>
                {f.evidence?.length ? (
                  <ul className="space-y-1 rounded-lg bg-muted/60 p-3 font-mono text-xs break-all">
                    {f.evidence.map((e, k) => (
                      <li key={k}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {result.passed.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Checks that passed</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {result.passed.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const DigitalRiskScanner = () => {
  const { withCredits, upgradeOpen, setUpgradeOpen } = useCreditGuard("digital-risk-scanner");
  const [tab, setTab] = useState("file");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<ImageOcr | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setFile(null);
    setUrlInput("");
    setTextInput("");
    setImage(null);
    setOcr(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const run = async (job: () => Promise<ScanResult>) => {
    setLoading(true);
    setResult(null);
    try {
      await withCredits(async () => {
        const scan = await job();
        setResult(scan);
      });
    } finally {
      setLoading(false);
    }
  };

  const scanFile = () => {
    if (!file) return toast.error("Choose a file to scan.");
    const check = validateFile(file);
    if (!check.ok) return toast.error(check.reason);
    return run(async () => {
      const { result: scan } = await analyzeFile(file);
      return scan;
    });
  };

  const scanUrl = () =>
    run(async () => {
      const normalized = normalizeUrl(urlInput);
      let probe: UrlProbe | undefined;
      try {
        const { data } = await supabase.functions.invoke("scan-url-probe", {
          body: { url: normalized },
        });
        if (data && !data.error) probe = data as UrlProbe;
        else if (data?.error) probe = { reachable: false, error: data.error };
      } catch {
        // Probe is best-effort; heuristics still produce a full report.
      }
      return analyzeUrl(urlInput, probe);
    });

  const scanText = () => {
    if (textInput.trim().length < 10) return toast.error("Paste at least 10 characters of text.");
    return run(async () => analyzeText(textInput));
  };

  const scanImage = () => {
    if (!image) return toast.error("Choose an image to scan.");
    const check = validateImage(image);
    if (!check.ok) return toast.error(check.reason);
    return run(async () => {
      try {
        const { result: scan, ocr: extracted } = await analyzeImage(image);
        setOcr(extracted);
        return scan;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Image analysis failed.");
        throw e;
      }
    });
  };

  const copyReport = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildReportText(result));
      toast.success("Report copied to clipboard.");
    } catch {
      toast.error("Clipboard access was blocked by your browser.");
    }
  };

  const downloadReport = () => {
    if (!result) return;
    downloadBlob(
      new Blob([buildReportText(result)], { type: "text/plain;charset=utf-8" }),
      `risk-report-${Date.now()}.txt`,
    );
  };

  const cleanImage = async (mode: "metadata" | "redact") => {
    if (!image) return;
    try {
      const blob =
        mode === "metadata"
          ? await stripImageMetadata(image)
          : await redactImage(image, ocr?.regions ?? []);
      downloadBlob(blob, `${mode === "metadata" ? "clean" : "redacted"}-${image.name.replace(/\.[^.]+$/, "")}.png`);
      toast.success(mode === "metadata" ? "Metadata removed." : "Redacted image ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process the image.");
    }
  };

  return (
    <Layout>
      <ToolSeo
        slug="digital-risk-scanner"
        name="Digital Risk Scanner"
        description="Scan files, URLs, text, and images for potential digital security, privacy, phishing, and social-engineering risks."
      />
      <div className="mx-auto w-full max-w-4xl px-1">
        <ToolPageHeader title={tool.title} description={tool.description} icon={ShieldAlert} />

        <Card className="mb-6 flex flex-col gap-2 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            Heuristic analysis only — this is not antivirus software and cannot guarantee safety.
          </p>
          <Badge variant="secondary" className="w-fit shrink-0">
            {CREDIT_COST} credits per scan
          </Badge>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="file" className="flex-1 gap-1.5">
              <FileText className="h-4 w-4" /> File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-1.5">
              <Link2 className="h-4 w-4" /> URL
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 gap-1.5">
              <Type className="h-4 w-4" /> Text
            </TabsTrigger>
            <TabsTrigger value="image" className="flex-1 gap-1.5">
              <ImageIcon className="h-4 w-4" /> Image
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4 space-y-3">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Card
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              className="cursor-pointer border-2 border-dashed p-8 text-center transition-base hover:border-primary/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <FileText className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="font-medium">{file ? file.name : "Drop a file or click to choose"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, DOCX, TXT, CSV, JSON, ZIP, images — up to 15 MB. Executables are rejected.
              </p>
            </Card>
            <Button onClick={scanFile} disabled={loading} className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Scan file
            </Button>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-3">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/login"
              inputMode="url"
              maxLength={2048}
            />
            <Button
              onClick={scanUrl}
              disabled={loading || !urlInput.trim()}
              className="w-full gradient-primary text-primary-foreground"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Scan URL
            </Button>
          </TabsContent>

          <TabsContent value="text" className="mt-4 space-y-3">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value.slice(0, 20000))}
              placeholder="Paste a suspicious message, email or SMS here…"
              className="min-h-[180px]"
            />
            <p className="text-xs text-muted-foreground">{textInput.length} / 20000 characters</p>
            <Button onClick={scanText} disabled={loading} className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Scan text
            </Button>
          </TabsContent>

          <TabsContent value="image" className="mt-4 space-y-3">
            <input
              ref={imageRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setImage(picked);
                setOcr(null);
                if (imagePreview) URL.revokeObjectURL(imagePreview);
                setImagePreview(picked ? URL.createObjectURL(picked) : null);
                e.target.value = "";
              }}
            />
            <Card
              role="button"
              tabIndex={0}
              onClick={() => imageRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && imageRef.current?.click()}
              className="cursor-pointer border-2 border-dashed p-6 text-center transition-base hover:border-primary/60"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Selected image awaiting risk analysis"
                  className="mx-auto max-h-48 w-auto rounded-xl object-contain"
                />
              ) : (
                <ImageIcon className="mx-auto mb-2 h-8 w-8 text-primary" />
              )}
              <p className="mt-2 font-medium">{image ? image.name : "Drop a screenshot or photo"}</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP — up to 8 MB</p>
            </Card>
            <Button onClick={scanImage} disabled={loading} className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Scan image
            </Button>
            {image && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => cleanImage("metadata")}>
                  <Eraser className="mr-2 h-4 w-4" /> Remove metadata
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => cleanImage("redact")}
                  disabled={!ocr?.regions.length}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Redact sensitive text{ocr ? ` (${ocr.regions.length})` : ""}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          )}

          {!loading && result && (
            <section className="space-y-6 animate-fade-in">
              <Card className="p-5">
                <ScoreRing result={result} />
              </Card>
              <FindingsList result={result} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={copyReport}>
                  <Copy className="mr-2 h-4 w-4" /> Copy report
                </Button>
                <Button variant="outline" className="flex-1" onClick={downloadReport}>
                  <Download className="mr-2 h-4 w-4" /> Download report
                </Button>
                <Button variant="ghost" className="flex-1" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" /> New scan
                </Button>
              </div>
            </section>
          )}
        </div>

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          Files and text are analysed locally in your browser whenever possible. Images are sent to
          Convertify's secure analysis service for text extraction and are never stored. Results are
          heuristic indicators, not a security guarantee — always verify with the sender or an
          official channel before acting.
        </p>
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default DigitalRiskScanner;
