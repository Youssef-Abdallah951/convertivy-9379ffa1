import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type Swatch, readableText, rgbString } from "@/lib/colors";

export function ColorCard({ swatch }: { swatch: Swatch }) {
  const fg = readableText(swatch.rgb);
  const rgbText = rgbString(swatch.rgb);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  };

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-base hover:-translate-y-1 hover:shadow-lg">
      <div
        className="flex h-28 items-end justify-between p-3"
        style={{ backgroundColor: swatch.hex }}
      >
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${fg}22`, color: fg }}
        >
          {swatch.label}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => copy(swatch.hex, "HEX")}
          className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm font-mono transition-base hover:bg-muted"
        >
          <span>{swatch.hex}</span>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => copy(rgbText, "RGB")}
          className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground transition-base hover:bg-muted"
        >
          <span>{rgbText}</span>
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
