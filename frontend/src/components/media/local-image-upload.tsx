"use client";

import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { useMediaUpload, type UploadFolder } from "@/hooks/use-menu";
import { resolveMediaUrl } from "@/lib/api";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function LocalImageUpload({
  value,
  onChange,
  folder = "products",
}: {
  value: string | null;
  onChange: (relativePath: string | null) => void;
  folder?: UploadFolder;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const uploadMutation = useMediaUpload(folder);

  const previewUrl = resolveMediaUrl(value);

  const handleFile = (file: File) => {
    setLocalError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError("Only JPG, PNG, or WebP images are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Image must be 5 MB or smaller.");
      return;
    }
    uploadMutation.mutate(
      { file, oldPath: value },
      {
        onSuccess: (res) => onChange(res.relative_path),
        onError: (err) => setLocalError(err.detail),
      }
    );
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <img src={previewUrl} alt="Uploaded preview" className="h-44 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
              disabled={uploadMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver
              ? "border-orange-500 bg-orange-50"
              : "border-stone-300 bg-stone-50/70 hover:border-orange-400"
          }`}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-orange-600" />
              <p className="text-sm font-medium text-stone-700">Saving image to server...</p>
            </>
          ) : (
            <>
              <UploadCloud className="mb-2 h-8 w-8 text-stone-400" />
              <p className="text-sm font-medium text-stone-700">
                Drag &amp; drop image or click to browse
              </p>
              <p className="mt-1 text-xs text-stone-500">JPG, PNG, or WebP up to 5 MB</p>
            </>
          )}
        </div>
      )}
      {localError && <p className="text-xs text-red-600">{localError}</p>}
    </div>
  );
}
