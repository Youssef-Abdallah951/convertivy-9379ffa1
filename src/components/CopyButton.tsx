import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  label?: string;
  size?: "sm" | "default";
  className?: string;
};

export function CopyButton({ value, label = "Copy", size = "sm", className }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) {
      toast.error("Nothing to copy.");
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button type="button" variant="outline" size={size} onClick={copy} className={cn(className)}>
      {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
