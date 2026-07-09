import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DISPLAY_CATEGORIES, countOperations } from "@/lib/encoderCategories";

type Props = {
  activeCategory: string | null;
  onSelectCategory: (id: string | null) => void;
};

export function CategoriesSection({ activeCategory, onSelectCategory }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DISPLAY_CATEGORIES;
    return DISPLAY_CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Card className="gradient-card border-border shadow-md transition-base hover:shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Categories</CardTitle>
            <p className="text-sm text-muted-foreground">Pick a category to filter operations.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="pl-9"
              aria-label="Search categories"
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((category) => {
            const Icon = category.icon;
            const count = countOperations(category.id);
            const isActive = activeCategory === category.id;
            const isEmpty = count === 0;
            return (
              <button
                key={category.id}
                type="button"
                disabled={isEmpty}
                onClick={() => onSelectCategory(isActive ? null : category.id)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-base",
                  "hover:border-primary/40 hover:shadow-md",
                  isActive && "border-primary/50 bg-primary/5 shadow-md ring-1 ring-primary/20",
                  isEmpty && "cursor-not-allowed opacity-60 hover:border-border hover:shadow-none",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-base",
                    "group-hover:bg-primary/10 group-hover:text-primary",
                    isActive && "bg-primary/15 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{category.title}</h3>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="h-5 px-1.5 text-xs"
                    >
                      {count}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No categories match your search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
