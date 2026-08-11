import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Coins } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ToolCard } from "@/components/ToolCard";
import { Input } from "@/components/ui/input";
import { tools } from "@/lib/tools";
import { useAuth } from "@/hooks/useAuth";
import { useUserCredits } from "@/hooks/useUserCredits";
import { motion, riseItem, staggerContainer, Reveal, RevealGroup } from "@/components/motion/Reveal";
import { Seo } from "@/components/Seo";

const Index = () => {
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { credits } = useUserCredits();


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  return (
    <Layout>
      <Seo
        title="Convertify - All-in-One Digital Tools"
        description="Convertify is an all-in-one digital tools platform for file conversion, QR codes, developer utilities, encoding, formatting, productivity tools, and more."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Convertify",
            alternateName: "Convertify Digital Tools",
            url: "https://convertivy.lovable.app/",
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Convertify",
            alternateName: "Convertify Digital Tools",
            url: "https://convertivy.lovable.app/",
            description:
              "Convertify is an all-in-one digital tools platform for file conversion, QR codes, developer utilities, encoding, formatting and productivity tools.",
          },
        ]}
      />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 gradient-hero">
        <div className="container py-16 md:py-24">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.span
              variants={riseItem}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5 animate-float text-primary" />
              Free, fast & privacy-friendly
            </motion.span>
            <motion.h1 variants={riseItem} className="mt-5 text-4xl font-extrabold tracking-tight md:text-6xl">
              Convertify -{" "}
              <span className="text-gradient">All-in-One Digital Tools</span>
            </motion.h1>
            <motion.p variants={riseItem} className="mt-3 text-base font-semibold text-muted-foreground md:text-lg">
              All-in-One Digital Tools Platform
            </motion.p>
            <motion.p
              variants={riseItem}
              className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg"
            >
              Convertify brings file conversion, QR codes, developer utilities, encoding, formatting and
              productivity tools together in one place — no signup required.
            </motion.p>


            <motion.div variants={riseItem} className="mx-auto mt-8 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tools — try 'json' or 'word'..."
                  className="h-14 rounded-2xl border-border bg-card/90 pl-12 pr-4 text-base shadow-md backdrop-blur transition-smooth focus-visible:ring-primary/40 focus-visible:shadow-glow"
                  aria-label="Search tools"
                />
              </div>
            </motion.div>

            {user && credits && (
              <motion.div variants={riseItem} className="mx-auto mt-5 flex max-w-xl items-center justify-center">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-smooth hover:scale-105 hover:shadow-glow"
                >
                  <Coins className="h-4 w-4 text-primary" />
                  {credits.isUnlimited ? (
                    <span>Unlimited credits</span>
                  ) : (
                    <span>
                      <span className="font-semibold text-foreground">{credits.credits}</span> credits
                      remaining
                    </span>
                  )}
                </Link>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="container py-12 md:py-16">
        <Reveal className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {query ? "Results" : "Browse all tools"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "tool" : "tools"} available
            </p>
          </div>
        </Reveal>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              No tools match <span className="font-semibold text-foreground">"{query}"</span>. Try a different search.
            </p>
          </div>
        ) : (
          <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </RevealGroup>
        )}
      </section>
    </Layout>
  );
};

export default Index;
