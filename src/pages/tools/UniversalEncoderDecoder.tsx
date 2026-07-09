import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  Loader2,
  LockKeyhole,
  Unlock,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { tools, CREDIT_COST } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { useLocalStorage, useMediaQuery } from "@/hooks/useLocalStorage";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { OperationsPanel } from "@/components/encoder/OperationsPanel";
import { AutoDetectBar } from "@/components/encoder/AutoDetectBar";
import { HistoryPanel, type HistoryItem } from "@/components/encoder/HistoryPanel";
import { HowItWorksSection } from "@/components/encoder/HowItWorksSection";
import { OfficialCyberChefSection } from "@/components/encoder/OfficialCyberChefSection";
import { CategoriesSection } from "@/components/encoder/CategoriesSection";
import {
  HASH_META,
  OPERATION_MAP,
  autoDetect,
  runOperation,
  type Detection,
  type Operation,
} from "@/lib/operations";

const tool = tools.find((t) => t.slug === "universal-encoder")!;
const ACCEPTED_FILES = ".txt,.json,.csv,.xml,.md,.log,text/*,application/json,application/xml";

const UniversalEncoderDecoder = () => {
  const { withCredits, upgradeOpen, setUpgradeOpen } = useCreditGuard(tool.slug);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [selectedId, setSelectedId] = useState<string>("base64");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [params, setParams] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [favorites, setFavorites] = useLocalStorage<string[]>("ued.favorites", []);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>("ued.history", []);

  const op: Operation | undefined = OPERATION_MAP[selectedId];

  // Initialise params to defaults when an op with params is selected.
  useEffect(() => {
    if (op?.params) {
      setParams((prev) => {
        const next = { ...prev };
        for (const p of op.params!) if (next[p.key] === undefined) next[p.key] = p.default;
        return next;
      });
    }
  }, [op]);

  const detections = useMemo<Detection[]>(() => autoDetect(input), [input]);
  const isHash = selectedId.startsWith("hash-");
  const hashKey = isHash ? op?.name ?? "" : "";

  const selectOp = (o: Operation) => {
    setSelectedId(o.id);
    if (o.params) {
      const init: Record<string, string> = {};
      for (const p of o.params) init[p.key] = p.default;
      setParams(init);
    }
    if (!o.reversible) setMode("encode");
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const pushHistory = (item: Omit<HistoryItem, "id" | "time">) => {
    setHistory((prev) =>
      [{ ...item, id: crypto.randomUUID(), time: Date.now() }, ...prev].slice(0, 10),
    );
  };

  const process = async (runMode: "encode" | "decode") => {
    if (!op) return;
    if (input === "") {
      toast.error("Please enter some text first.");
      return;
    }

    // Compute first — invalid input never reaches the credit charge.
    setBusy(true);
    let result: string;
    try {
      // Yield a frame so the loading indicator paints for heavy inputs.
      await new Promise((r) => setTimeout(r, input.length > 20000 ? 20 : 0));
      result = runOperation(op, input, runMode, params);
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Operation failed.");
      return;
    }
    if (result === "") {
      setBusy(false);
      toast.error("Operation produced no output.");
      return;
    }

    // Charge exactly CREDIT_COST only after a confirmed-successful operation.
    const charged = await withCredits(async () => {
      /* result already computed locally */
    });
    setBusy(false);
    if (!charged) return;

    setOutput(result);
    pushHistory({
      opId: op.id,
      opName: op.name,
      mode: op.reversible ? runMode : "run",
      input,
      output: result,
    });
    toast.success(`${op.name} — done`);
  };

  const applyDetection = (d: Detection) => {
    const target = OPERATION_MAP[d.opId];
    if (!target) return;
    setSelectedId(d.opId);
    setMode("decode");
    toast.info(`Selected ${target.name}. Press Decode to run.`);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setInput(String(reader.result ?? ""));
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const paste = async () => {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      toast.error("Clipboard access denied.");
    }
  };

  const copyOutput = async () => {
    if (!output) return toast.error("Nothing to copy.");
    await navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  const download = () => {
    if (!output) return toast.error("Nothing to download.");
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${op?.id ?? "output"}-result.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Downloaded result");
  };

  const swap = () => {
    setInput(output);
    setOutput(input);
  };

  const clearAll = () => {
    setInput("");
    setOutput("");
  };

  const reuse = (item: HistoryItem) => {
    setSelectedId(item.opId);
    if (item.mode !== "run") setMode(item.mode);
    setInput(item.input);
    setOutput(item.output);
    toast.success("Restored from history");
  };

  // ---------- Sub-renders ----------
  const operationsNode = (
    <OperationsPanel
      selectedId={selectedId}
      onSelect={selectOp}
      favorites={favorites}
      onToggleFavorite={toggleFavorite}
    />
  );

  const runButtons = (
    <div className="flex flex-wrap gap-2">
      {op?.reversible ? (
        <>
          <Button
            onClick={() => process("encode")}
            disabled={busy}
            className="flex-1 gradient-primary text-primary-foreground shadow-glow sm:flex-none"
          >
            {busy && mode === "encode" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <LockKeyhole className="mr-1.5 h-4 w-4" />
            )}
            Encode ({CREDIT_COST})
          </Button>
          <Button
            onClick={() => process("decode")}
            disabled={busy}
            variant="secondary"
            className="flex-1 sm:flex-none"
          >
            <Unlock className="mr-1.5 h-4 w-4" />
            Decode ({CREDIT_COST})
          </Button>
        </>
      ) : (
        <Button
          onClick={() => process("encode")}
          disabled={busy}
          className="flex-1 gradient-primary text-primary-foreground shadow-glow sm:flex-none"
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
          {op?.actionLabel ?? "Run"} ({CREDIT_COST})
        </Button>
      )}
    </div>
  );

  const configNode = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="px-2.5 py-1 text-xs">
          {op?.category}
        </Badge>
        <h2 className="text-lg font-semibold tracking-tight">{op?.name}</h2>
      </div>
      {op?.params && op.params.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {op.params.map((p) => (
            <div key={p.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`param-${p.key}`}>
                {p.label}
              </label>
              <Input
                id={`param-${p.key}`}
                type={p.type === "number" ? "number" : "text"}
                value={params[p.key] ?? p.default}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                className="h-9 w-40"
              />
            </div>
          ))}
        </div>
      )}
      <AutoDetectBar detections={detections} onApply={applyDetection} />
    </div>
  );

  const inputNode = (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Input</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button variant="outline" size="sm" onClick={paste} className="h-8">
            <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-8">
            <Upload className="mr-1 h-3.5 w-3.5" /> Upload
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8">
            <Eraser className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative flex-1"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type, paste, or drop a file here…"
          spellCheck={false}
          className="h-full min-h-[220px] resize-none font-mono text-sm"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
            Drop file to load
          </div>
        )}
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {Array.from(input).length.toLocaleString()} characters
      </p>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );

  const outputNode = (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Output</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button variant="outline" size="sm" onClick={copyOutput} className="h-8">
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={download} className="h-8">
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="sm" onClick={swap} className="h-8">
            <ArrowDownUp className="mr-1 h-3.5 w-3.5" /> Swap
          </Button>
        </div>
      </div>
      <Textarea
        value={output}
        readOnly
        placeholder="Result appears here…"
        spellCheck={false}
        className="h-full min-h-[220px] resize-none bg-muted/40 font-mono text-sm"
      />
      {isHash && HASH_META[hashKey] && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Algorithm: {hashKey}</Badge>
          <Badge variant="secondary">Length: {HASH_META[hashKey].bits} bits</Badge>
          <Badge
            variant="secondary"
            className={
              HASH_META[hashKey].security === "Strong"
                ? "bg-success/15 text-success"
                : HASH_META[hashKey].security === "Weak"
                  ? "bg-accent text-accent-foreground"
                  : "bg-destructive/15 text-destructive"
            }
          >
            Security: {HASH_META[hashKey].security}
          </Badge>
        </div>
      )}
    </div>
  );

  const workspace = (
    <div className="space-y-4">
      {configNode}
      {runButtons}
      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" className="min-h-[340px] rounded-xl">
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="pr-2">{inputNode}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="pl-2">{outputNode}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="space-y-4">
          {inputNode}
          {outputNode}
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="container max-w-7xl py-8 md:py-12">
        <ToolPageHeader title={tool.title} description={tool.description} icon={tool.icon} />

        {isDesktop ? (
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-[600px] rounded-2xl border border-border bg-card p-2 shadow-sm"
          >
            <ResizablePanel defaultSize={26} minSize={18} maxSize={40}>
              <div className="h-full p-3">{operationsNode}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={74} minSize={45}>
              <div className="h-full p-3">{workspace}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="max-h-[320px]">{operationsNode}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">{workspace}</div>
          </div>
        )}

        <div className="mt-4">
          <HistoryPanel
            items={history}
            onReuse={reuse}
            onDelete={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
            onClear={() => setHistory([])}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          🔒 Everything runs locally in your browser. Your data is never sent to any server.
        </p>
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default UniversalEncoderDecoder;
