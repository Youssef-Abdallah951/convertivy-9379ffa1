import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.08),transparent)] after:bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
