import { History, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type HistoryItem = {
  id: string;
  opId: string;
  opName: string;
  mode: "encode" | "decode" | "run";
  input: string;
  output: string;
  time: number;
};

type Props = {
  items: HistoryItem[];
  onReuse: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

function timeAgo(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function HistoryPanel({ items, onReuse, onDelete, onClear }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" /> Recent operations
        </h3>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-muted-foreground">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Your last 10 operations will appear here.
        </p>
      ) : (
        <ScrollArea className="max-h-64">
          <ul className="space-y-2 pr-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{item.opName}</span>
                    <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent-foreground">
                      {item.mode}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.input.slice(0, 60) || "(empty)"} · {timeAgo(item.time)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onReuse(item)}
                  aria-label="Reuse operation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                  aria-label="Delete from history"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
