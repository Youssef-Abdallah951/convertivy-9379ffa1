import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OfficialCyberChefSection() {
  return (
    <Card className="gradient-card border-border shadow-md transition-base hover:shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight">Official CyberChef</CardTitle>
        <p className="text-sm text-muted-foreground">
          Open the official CyberChef website to access the complete collection of operations and
          advanced data analysis tools.
        </p>
      </CardHeader>
      <CardContent>
        <Button
          asChild
          className="gradient-primary text-primary-foreground shadow-glow h-12 px-6 text-base"
        >
          <a
            href="https://gchq.github.io/CyberChef/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open CyberChef
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
