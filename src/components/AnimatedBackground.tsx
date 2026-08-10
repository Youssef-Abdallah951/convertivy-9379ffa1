export function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 animate-gradient-shift bg-[length:200%_200%] gradient-aurora opacity-60" />
      <div className="blob animate-blob-slow left-[-10%] top-[-8%] h-[46vmax] w-[46vmax] bg-secondary/20" />
      <div className="blob animate-blob-medium right-[-12%] top-[20%] h-[38vmax] w-[38vmax] bg-primary/15" />
      <div className="blob animate-blob-fast bottom-[-15%] left-[25%] h-[34vmax] w-[34vmax] bg-brand/15" />
    </div>
  );
}
