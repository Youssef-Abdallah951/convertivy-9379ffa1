import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function EncoderInput({ value, onChange }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Input
        </label>
        <span className="text-xs text-muted-foreground">{value.length} characters</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type or paste your text here…"
        className="min-h-[160px] resize-y font-mono text-sm sm:text-base"
      />
    </div>
  );
}
