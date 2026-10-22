import { Suspense } from "react";

import { LiveUpdatesClient } from "@/components/live-updates-client";
import { ToastViewport } from "@/components/toast-viewport";
import { getCurrentUser } from "@/lib/auth";

/** Toasts for every session. The event stream is only opened for a signed-in user. */
export function LiveUpdates() {
  return (
    <>
      <ToastViewport />
      <Suspense fallback={null}>
        <SignedInLiveUpdates />
      </Suspense>
    </>
  );
}

async function SignedInLiveUpdates() {
  const user = await getCurrentUser();
  return user ? <LiveUpdatesClient /> : null;
}
