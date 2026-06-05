import { Link } from "react-router-dom";
import { ArrowRight, Coins, Gift } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { CREDIT_COST } from "@/lib/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-smooth hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow transition-base group-hover:scale-110">
          <Icon className="h-6 w-6" />
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          {tool.category}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{tool.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm font-medium text-primary">
          Open tool
          <ArrowRight className="h-4 w-4 transition-base group-hover:translate-x-1" />
        </div>
        {tool.premium ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Coins className="h-3 w-3" />
            {CREDIT_COST} credits
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
            <Gift className="h-3 w-3" />
            Free
          </span>
        )}
      </div>
    </Link>
  );
}
