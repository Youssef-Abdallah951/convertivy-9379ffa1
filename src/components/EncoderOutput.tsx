import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
};

export function EncoderOutput({ value }: Props) {
  const copy = async () => {
    if (!value) {
      toast.error("Nothing to copy yet.");
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  const download = () => {
    if (!value) {
      toast.error("Nothing to download yet.");
      return;
    }
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "result.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded result.txt");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Output
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </div>
      <Textarea
        readOnly
        value={value}
        placeholder="Your result will appear here…"
        className="min-h-[160px] resize-y bg-muted/40 font-mono text-sm sm:text-base"
      />
    </div>
  );
}
