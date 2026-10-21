"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelMyOrder } from "@/features/checkout/actions";

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(cancelMyOrder, null);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Cancel this order and release the reserved items?")) event.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <SubmitButton variant="secondary" pendingLabel="Cancelling…">
        Cancel order &amp; release stock
      </SubmitButton>
    </form>
  );
}
