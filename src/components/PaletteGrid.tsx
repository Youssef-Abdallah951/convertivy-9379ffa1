import { ColorCard } from "@/components/ColorCard";
import { type Swatch } from "@/lib/colors";

export function PaletteGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {swatches.map((s, i) => (
        <ColorCard key={`${s.hex}-${i}`} swatch={s} />
      ))}
    </div>
  );
}
