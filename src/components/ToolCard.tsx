import { Link } from "react-router-dom";
import { ArrowRight, Coins, Gift } from "lucide-react";
import { motion } from "framer-motion";
import type { Tool } from "@/lib/tools";
import { CREDIT_COST } from "@/lib/tools";
import { riseItem } from "@/components/motion/Reveal";

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <motion.div variants={riseItem} className="h-full">
      <motion.div
        whileHover={{ y: -8 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="group h-full"
      >
        <Link
          to={`/tools/${tool.slug}`}
          className="relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur-sm transition-smooth group-hover:border-primary/50 group-hover:shadow-glow"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow transition-smooth group-hover:-rotate-6 group-hover:scale-110">
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
          <div className="mt-auto flex items-center justify-between">
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
      </motion.div>
    </motion.div>
  );
}
