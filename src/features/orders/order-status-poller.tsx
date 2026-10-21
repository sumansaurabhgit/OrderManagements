"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

/**
 * While an order is awaiting payment confirmation, re-fetch the server-rendered
 * page so the status appears as soon as the Stripe webhook has been processed.
 * The client never changes the order status itself.
 */
export function OrderStatusPoller() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const exhausted = polls >= MAX_POLLS;

  useEffect(() => {
    if (exhausted) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setPolls((count) => count + 1);
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [polls, exhausted, router]);

  return (
    <div className="space-y-3">
      <p role="status" aria-live="polite" className="text-sm text-stone-700">
        {exhausted
          ? "Confirmation is taking longer than usual. Your order page will update once Stripe confirms the payment."
          : "Waiting for Stripe to confirm your payment…"}
      </p>
      {exhausted ? (
        <Button variant="secondary" size="sm" onClick={() => setPolls(0)}>
          Check again
        </Button>
      ) : null}
    </div>
  );
}
