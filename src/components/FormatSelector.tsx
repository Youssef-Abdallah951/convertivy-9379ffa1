import { FORMATS, type FormatKey } from "@/lib/encoders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: FormatKey;
  onChange: (value: FormatKey) => void;
};

export function FormatSelector({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Format
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as FormatKey)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMATS.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
              {f.decodeOnly ? " (decode only)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
