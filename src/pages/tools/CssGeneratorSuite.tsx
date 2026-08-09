import { useMemo, useState } from "react";
import {
  Blend,
  Box,
  Copy,
  Download,
  Layers,
  MousePointerClick,
  Paintbrush,
  RotateCcw,
  Scissors,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { ToolPageHeader } from "@/components/ToolPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tools, CREDIT_COST } from "@/lib/tools";
import { useCreditGuard } from "@/hooks/useCreditGuard";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";

const tool = tools.find((t) => t.slug === "css-generator-suite")!;

/* ---------------------------------- utils --------------------------------- */

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
}

/* --------------------------- shared small pieces -------------------------- */

function ControlRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {value !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ControlRow label={label} value={value.toUpperCase()}>
      <div className="flex w-full min-w-0 items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-card p-1 sm:w-14"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 font-mono"
        />
      </div>
    </ControlRow>
  );
}

/** Very small CSS token highlighter — no external deps. */
function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <pre className="max-h-80 w-full max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed sm:p-4 sm:text-sm">
      <code className="block min-w-0 whitespace-pre font-mono">
        {lines.map((line, i) => {
          const match = line.match(/^(\s*)([-a-zA-Z][\w-]*)(\s*:\s*)(.*)$/);
          if (!match) {
            return (
              <div key={i} className="text-foreground/80">
                {line || "\u00A0"}
              </div>
            );
          }
          const [, indent, prop, colon, val] = match;
          return (
            <div key={i}>
              {indent}
              <span className="text-primary">{prop}</span>
              <span className="text-muted-foreground">{colon}</span>
              <span className="text-foreground">{val}</span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}

/* ------------------------------ generators -------------------------------- */

type Stop = { color: string; pos: number };

const DEFAULTS = {
  gradient: {
    type: "linear" as "linear" | "radial",
    angle: 135,
    shape: "circle" as "circle" | "ellipse",
    stops: [
      { color: "#2563eb", pos: 0 },
      { color: "#7c3aed", pos: 100 },
    ] as Stop[],
  },
  shadow: {
    x: 0,
    y: 12,
    blur: 30,
    spread: -6,
    color: "#2563eb",
    opacity: 0.35,
    inset: false,
  },
  glass: {
    color: "#ffffff",
    opacity: 0.15,
    blur: 14,
    borderOpacity: 0.3,
    radius: 20,
    shadow: 0.25,
  },
  radius: {
    tl: 24,
    tr: 24,
    br: 24,
    bl: 24,
    linked: true,
  },
  button: {
    bg: "#2563eb",
    text: "#ffffff",
    borderWidth: 0,
    borderColor: "#1e40af",
    radius: 12,
    padX: 24,
    padY: 12,
    fontSize: 16,
    hoverBg: "#1d4ed8",
    shadow: 0.3,
    label: "Click me",
  },
  clip: {
    kind: "polygon" as "polygon" | "circle" | "ellipse",
    points: "50% 0%, 100% 50%, 50% 100%, 0% 50%",
    circle: { r: 50, x: 50, y: 50 },
    ellipse: { rx: 50, ry: 35, x: 50, y: 50 },
  },
};

const CssGeneratorSuite = () => {
  const [tab, setTab] = useState("gradient");

  const [gradient, setGradient] = useState(structuredClone(DEFAULTS.gradient));
  const [shadow, setShadow] = useState({ ...DEFAULTS.shadow });
  const [glass, setGlass] = useState({ ...DEFAULTS.glass });
  const [radius, setRadius] = useState({ ...DEFAULTS.radius });
  const [button, setButton] = useState({ ...DEFAULTS.button });
  const [clip, setClip] = useState(structuredClone(DEFAULTS.clip));

  const { withCredits, upgradeOpen, setUpgradeOpen, credits } = useCreditGuard(tool.slug);

  /* --------------------------- computed CSS values -------------------------- */

  const gradientValue = useMemo(() => {
    const stops = [...gradient.stops]
      .sort((a, b) => a.pos - b.pos)
      .map((s) => `${s.color} ${s.pos}%`)
      .join(", ");
    return gradient.type === "linear"
      ? `linear-gradient(${gradient.angle}deg, ${stops})`
      : `radial-gradient(${gradient.shape} at 50% 50%, ${stops})`;
  }, [gradient]);

  const shadowValue = useMemo(
    () =>
      `${shadow.inset ? "inset " : ""}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${
        shadow.spread
      }px ${rgba(shadow.color, shadow.opacity)}`,
    [shadow],
  );

  const radiusValue = useMemo(
    () =>
      radius.linked
        ? `${radius.tl}px`
        : `${radius.tl}px ${radius.tr}px ${radius.br}px ${radius.bl}px`,
    [radius],
  );

  const clipValue = useMemo(() => {
    if (clip.kind === "polygon") return `polygon(${clip.points})`;
    if (clip.kind === "circle")
      return `circle(${clip.circle.r}% at ${clip.circle.x}% ${clip.circle.y}%)`;
    return `ellipse(${clip.ellipse.rx}% ${clip.ellipse.ry}% at ${clip.ellipse.x}% ${clip.ellipse.y}%)`;
  }, [clip]);

  /* ------------------------------ code output ------------------------------ */

  const code = useMemo(() => {
    switch (tab) {
      case "gradient":
        return `.gradient {\n  background: ${gradientValue};\n}`;
      case "shadow":
        return `.shadow {\n  box-shadow: ${shadowValue};\n}`;
      case "glass":
        return [
          ".glass {",
          `  background: ${rgba(glass.color, glass.opacity)};`,
          `  backdrop-filter: blur(${glass.blur}px);`,
          `  -webkit-backdrop-filter: blur(${glass.blur}px);`,
          `  border: 1px solid ${rgba(glass.color, glass.borderOpacity)};`,
          `  border-radius: ${glass.radius}px;`,
          `  box-shadow: 0 8px 32px rgba(0, 0, 0, ${glass.shadow.toFixed(2)});`,
          "}",
        ].join("\n");
      case "radius":
        return `.rounded {\n  border-radius: ${radiusValue};\n}`;
      case "button":
        return [
          `<button class="btn">${button.label}</button>`,
          "",
          ".btn {",
          `  background: ${button.bg};`,
          `  color: ${button.text};`,
          `  border: ${button.borderWidth}px solid ${button.borderColor};`,
          `  border-radius: ${button.radius}px;`,
          `  padding: ${button.padY}px ${button.padX}px;`,
          `  font-size: ${button.fontSize}px;`,
          "  font-weight: 600;",
          "  cursor: pointer;",
          `  box-shadow: 0 8px 20px ${rgba(button.bg, button.shadow)};`,
          "  transition: all 0.25s ease;",
          "}",
          "",
          ".btn:hover {",
          `  background: ${button.hoverBg};`,
          "  transform: translateY(-2px);",
          `  box-shadow: 0 12px 26px ${rgba(button.bg, Math.min(1, button.shadow + 0.1))};`,
          "}",
        ].join("\n");
      case "clip":
        return `.clipped {\n  clip-path: ${clipValue};\n}`;
      default:
        return "";
    }
  }, [tab, gradientValue, shadowValue, glass, radiusValue, button, clipValue]);

  /* -------------------------------- actions -------------------------------- */

  const guardBalance = () => {
    if (credits && !credits.isUnlimited && credits.credits < CREDIT_COST) {
      toast.error("Not enough credits. Please recharge your balance.");
      setUpgradeOpen(true);
      return false;
    }
    return true;
  };

  const copyCss = async () => {
    if (!code.trim()) {
      toast.error("Nothing to copy yet.");
      return;
    }
    if (!guardBalance()) return;
    await withCredits(async () => {
      await navigator.clipboard.writeText(code);
      toast.success("CSS copied to clipboard");
    });
  };

  const downloadCss = async () => {
    if (!code.trim()) {
      toast.error("Nothing to download yet.");
      return;
    }
    if (!guardBalance()) return;
    await withCredits(async () => {
      const blob = new Blob([code], { type: "text/css;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `convertify-${tab}.css`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSS file downloaded");
    });
  };

  const reset = () => {
    switch (tab) {
      case "gradient":
        setGradient(structuredClone(DEFAULTS.gradient));
        break;
      case "shadow":
        setShadow({ ...DEFAULTS.shadow });
        break;
      case "glass":
        setGlass({ ...DEFAULTS.glass });
        break;
      case "radius":
        setRadius({ ...DEFAULTS.radius });
        break;
      case "button":
        setButton({ ...DEFAULTS.button });
        break;
      case "clip":
        setClip(structuredClone(DEFAULTS.clip));
        break;
    }
    toast.success("Reset to defaults");
  };

  /* -------------------------------- preview -------------------------------- */

  const preview = () => {
    if (tab === "gradient")
      return <div className="h-full w-full" style={{ background: gradientValue }} />;
    if (tab === "shadow")
      return (
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
          <div
            className="h-24 w-32 max-w-full rounded-2xl bg-card sm:h-32 sm:w-56"
            style={{ boxShadow: shadowValue }}
          />
        </div>
      );
    if (tab === "glass")
      return (
        <div
          className="flex h-full w-full items-center justify-center p-4 sm:p-8"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed 50%, #06b6d4)" }}
        >
          <div
            className="flex h-28 w-full max-w-[16rem] items-center justify-center text-sm font-semibold text-white sm:h-36 sm:max-w-xs"
            style={{
              background: rgba(glass.color, glass.opacity),
              backdropFilter: `blur(${glass.blur}px)`,
              WebkitBackdropFilter: `blur(${glass.blur}px)`,
              border: `1px solid ${rgba(glass.color, glass.borderOpacity)}`,
              borderRadius: `${glass.radius}px`,
              boxShadow: `0 8px 32px rgba(0,0,0,${glass.shadow})`,
            }}
          >
            Glass card
          </div>
        </div>
      );
    if (tab === "radius")
      return (
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
          <div
            className="h-28 w-40 max-w-full gradient-primary sm:h-36 sm:w-56"
            style={{ borderRadius: radiusValue }}
          />
        </div>
      );
    if (tab === "button")
      return (
        <div className="flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8">
          <button
            type="button"
            className="css-suite-btn max-w-full break-words font-semibold"
            style={{
              background: button.bg,
              color: button.text,
              border: `${button.borderWidth}px solid ${button.borderColor}`,
              borderRadius: `${button.radius}px`,
              padding: `${button.padY}px ${button.padX}px`,
              fontSize: `${button.fontSize}px`,
              boxShadow: `0 8px 20px ${rgba(button.bg, button.shadow)}`,
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = button.hoverBg;
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = button.bg;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {button.label || "Button"}
          </button>
        </div>
      );
    return (
      <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
        <div
          className="h-36 w-36 max-w-full gradient-primary sm:h-52 sm:w-52"
          style={{ clipPath: clipValue }}
        />
      </div>
    );
  };

  const tabItems = [
    { id: "gradient", label: "Gradient", icon: Blend },
    { id: "shadow", label: "Box Shadow", icon: Box },
    { id: "glass", label: "Glassmorphism", icon: Layers },
    { id: "radius", label: "Border Radius", icon: Square },
    { id: "button", label: "Button", icon: MousePointerClick },
    { id: "clip", label: "Clip Path", icon: Scissors },
  ];

  return (
    <Layout>
      <div className="container max-w-6xl py-8 md:py-12">
        <ToolPageHeader title={tool.title} description={tool.description} icon={Paintbrush} />

        <Tabs value={tab} onValueChange={setTab} className="animate-fade-in">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {tabItems.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex items-center gap-1.5 rounded-xl py-2 text-xs sm:text-sm"
              >
                <t.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Controls */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-base sm:p-6">
              <TabsContent value="gradient" className="mt-0 space-y-5">
                <ControlRow label="Type">
                  <Select
                    value={gradient.type}
                    onValueChange={(v: "linear" | "radial") =>
                      setGradient({ ...gradient, type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="radial">Radial</SelectItem>
                    </SelectContent>
                  </Select>
                </ControlRow>

                {gradient.type === "linear" ? (
                  <ControlRow label="Angle" value={`${gradient.angle}deg`}>
                    <Slider
                      value={[gradient.angle]}
                      min={0}
                      max={360}
                      step={1}
                      onValueChange={([v]) => setGradient({ ...gradient, angle: v })}
                    />
                  </ControlRow>
                ) : (
                  <ControlRow label="Shape">
                    <Select
                      value={gradient.shape}
                      onValueChange={(v: "circle" | "ellipse") =>
                        setGradient({ ...gradient, shape: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="ellipse">Ellipse</SelectItem>
                      </SelectContent>
                    </Select>
                  </ControlRow>
                )}

                <div className="space-y-4">
                  {gradient.stops.map((stop, i) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Stop {i + 1}</Label>
                        {gradient.stops.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setGradient({
                                ...gradient,
                                stops: gradient.stops.filter((_, idx) => idx !== i),
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 space-y-3">
                        <ColorField
                          label="Color"
                          value={stop.color}
                          onChange={(v) =>
                            setGradient({
                              ...gradient,
                              stops: gradient.stops.map((s, idx) =>
                                idx === i ? { ...s, color: v } : s,
                              ),
                            })
                          }
                        />
                        <ControlRow label="Position" value={`${stop.pos}%`}>
                          <Slider
                            value={[stop.pos]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={([v]) =>
                              setGradient({
                                ...gradient,
                                stops: gradient.stops.map((s, idx) =>
                                  idx === i ? { ...s, pos: v } : s,
                                ),
                              })
                            }
                          />
                        </ControlRow>
                      </div>
                    </div>
                  ))}
                  {gradient.stops.length < 6 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setGradient({
                          ...gradient,
                          stops: [...gradient.stops, { color: "#06b6d4", pos: 50 }],
                        })
                      }
                    >
                      Add color stop
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="shadow" className="mt-0 space-y-5">
                <ControlRow label="X offset" value={`${shadow.x}px`}>
                  <Slider
                    value={[shadow.x]}
                    min={-80}
                    max={80}
                    onValueChange={([v]) => setShadow({ ...shadow, x: v })}
                  />
                </ControlRow>
                <ControlRow label="Y offset" value={`${shadow.y}px`}>
                  <Slider
                    value={[shadow.y]}
                    min={-80}
                    max={80}
                    onValueChange={([v]) => setShadow({ ...shadow, y: v })}
                  />
                </ControlRow>
                <ControlRow label="Blur" value={`${shadow.blur}px`}>
                  <Slider
                    value={[shadow.blur]}
                    min={0}
                    max={120}
                    onValueChange={([v]) => setShadow({ ...shadow, blur: v })}
                  />
                </ControlRow>
                <ControlRow label="Spread" value={`${shadow.spread}px`}>
                  <Slider
                    value={[shadow.spread]}
                    min={-50}
                    max={50}
                    onValueChange={([v]) => setShadow({ ...shadow, spread: v })}
                  />
                </ControlRow>
                <ControlRow label="Opacity" value={shadow.opacity.toFixed(2)}>
                  <Slider
                    value={[shadow.opacity * 100]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => setShadow({ ...shadow, opacity: v / 100 })}
                  />
                </ControlRow>
                <ColorField
                  label="Shadow color"
                  value={shadow.color}
                  onChange={(v) => setShadow({ ...shadow, color: v })}
                />
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <Label htmlFor="inset" className="text-sm font-medium">
                    Inset shadow
                  </Label>
                  <Switch
                    id="inset"
                    checked={shadow.inset}
                    onCheckedChange={(v) => setShadow({ ...shadow, inset: v })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="glass" className="mt-0 space-y-5">
                <ColorField
                  label="Background color"
                  value={glass.color}
                  onChange={(v) => setGlass({ ...glass, color: v })}
                />
                <ControlRow label="Background opacity" value={glass.opacity.toFixed(2)}>
                  <Slider
                    value={[glass.opacity * 100]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => setGlass({ ...glass, opacity: v / 100 })}
                  />
                </ControlRow>
                <ControlRow label="Blur" value={`${glass.blur}px`}>
                  <Slider
                    value={[glass.blur]}
                    min={0}
                    max={40}
                    onValueChange={([v]) => setGlass({ ...glass, blur: v })}
                  />
                </ControlRow>
                <ControlRow label="Border opacity" value={glass.borderOpacity.toFixed(2)}>
                  <Slider
                    value={[glass.borderOpacity * 100]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => setGlass({ ...glass, borderOpacity: v / 100 })}
                  />
                </ControlRow>
                <ControlRow label="Border radius" value={`${glass.radius}px`}>
                  <Slider
                    value={[glass.radius]}
                    min={0}
                    max={60}
                    onValueChange={([v]) => setGlass({ ...glass, radius: v })}
                  />
                </ControlRow>
                <ControlRow label="Shadow strength" value={glass.shadow.toFixed(2)}>
                  <Slider
                    value={[glass.shadow * 100]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => setGlass({ ...glass, shadow: v / 100 })}
                  />
                </ControlRow>
              </TabsContent>

              <TabsContent value="radius" className="mt-0 space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <Label htmlFor="linked" className="text-sm font-medium">
                    Link all corners
                  </Label>
                  <Switch
                    id="linked"
                    checked={radius.linked}
                    onCheckedChange={(v) => setRadius({ ...radius, linked: v })}
                  />
                </div>
                {radius.linked ? (
                  <ControlRow label="All corners" value={`${radius.tl}px`}>
                    <Slider
                      value={[radius.tl]}
                      min={0}
                      max={150}
                      onValueChange={([v]) =>
                        setRadius({ ...radius, tl: v, tr: v, br: v, bl: v })
                      }
                    />
                  </ControlRow>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {(
                      [
                        ["tl", "Top left"],
                        ["tr", "Top right"],
                        ["br", "Bottom right"],
                        ["bl", "Bottom left"],
                      ] as const
                    ).map(([key, label]) => (
                      <ControlRow key={key} label={label} value={`${radius[key]}px`}>
                        <Slider
                          value={[radius[key]]}
                          min={0}
                          max={150}
                          onValueChange={([v]) => setRadius({ ...radius, [key]: v })}
                        />
                      </ControlRow>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="button" className="mt-0 space-y-5">
                <ControlRow label="Label">
                  <Input
                    value={button.label}
                    onChange={(e) => setButton({ ...button, label: e.target.value })}
                    placeholder="Click me"
                  />
                </ControlRow>
                <ColorField
                  label="Background"
                  value={button.bg}
                  onChange={(v) => setButton({ ...button, bg: v })}
                />
                <ColorField
                  label="Hover background"
                  value={button.hoverBg}
                  onChange={(v) => setButton({ ...button, hoverBg: v })}
                />
                <ColorField
                  label="Text color"
                  value={button.text}
                  onChange={(v) => setButton({ ...button, text: v })}
                />
                <ColorField
                  label="Border color"
                  value={button.borderColor}
                  onChange={(v) => setButton({ ...button, borderColor: v })}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <ControlRow label="Border width" value={`${button.borderWidth}px`}>
                    <Slider
                      value={[button.borderWidth]}
                      min={0}
                      max={10}
                      onValueChange={([v]) => setButton({ ...button, borderWidth: v })}
                    />
                  </ControlRow>
                  <ControlRow label="Border radius" value={`${button.radius}px`}>
                    <Slider
                      value={[button.radius]}
                      min={0}
                      max={50}
                      onValueChange={([v]) => setButton({ ...button, radius: v })}
                    />
                  </ControlRow>
                  <ControlRow label="Padding X" value={`${button.padX}px`}>
                    <Slider
                      value={[button.padX]}
                      min={4}
                      max={64}
                      onValueChange={([v]) => setButton({ ...button, padX: v })}
                    />
                  </ControlRow>
                  <ControlRow label="Padding Y" value={`${button.padY}px`}>
                    <Slider
                      value={[button.padY]}
                      min={2}
                      max={40}
                      onValueChange={([v]) => setButton({ ...button, padY: v })}
                    />
                  </ControlRow>
                  <ControlRow label="Font size" value={`${button.fontSize}px`}>
                    <Slider
                      value={[button.fontSize]}
                      min={10}
                      max={32}
                      onValueChange={([v]) => setButton({ ...button, fontSize: v })}
                    />
                  </ControlRow>
                  <ControlRow label="Shadow strength" value={button.shadow.toFixed(2)}>
                    <Slider
                      value={[button.shadow * 100]}
                      min={0}
                      max={100}
                      onValueChange={([v]) => setButton({ ...button, shadow: v / 100 })}
                    />
                  </ControlRow>
                </div>
              </TabsContent>

              <TabsContent value="clip" className="mt-0 space-y-5">
                <ControlRow label="Shape">
                  <Select
                    value={clip.kind}
                    onValueChange={(v: "polygon" | "circle" | "ellipse") =>
                      setClip({ ...clip, kind: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polygon">Polygon</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="ellipse">Ellipse</SelectItem>
                    </SelectContent>
                  </Select>
                </ControlRow>

                {clip.kind === "polygon" && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: "Diamond", p: "50% 0%, 100% 50%, 50% 100%, 0% 50%" },
                        { name: "Triangle", p: "50% 0%, 100% 100%, 0% 100%" },
                        { name: "Hexagon", p: "25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%" },
                        { name: "Arrow", p: "0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%" },
                        { name: "Star", p: "50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%" },
                      ].map((preset) => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          size="sm"
                          onClick={() => setClip({ ...clip, points: preset.p })}
                        >
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                    <ControlRow label="Custom points">
                      <Input
                        value={clip.points}
                        onChange={(e) => setClip({ ...clip, points: e.target.value })}
                        className="font-mono text-xs"
                        placeholder="50% 0%, 100% 100%, 0% 100%"
                      />
                    </ControlRow>
                  </>
                )}

                {clip.kind === "circle" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ControlRow label="Radius" value={`${clip.circle.r}%`}>
                      <Slider
                        value={[clip.circle.r]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, circle: { ...clip.circle, r: v } })
                        }
                      />
                    </ControlRow>
                    <ControlRow label="Center X" value={`${clip.circle.x}%`}>
                      <Slider
                        value={[clip.circle.x]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, circle: { ...clip.circle, x: v } })
                        }
                      />
                    </ControlRow>
                    <ControlRow label="Center Y" value={`${clip.circle.y}%`}>
                      <Slider
                        value={[clip.circle.y]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, circle: { ...clip.circle, y: v } })
                        }
                      />
                    </ControlRow>
                  </div>
                )}

                {clip.kind === "ellipse" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ControlRow label="Radius X" value={`${clip.ellipse.rx}%`}>
                      <Slider
                        value={[clip.ellipse.rx]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, ellipse: { ...clip.ellipse, rx: v } })
                        }
                      />
                    </ControlRow>
                    <ControlRow label="Radius Y" value={`${clip.ellipse.ry}%`}>
                      <Slider
                        value={[clip.ellipse.ry]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, ellipse: { ...clip.ellipse, ry: v } })
                        }
                      />
                    </ControlRow>
                    <ControlRow label="Center X" value={`${clip.ellipse.x}%`}>
                      <Slider
                        value={[clip.ellipse.x]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, ellipse: { ...clip.ellipse, x: v } })
                        }
                      />
                    </ControlRow>
                    <ControlRow label="Center Y" value={`${clip.ellipse.y}%`}>
                      <Slider
                        value={[clip.ellipse.y]}
                        min={0}
                        max={100}
                        onValueChange={([v]) =>
                          setClip({ ...clip, ellipse: { ...clip.ellipse, y: v } })
                        }
                      />
                    </ControlRow>
                  </div>
                )}
              </TabsContent>
            </div>

            {/* Preview + code */}
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Live Preview</h2>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    Free to tweak
                  </span>
                </div>
                <div className="h-56 w-full bg-muted/30 sm:h-72">{preview()}</div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Generated code</h2>
                  <span className="text-xs text-muted-foreground">
                    {CREDIT_COST} credits per export
                  </span>
                </div>
                <CodeBlock code={code} />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Button
                    onClick={copyCss}
                    className="gradient-primary text-primary-foreground shadow-glow"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy CSS
                  </Button>
                  <Button variant="outline" onClick={downloadCss}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </div>

      <InsufficientCreditsDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Layout>
  );
};

export default CssGeneratorSuite;
