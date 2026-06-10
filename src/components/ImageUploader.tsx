import { useRef, useState } from "react";
import { Upload, ImageIcon, Loader2 } from "lucide-react";

type Props = {
  onFile: (file: File) => void;
  loading?: boolean;
  preview?: string | null;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploader({ onFile, loading, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file?: File | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      // Surfaced by the parent via toast; just ignore invalid types here.
      onFile(file);
      return;
    }
    onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-base sm:p-12 ${
        dragging ? "border-primary bg-accent/50" : "border-border bg-card hover:border-primary/60 hover:bg-accent/40"
      }`}
    >
      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      ) : preview ? (
        <img
          src={preview}
          alt="Selected upload preview"
          className="max-h-40 w-auto rounded-xl object-contain shadow-sm"
        />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
          <Upload className="h-6 w-6" />
        </span>
      )}
      <div>
        <p className="text-base font-semibold">
          {preview ? "Choose another image" : "Drop an image or click to upload"}
        </p>
        <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> JPG, PNG, WEBP — up to 20MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
