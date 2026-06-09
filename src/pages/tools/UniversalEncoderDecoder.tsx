import { useMemo, useState } from "react";
import { ArrowDownUp, Eraser, LockKeyhole, Unlock, Wand2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { tools, CREDIT_COST } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { EncoderInput } from "@/components/EncoderInput";
import { EncoderOutput } from "@/components/EncoderOutput";
import { FormatSelector } from "@/components/FormatSelector";
import {
  FORMATS,
  decode,
  detectFormat,
  encode,
  type FormatKey,
} from "@/lib/encoders";

const tool = tools.find((t) => t.slug === "universal-encoder")!;

const UniversalEncoderDecoder = () => {
  const [format, setFormat] = useState<FormatKey>("base64");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const { withCredits, upgradeOpen, setUpgradeOpen } = useCreditGuard(tool.slug);

  const decodeOnly = useMemo(
    () => FORMATS.find((f) => f.key === format)?.decodeOnly ?? false,
    [format],
  );

  // Run an encode/decode behind the credit guard. Credits are only charged
  // when input is non-empty AND the operation succeeds with output.
  const run = async (mode: "encode" | "decode") => {
    if (input.trim() === "") {
      toast.error("Please enter some text first.");
      return;
    }

    let result = "";
    const ok = await withCredits(async () => {
      // Throwing here prevents any credit deduction.
      result = mode === "encode" ? encode(format, input) : decode(format, input);
      if (result === "" && input.trim() !== "") {
        throw new Error("No output generated.");
      }
    });

    if (ok) {
      setOutput(result);
      toast.success(`${mode === "encode" ? "Encoded" : "Decoded"} successfully`);
    } else if (!ok) {
      // withCredits swallows the thrown error; surface a hint when not a credit issue.
      try {
        mode === "encode" ? encode(format, input) : decode(format, input);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Processing failed.");
      }
    }
  };

  const clearAll = () => {
    setInput("");
    setOutput("");
  };

  const swap = () => {
    setInput(output);
    setOutput(input);
  };

  const autoDetect = () => {
    const detected = detectFormat(input);
    if (detected) {
      setFormat(detected);
      toast.success(`Detected format: ${FORMATS.find((f) => f.key === detected)?.label}`);
    } else {
      toast.error("Couldn't auto-detect the format.");
    }
  };

  return (
    <Layout>
      <div className="container max-w-4xl py-10 md:py-14">
        <ToolPageHeader title={tool.title} description={tool.description} icon={tool.icon} />

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FormatSelector value={format} onChange={setFormat} />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={autoDetect}
              className="w-full sm:w-auto"
            >
              <Wand2 className="mr-1.5 h-4 w-4" />
              Auto-detect
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <EncoderInput value={input} onChange={setInput} />
            <EncoderOutput value={output} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!decodeOnly && (
              <Button
                onClick={() => run("encode")}
                className="flex-1 gradient-primary text-primary-foreground shadow-glow sm:flex-none"
              >
                <LockKeyhole className="mr-1.5 h-4 w-4" />
                Encode ({CREDIT_COST})
              </Button>
            )}
            <Button
              onClick={() => run("decode")}
              variant={decodeOnly ? "default" : "secondary"}
              className={
                decodeOnly
                  ? "flex-1 gradient-primary text-primary-foreground shadow-glow sm:flex-none"
                  : "flex-1 sm:flex-none"
              }
            >
              <Unlock className="mr-1.5 h-4 w-4" />
              Decode ({CREDIT_COST})
            </Button>
            <Button type="button" variant="outline" onClick={swap} className="flex-1 sm:flex-none">
              <ArrowDownUp className="mr-1.5 h-4 w-4" />
              Swap
            </Button>
            <Button type="button" variant="ghost" onClick={clearAll} className="flex-1 sm:flex-none">
              <Eraser className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            🔒 Everything runs locally in your browser. Your text is never sent to any server.
          </p>
        </div>
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default UniversalEncoderDecoder;
