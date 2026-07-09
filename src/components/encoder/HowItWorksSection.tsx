import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  MousePointerClick,
  Play,
  Search,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const steps = [
  { icon: Type, text: "Enter or paste your text/file into the Input area." },
  { icon: Search, text: "Search for an operation." },
  { icon: MousePointerClick, text: "Select one or more operations." },
  { icon: SlidersHorizontal, text: "Configure operation options if needed." },
  { icon: Play, text: "Run the operation automatically." },
  { icon: Eye, text: "View the output instantly." },
  { icon: Copy, text: "Copy or download the result." },
];

export function HowItWorksSection() {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="gradient-card border-border shadow-md transition-base hover:shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">How it Works</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get started with the Universal Encoder &amp; Decoder.
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Toggle how it works">
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform duration-300",
                    open && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 transition-base hover:bg-muted"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {idx + 1}
                      </span>
                      <p className="mt-0.5 text-sm leading-snug">{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs font-medium text-muted-foreground">
              Operations are executed from top to bottom.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
