import { useState } from "react";
import { Image as ImageIcon, ShieldCheck, Unlock, Hash } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tools } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { ImageEnhancer } from "@/components/ImageEnhancer";
import { CryptoDetector } from "@/components/CryptoDetector";
import { Decoder } from "@/components/Decoder";
import { HashAnalyzer } from "@/components/HashAnalyzer";

const tool = tools.find((t) => t.slug === "crypto-image-analyzer")!;

const CryptoImageAnalyzer = () => {
  const { withCredits, upgradeOpen, setUpgradeOpen } = useCreditGuard(tool.slug);
  const [tab, setTab] = useState("image");

  return (
    <Layout>
      <div className="container max-w-4xl py-10 md:py-14">
        <ToolPageHeader title={tool.title} description={tool.description} icon={tool.icon} />

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 md:p-8">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="image" className="gap-1.5">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Image</span>
                <span className="sm:hidden">Image</span>
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Crypto</span>
                <span className="sm:hidden">Crypto</span>
              </TabsTrigger>
              <TabsTrigger value="decoder" className="gap-1.5">
                <Unlock className="h-4 w-4" />
                Decoder
              </TabsTrigger>
              <TabsTrigger value="hash" className="gap-1.5">
                <Hash className="h-4 w-4" />
                Hash
              </TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="mt-6">
              <ImageEnhancer charge={withCredits} />
            </TabsContent>
            <TabsContent value="crypto" className="mt-6">
              <CryptoDetector charge={withCredits} />
            </TabsContent>
            <TabsContent value="decoder" className="mt-6">
              <Decoder charge={withCredits} />
            </TabsContent>
            <TabsContent value="hash" className="mt-6">
              <HashAnalyzer charge={withCredits} />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            🔒 Text analysis, decoding, and image processing all run locally in your browser.
          </p>
        </div>
      </div>
      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default CryptoImageAnalyzer;
