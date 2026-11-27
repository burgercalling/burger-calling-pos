"use client";

import { ImagePlus, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaFromUrl, useMediaUpload, type UploadFolder } from "@/hooks/use-menu";
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
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const uploadMutation = useMediaUpload(folder);
  const urlMutation = useMediaFromUrl(folder);
  const isBusy = uploadMutation.isPending || urlMutation.isPending;

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

  const handleUrlFetch = () => {
    setLocalError(null);
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setLocalError("Please enter a valid http:// or https:// image URL.");
      return;
    }
    urlMutation.mutate(
      { image_url: trimmed },
      {
        onSuccess: (res) => {
          onChange(res.relative_path);
          setUrlInput("");
        },
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
    <div className="space-y-2.5">
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

      {!previewUrl && (
        <div className="flex gap-1.5 rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setLocalError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
              mode === "upload"
                ? "bg-white text-stone-900 shadow-xs dark:bg-stone-900 dark:text-stone-100"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("url");
              setLocalError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
              mode === "url"
                ? "bg-white text-stone-900 shadow-xs dark:bg-stone-900 dark:text-stone-100"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Image URL
          </button>
        </div>
      )}

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
          <img src={previewUrl} alt="Uploaded preview" className="h-44 w-full object-cover" />
          <div className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
            Stored locally
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
              disabled={isBusy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
            dragOver
              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
              : "border-stone-300 bg-stone-50/70 hover:border-orange-400 dark:border-stone-700 dark:bg-stone-900/50"
          }`}
        >
          {isBusy ? (
            <>
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-orange-600" />
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Saving image to server...</p>
            </>
          ) : (
            <>
              <UploadCloud className="mb-2 h-8 w-8 text-stone-400" />
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Drag &amp; drop image or click to browse
              </p>
              <p className="mt-1 text-xs text-stone-500">JPG, PNG, or WebP up to 5 MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-700 dark:bg-stone-900/50">
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Paste a public image URL. The server will download, validate, and store it locally.
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/burger.jpg"
              disabled={isBusy}
            />
            <Button
              type="button"
              onClick={handleUrlFetch}
              disabled={isBusy || !urlInput.trim()}
              className="shrink-0 bg-orange-600 hover:bg-orange-700"
            >
              {urlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch & Save"}
            </Button>
          </div>
        </div>
      )}
      {localError && <p className="text-xs font-medium text-red-600">{localError}</p>}
    </div>
  );
}
