"use client";

import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

type ToastTone = "success" | "info" | "warning";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastStore = {
  items: ToastItem[];
  listeners: Set<() => void>;
  timers: Map<string, number>;
};

const TONES: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

const EMPTY: ToastItem[] = [];
const MAX_TOASTS = 4;
const DISMISS_MS = 6000;

// Kept on window so the stream handler and the viewport share one list even
// when the client bundle evaluates this module more than once.
function getStore(): ToastStore {
  if (typeof window === "undefined") {
    return { items: EMPTY, listeners: new Set(), timers: new Map() };
  }
  const host = window as Window & { __larkspurToasts?: ToastStore };
  if (!host.__larkspurToasts) {
    host.__larkspurToasts = { items: EMPTY, listeners: new Set(), timers: new Map() };
  }
  return host.__larkspurToasts;
}

function emit() {
  for (const listener of getStore().listeners) listener();
}

function subscribe(listener: () => void) {
  const store = getStore();
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function getSnapshot() {
  return getStore().items;
}

function getServerSnapshot() {
  return EMPTY;
}

export function dismissToast(id: string) {
  const store = getStore();
  const timer = store.timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    store.timers.delete(id);
  }
  const next = store.items.filter((item) => item.id !== id);
  if (next.length === store.items.length) return;
  store.items = next.length === 0 ? EMPTY : next;
  emit();
}

export function pushToast(input: { message: string; tone: ToastTone }) {
  const store = getStore();
  const id = crypto.randomUUID();
  const next = [...store.items, { id, message: input.message, tone: input.tone }];
  const dropped = next.length > MAX_TOASTS ? next.slice(0, next.length - MAX_TOASTS) : [];
  for (const item of dropped) {
    const timer = store.timers.get(item.id);
    if (timer !== undefined) window.clearTimeout(timer);
    store.timers.delete(item.id);
  }
  store.items = next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
  emit();
  store.timers.set(
    id,
    window.setTimeout(() => dismissToast(id), DISMISS_MS),
  );
}

export function ToastViewport() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 left-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-3 text-sm shadow-lg ${TONES[toast.tone]}`}
        >
          <p className="flex-1 leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded-md p-0.5 hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
