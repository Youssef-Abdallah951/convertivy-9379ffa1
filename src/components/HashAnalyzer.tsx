import { useState } from "react";
import { Fingerprint, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import { identifyHash, computeHashes, type HashInfo } from "@/lib/cryptoAnalysis";

const TEXT_CREDIT_COST = 2;

const SECURITY_VARIANT: Record<HashInfo["security"], "destructive" | "secondary" | "default"> = {
  Broken: "destructive",
  Weak: "secondary",
  Strong: "default",
};

type Props = {
  charge: (action: () => Promise<void>, amount: number) => Promise<boolean>;
};

export function HashAnalyzer({ charge }: Props) {
  const [hashInput, setHashInput] = useState("");
  const [info, setInfo] = useState<HashInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState("");
  const [generated, setGenerated] = useState<{ algo: string; hex: string }[] | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  const identify = async () => {
    const s = hashInput.trim();
    if (!s) {
      toast.error("Please paste a hash to analyze.");
      return;
    }
    const result = identifyHash(s);
    if (!result) {
      setInfo(null);
      setNotFound(true);
      toast.error("Not a recognized MD5 / SHA hash length.");
      return;
    }
    setBusy(true);
    const ok = await charge(async () => {
      /* result already computed */
    }, TEXT_CREDIT_COST);
    setBusy(false);
    if (ok) {
      setNotFound(false);
      setInfo(result);
      toast.success(`Identified: ${result.type}`);
    }
  };

  const generate = async () => {
    if (!text.trim()) {
      toast.error("Please enter text to hash.");
      return;
    }
    setGenBusy(true);
    let hashes: { algo: string; hex: string }[] = [];
    const ok = await charge(async () => {
      hashes = await computeHashes(text);
    }, TEXT_CREDIT_COST);
    setGenBusy(false);
    if (ok) {
      setGenerated(hashes);
      toast.success("Hashes generated");
    }
  };

  return (
    <div className="space-y-8">
      {/* Identify a hash */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Fingerprint className="h-4 w-4" /> Identify a hash
        </h3>
        <Input
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          placeholder="e.g. 5d41402abc4b2a76b9719d911017c592"
          className="font-mono"
        />
        <Button
          onClick={identify}
          disabled={busy}
          className="w-full gradient-primary text-primary-foreground shadow-glow sm:w-auto"
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-1.5 h-4 w-4" />}
          Identify ({TEXT_CREDIT_COST} credits)
        </Button>

        {notFound && (
          <p className="text-sm text-muted-foreground">
            Length doesn&apos;t match a known hash (MD5 32, SHA-1 40, SHA-256 64, SHA-512 128 hex chars).
          </p>
        )}

        {info && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="gradient-primary text-primary-foreground">{info.type}</Badge>
              <Badge variant={SECURITY_VARIANT[info.security]}>{info.security}</Badge>
              <Badge variant="destructive">Not reversible</Badge>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 py-1.5">
                <dt className="text-muted-foreground">Bit length</dt>
                <dd className="font-medium">{info.bits}-bit</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 py-1.5">
                <dt className="text-muted-foreground">Hex length</dt>
                <dd className="font-medium">{info.hexLength} chars</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 py-1.5">
                <dt className="text-muted-foreground">Reversible</dt>
                <dd className="font-medium">No</dd>
              </div>
              <div className="py-1.5">
                <dt className="mb-1 text-muted-foreground">Common usage</dt>
                <dd className="font-medium">{info.usage}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Generate hashes */}
      <div className="space-y-4 border-t border-border pt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Hash className="h-4 w-4" /> Generate hashes from text
        </h3>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to hash…"
          className="min-h-[90px] resize-y font-mono text-sm"
        />
        <Button
          onClick={generate}
          disabled={genBusy}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {genBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Hash className="mr-1.5 h-4 w-4" />}
          Generate ({TEXT_CREDIT_COST} credits)
        </Button>

        {generated && (
          <div className="space-y-3">
            {generated.map((g) => (
              <div key={g.algo} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <Badge variant="outline">{g.algo}</Badge>
                  <CopyButton value={g.hex} />
                </div>
                <pre className="overflow-auto break-all font-mono text-xs">{g.hex}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
