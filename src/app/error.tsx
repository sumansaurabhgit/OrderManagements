"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-stone-600">
        An unexpected error occurred while loading this page.
        {error.digest ? <span className="block font-mono text-xs">Reference: {error.digest}</span> : null}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
