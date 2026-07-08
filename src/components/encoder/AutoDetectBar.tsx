import { Wand2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Detection } from "@/lib/operations";

type Props = {
  detections: Detection[];
  onApply: (d: Detection) => void;
};

export function AutoDetectBar({ detections, onApply }: Props) {
  if (detections.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Wand2 className="h-3.5 w-3.5" /> Auto-detected formats
      </p>
      <div className="flex flex-wrap gap-2">
        {detections.map((d) => (
          <button
            key={d.opId + d.label}
            type="button"
            onClick={() => onApply(d)}
            className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm shadow-sm transition-base hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="font-medium text-foreground">{d.label}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {Math.round(d.confidence * 100)}%
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-primary transition-base group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
