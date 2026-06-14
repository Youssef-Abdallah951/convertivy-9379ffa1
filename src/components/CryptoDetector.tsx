import { useState } from "react";
import { Search, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/CopyButton";
import {
  analyzeCrypto,
  analyzeCharacters,
  type Detection,
  type CharAnalysis,
} from "@/lib/cryptoAnalysis";

const TEXT_CREDIT_COST = 2;

const ENCRYPTION_KEYWORDS = ["aes", "rsa", "-----begin", "pgp"];

type Props = {
  charge: (action: () => Promise<void>, amount: number) => Promise<boolean>;
};

export function CryptoDetector({ charge }: Props) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Detection[] | null>(null);
  const [chars, setChars] = useState<CharAnalysis | null>(null);
  const [busy, setBusy] = useState(false);

  const showsEncryptionNotice =
    input.trim().length > 0 &&
    ENCRYPTION_KEYWORDS.some((k) => input.toLowerCase().includes(k));

  const run = async () => {
    const text = input.trim();
    if (!text) {
      toast.error("Please enter some text to analyze.");
      return;
    }
    setBusy(true);
    let detections: Detection[] = [];
    let analysis: CharAnalysis | null = null;
    const ok = await charge(async () => {
      detections = analyzeCrypto(text);
      analysis = analyzeCharacters(text);
      if (!detections.length) throw new Error("Nothing to analyze.");
    }, TEXT_CREDIT_COST);
    setBusy(false);

    if (ok) {
      setResults(detections);
      setChars(analysis);
      toast.success("Analysis complete");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Text, hash, or encoded string
          </label>
          <span className="text-xs text-muted-foreground">{input.length} chars</span>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. SGVsbG8="
          className="min-h-[120px] resize-y font-mono text-sm"
        />
      </div>

      {showsEncryptionNotice && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-foreground">
            This looks like strong encryption (AES/RSA/PGP).{" "}
            <strong>This encryption cannot be decrypted without the proper key.</strong>
          </p>
        </div>
      )}

      <Button
        onClick={run}
        disabled={busy}
        className="w-full gradient-primary text-primary-foreground shadow-glow sm:w-auto"
      >
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
        Analyze ({TEXT_CREDIT_COST} credits)
      </Button>

      {results && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Detection Results
          </h3>
          {results.map((r, i) => (
            <div
              key={`${r.type}-${i}`}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="gradient-primary text-primary-foreground">{r.label}</Badge>
                {i === 0 && <Badge variant="secondary">Best match</Badge>}
                <Badge variant={r.reversible ? "outline" : "destructive"}>
                  {r.reversible ? "Reversible" : "Not reversible"}
                </Badge>
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confidence</span>
                  <span className="font-medium text-foreground">{r.confidence}%</span>
                </div>
                <Progress value={r.confidence} className="h-2" />
              </div>
              {r.decoded && (
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decoded preview
                    </span>
                    <CopyButton value={r.decoded} />
                  </div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-sm">
                    {r.decoded}
                  </pre>
                </div>
              )}
              {r.note && <p className="mt-2 text-xs text-muted-foreground">{r.note}</p>}
            </div>
          ))}

          {chars && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Character Analysis
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Length", chars.length],
                  ["Unique", chars.unique],
                  ["Letters", chars.letters],
                  ["Digits", chars.digits],
                  ["Uppercase", chars.uppercase],
                  ["Lowercase", chars.lowercase],
                  ["Symbols", chars.symbols],
                  ["Entropy", `${chars.entropyBits} bits`],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg bg-background p-3 text-center">
                    <div className="text-lg font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
