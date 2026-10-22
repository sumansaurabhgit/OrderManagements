"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { pushToast } from "@/components/toast-viewport";
import { parseLiveEvent, type LiveEvent } from "@/lib/live-event";

const TONE: Record<LiveEvent["type"], "success" | "info" | "warning"> = {
  "product.created": "success",
  "product.updated": "info",
  "product.removed": "warning",
  "stock.updated": "info",
};

type Handler = (raw: string) => void;

const handlers = new Set<Handler>();
let source: EventSource | null = null;
let closeTimer = 0;

function ensureStream() {
  if (source) return;
  source = new EventSource("/api/events");
  source.onmessage = (message) => {
    for (const handler of handlers) handler(message.data);
  };
}

function subscribeStream(handler: Handler) {
  handlers.add(handler);
  window.clearTimeout(closeTimer);
  ensureStream();
  return () => {
    handlers.delete(handler);
    if (handlers.size > 0) return;
    closeTimer = window.setTimeout(() => {
      if (handlers.size === 0 && source) {
        source.close();
        source = null;
      }
    }, 250);
  };
}

/**
 * Signed-in sessions listen for catalogue events, show a toast, and refresh
 * server-rendered pages so the shop list picks up the new product.
 */
export function LiveUpdatesClient() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer = 0;
    const unsubscribe = subscribeStream((raw) => {
      const event = parseLiveEvent(raw);
      if (!event) return;
      pushToast({ message: event.message, tone: TONE[event.type] });
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 50);
    });

    return () => {
      window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [router]);

  return null;
}
