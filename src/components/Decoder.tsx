import { useState } from "react";
import { Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import { decode, type FormatKey } from "@/lib/encoders";
import { caesarShift } from "@/lib/cryptoAnalysis";

const TEXT_CREDIT_COST = 2;

type DecoderFormat = Exclude<FormatKey, "jwt"> | "caesar";

const OPTIONS: { value: DecoderFormat; label: string }[] = [
  { value: "base64", label: "Base64" },
  { value: "url", label: "URL Encoding" },
  { value: "rot13", label: "ROT13" },
  { value: "hex", label: "Hexadecimal" },
  { value: "binary", label: "Binary" },
  { value: "unicode", label: "Unicode" },
  { value: "caesar", label: "Caesar Cipher" },
];

type Props = {
  charge: (action: () => Promise<void>, amount: number) => Promise<boolean>;
};

export function Decoder({ charge }: Props) {
  const [format, setFormat] = useState<DecoderFormat>("base64");
  const [shift, setShift] = useState(3);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const text = input.trim();
    if (!text) {
      toast.error("Please enter something to decode.");
      return;
    }
    // Compute locally first; invalid input never reaches the credit charge.
    let result: string;
    try {
      result =
        format === "caesar" ? caesarShift(text, -shift) : decode(format as FormatKey, text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decode the input.");
      return;
    }
    if (result === "") {
      toast.error("No output produced.");
      return;
    }

    setBusy(true);
    const ok = await charge(async () => {
      /* result already computed */
    }, TEXT_CREDIT_COST);
    setBusy(false);

    if (ok) {
      setOutput(result);
      toast.success("Decoded successfully");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Format
          </label>
          <Select value={format} onValueChange={(v) => setFormat(v as DecoderFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {format === "caesar" && (
          <div className="w-full sm:w-32">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shift
            </label>
            <Input
              type="number"
              min={1}
              max={25}
              value={shift}
              onChange={(e) => setShift(Number(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Encoded input
        </label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your encoded string here…"
          className="min-h-[120px] resize-y font-mono text-sm"
        />
      </div>

      <Button
        onClick={run}
        disabled={busy}
        className="w-full gradient-primary text-primary-foreground shadow-glow sm:w-auto"
      >
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Unlock className="mr-1.5 h-4 w-4" />}
        Decode ({TEXT_CREDIT_COST} credits)
      </Button>

      {output && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Decoded result
            </span>
            <CopyButton value={output} />
          </div>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono text-sm">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
