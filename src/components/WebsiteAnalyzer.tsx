import { Globe, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CREDIT_COST } from "@/lib/tools";

type Props = {
  url: string;
  onChange: (url: string) => void;
  onAnalyze: () => void;
  loading?: boolean;
};

export function WebsiteAnalyzer({ url, onChange, onAnalyze, loading }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAnalyze();
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          className="pl-9"
          disabled={loading}
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="gradient-primary text-primary-foreground shadow-glow sm:w-auto"
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-1.5 h-4 w-4" />
        )}
        Analyze ({CREDIT_COST})
      </Button>
    </form>
  );
}
