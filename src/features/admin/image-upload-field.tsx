"use client";

import { useId, useState } from "react";

import { ProductImage } from "@/components/product-image";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Uploads straight from the browser to Supabase Storage using the admin's own
 * session. The storage.objects RLS policies (admin-only writes) and the
 * bucket's MIME/size limits are enforced server-side by Supabase; the checks
 * here only give faster feedback.
 */
export function ImageUploadField({ defaultValue, errors }: { defaultValue: string | null; errors?: string[] }) {
  const fileInputId = useId();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setStatus(null);
    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setStatus({ tone: "error", text: "Use a PNG, JPEG, WebP, AVIF or GIF image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ tone: "error", text: "Images must be 5 MB or smaller." });
      return;
    }

    setUploading(true);
    const storage = getBrowserSupabaseClient().storage.from(BUCKET);
    const path = `products/${crypto.randomUUID()}.${extension}`;
    const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    setUploading(false);

    if (error) {
      setStatus({ tone: "error", text: `Upload failed: ${error.message}` });
      return;
    }
    setUrl(storage.getPublicUrl(path).data.publicUrl);
    setStatus({ tone: "success", text: "Image uploaded. Save the product to apply it." });
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-stone-200 p-4">
      <legend className="px-1 text-sm font-medium text-stone-800">Product image</legend>
      {url ? (
        <div className="w-32">
          <ProductImage src={url} alt="Current product image" sizes="128px" />
        </div>
      ) : null}
      <div>
        <label htmlFor={fileInputId} className="mb-1 block text-sm font-medium text-stone-800">
          Upload an image
        </label>
        <input
          id={fileInputId}
          type="file"
          accept={Object.keys(EXTENSIONS).join(",")}
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>
      <div>
        <label htmlFor="imageUrl" className="mb-1 block text-sm font-medium text-stone-800">
          …or image URL
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="text"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? "imageUrl-error" : undefined}
          className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        {errors?.length ? (
          <p id="imageUrl-error" className="mt-1 text-xs font-medium text-rose-700">
            {errors.join(" ")}
          </p>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className={`text-sm ${status?.tone === "error" ? "text-rose-700" : "text-emerald-800"}`}>
        {uploading ? "Uploading…" : status?.text}
      </p>
    </fieldset>
  );
}
