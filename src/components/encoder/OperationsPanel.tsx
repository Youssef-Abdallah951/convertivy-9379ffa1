import { useMemo, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DISPLAY_CATEGORIES } from "@/lib/encoderCategories";
import {
  CATEGORY_ORDER,
  OPERATIONS,
  OPERATION_MAP,
  type Category,
  type Operation,
} from "@/lib/operations";

type Props = {
  selectedId: string | null;
  onSelect: (op: Operation) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  categoryFilter?: string | null;
};

export function OperationsPanel({ selectedId, onSelect, favorites, onToggleFavorite }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPERATIONS;
    return OPERATIONS.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q) ||
        o.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<Category, Operation[]>();
    for (const op of filtered) {
      const arr = map.get(op.category) ?? [];
      arr.push(op);
      map.set(op.category, arr);
    }
    return map;
  }, [filtered]);

  const favOps = favorites.map((id) => OPERATION_MAP[id]).filter(Boolean);

  const OpRow = ({ op }: { op: Operation }) => {
    const isFav = favorites.includes(op.id);
    return (
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg border border-transparent transition-base",
          selectedId === op.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(op)}
          className="flex-1 truncate px-3 py-2 text-left text-sm"
        >
          {op.name}
        </button>
        <button
          type="button"
          aria-label={isFav ? "Unpin operation" : "Pin operation"}
          onClick={() => onToggleFavorite(op.id)}
          className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-base hover:text-primary focus:opacity-100 group-hover:opacity-100 data-[fav=true]:opacity-100"
          data-fav={isFav}
        >
          <Star className={cn("h-4 w-4", isFav && "fill-primary text-primary")} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search operations…"
          className="pl-9 pr-9"
          aria-label="Search operations"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-4 pb-2">
          {favOps.length > 0 && !query && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Star className="h-3.5 w-3.5 fill-primary" /> Favorites
              </p>
              <div className="space-y-0.5">
                {favOps.map((op) => (
                  <OpRow key={`fav-${op.id}`} op={op} />
                ))}
              </div>
            </div>
          )}

          {CATEGORY_ORDER.map((cat) => {
            const ops = grouped.get(cat);
            if (!ops || ops.length === 0) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat}
                </p>
                <div className="space-y-0.5">
                  {ops.map((op) => (
                    <OpRow key={op.id} op={op} />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              No operations match “{query}”.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
