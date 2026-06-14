import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBytes, type ImageMeta } from "@/lib/imageMeta";

type Props = {
  meta: ImageMeta;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function MetadataViewer({ meta }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          File & Resolution
        </h3>
        <Row label="File name" value={meta.fileName} />
        <Row label="Format" value={meta.format} />
        <Row label="File size" value={formatBytes(meta.fileSize)} />
        <Row label="Width" value={`${meta.width} px`} />
        <Row label="Height" value={`${meta.height} px`} />
        <Row label="Resolution" value={`${meta.width} × ${meta.height}`} />
        <Row label="Megapixels" value={`${meta.megapixels} MP`} />
        <Row label="Aspect ratio" value={meta.aspectRatio} />
        {meta.colorProfile && <Row label="Color profile" value={meta.colorProfile} />}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          EXIF Metadata
          {meta.exif && (
            <Badge variant="secondary" className="text-[10px]">
              {Object.keys(meta.exif).length} fields
            </Badge>
          )}
        </h3>
        {meta.exif ? (
          Object.entries(meta.exif).map(([k, v]) => <Row key={k} label={k} value={v} />)
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            No EXIF metadata found in this image (common for PNG/WEBP or stripped photos).
          </p>
        )}
      </div>

      {meta.gps && (
        <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand">
            <MapPin className="h-4 w-4" /> GPS Location
          </h3>
          <Row label="Latitude" value={meta.gps.latitude.toFixed(6)} />
          <Row label="Longitude" value={meta.gps.longitude.toFixed(6)} />
          <a
            href={meta.gps.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Open in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
