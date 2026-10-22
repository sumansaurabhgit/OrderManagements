import { ImageOff } from "lucide-react";
import Image from "next/image";

/**
 * next/image refuses to optimise loopback hosts (SSRF protection), so images
 * from the local Supabase stack and static SVGs are served as-is.
 */
function shouldSkipOptimisation(src: string): boolean {
  return (
    src.endsWith(".svg") || src.startsWith("http://127.0.0.1") || src.startsWith("http://localhost")
  );
}

export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  framed = true,
  className = "",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  framed?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-zinc-100 ${framed ? "rounded-lg" : ""}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={shouldSkipOptimisation(src)}
          className={`object-cover ${className}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-400">
          <ImageOff aria-hidden className="size-8" />
          <span className="sr-only">No image available</span>
        </div>
      )}
    </div>
  );
}
